package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"roomly/config"
	"roomly/database"
	"roomly/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// 还原数据
func RestoreData(c *gin.Context) {
	// 检查管理员权限
	if !checkAdminPermission(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "仅管理员可执行还原操作"})
		return
	}

	var req models.RestoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	// 安全检查文件名
	if strings.Contains(req.Filename, "..") || strings.Contains(req.Filename, "/") || strings.Contains(req.Filename, "\\") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的文件名"})
		return
	}

	cfg := config.Load()
	filePath := filepath.Join(cfg.BackupPath, req.Filename)

	// 检查备份文件是否存在
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "备份文件不存在"})
		return
	}

	// 验证备份文件完整性
	validationResult, validationErr := ValidateRestoreCompatibility(filePath)
	if validationErr != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("备份文件验证失败: %v", validationErr)})
		return
	}

	if !validationResult.IsValid {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":               "备份文件无效",
			"validation_errors":   validationResult.Errors,
			"validation_warnings": validationResult.Warnings,
		})
		return
	}

	// 确定备份文件格式
	ext := strings.ToLower(filepath.Ext(req.Filename))
	format := ext[1:] // 去掉点号

	var err error
	if format == "json" {
		err = restoreFromJSON(filePath)
	} else if format == "sql" {
		err = restoreFromSQL(filePath)
	} else {
		err = fmt.Errorf("不支持的备份格式: %s", format)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("数据还原失败: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "数据还原成功",
	})
}

// 从JSON文件还原数据
func restoreFromJSON(filePath string) error {
	// 读取备份文件
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("无法打开备份文件: %v", err)
	}
	defer file.Close()

	var backupData models.BackupData
	decoder := json.NewDecoder(file)
	if err := decoder.Decode(&backupData); err != nil {
		return fmt.Errorf("解析备份文件失败: %v", err)
	}

	// 开始事务
	tx := database.DB.Begin()
	if tx.Error != nil {
		return fmt.Errorf("开始事务失败: %v", tx.Error)
	}

	// 清空现有数据（按依赖关系顺序）
	if err := clearExistingData(tx); err != nil {
		tx.Rollback()
		return fmt.Errorf("清空现有数据失败: %v", err)
	}

	// 还原数据（按依赖关系顺序）
	if err := restoreDataFromBackup(tx, &backupData); err != nil {
		tx.Rollback()
		return fmt.Errorf("还原数据失败: %v", err)
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("提交事务失败: %v", err)
	}

	return nil
}

// 从SQL文件还原数据
func restoreFromSQL(filePath string) error {
	// 读取SQL文件内容
	content, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("读取SQL文件失败: %v", err)
	}

	sqlContent := string(content)

	// 开始事务
	tx := database.DB.Begin()
	if tx.Error != nil {
		return fmt.Errorf("开始事务失败: %v", tx.Error)
	}

	// 先清空现有数据
	if err := clearExistingData(tx); err != nil {
		tx.Rollback()
		return fmt.Errorf("清空现有数据失败: %v", err)
	}

	// 分割SQL语句
	statements := strings.Split(sqlContent, ";")

	// 执行SQL语句
	for _, statement := range statements {
		statement = strings.TrimSpace(statement)
		if statement == "" || strings.HasPrefix(statement, "--") {
			continue
		}

		// 跳过DROP TABLE和CREATE TABLE语句，因为我们已经清空了数据
		upperStatement := strings.ToUpper(statement)
		if strings.HasPrefix(upperStatement, "DROP TABLE") ||
			strings.HasPrefix(upperStatement, "CREATE TABLE") ||
			strings.HasPrefix(upperStatement, "SET FOREIGN_KEY_CHECKS") {
			continue
		}

		if err := tx.Exec(statement).Error; err != nil {
			tx.Rollback()
			return fmt.Errorf("执行SQL语句失败: %v, SQL: %s", err, statement)
		}
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("提交事务失败: %v", err)
	}

	return nil
}

// 清空现有数据
func clearExistingData(tx *gorm.DB) error {
	// 按依赖关系顺序删除数据
	tables := []string{"booking_users", "bookings", "rooms", "members"}

	for _, table := range tables {
		if err := tx.Exec(fmt.Sprintf("DELETE FROM %s", table)).Error; err != nil {
			return fmt.Errorf("清空表 %s 失败: %v", table, err)
		}
	}

	return nil
}

// 从备份数据还原
func restoreDataFromBackup(tx *gorm.DB, backupData *models.BackupData) error {
	// 按依赖关系顺序还原数据

	// 1. 还原会员数据
	if len(backupData.Members) > 0 {
		if err := tx.Create(&backupData.Members).Error; err != nil {
			return fmt.Errorf("还原会员数据失败: %v", err)
		}
	}

	// 2. 还原会议室数据
	if len(backupData.Rooms) > 0 {
		if err := tx.Create(&backupData.Rooms).Error; err != nil {
			return fmt.Errorf("还原会议室数据失败: %v", err)
		}
	}

	// 3. 还原预订数据（不包含关联数据）
	if len(backupData.Bookings) > 0 {
		// 创建不包含关联数据的预订记录
		for _, booking := range backupData.Bookings {
			// 清空关联数据，避免重复创建
			booking.Room = models.Room{}
			booking.Member = models.Member{}
			booking.BookingUsers = []models.BookingUser{}

			if err := tx.Create(&booking).Error; err != nil {
				return fmt.Errorf("还原预订数据失败: %v", err)
			}
		}
	}

	// 4. 还原预订用户数据
	if len(backupData.BookingUsers) > 0 {
		if err := tx.Create(&backupData.BookingUsers).Error; err != nil {
			return fmt.Errorf("还原预订用户数据失败: %v", err)
		}
	}

	return nil
}

// 获取还原预览信息
func GetRestorePreview(c *gin.Context) {
	// 检查管理员权限
	if !checkAdminPermission(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "仅管理员可查看还原预览"})
		return
	}

	filename := c.Param("filename")
	if filename == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "文件名不能为空"})
		return
	}

	cfg := config.Load()
	filePath := filepath.Join(cfg.BackupPath, filename)

	// 检查文件是否存在
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "备份文件不存在"})
		return
	}

	// 获取文件格式
	ext := strings.ToLower(filepath.Ext(filename))
	format := ext[1:]

	var preview map[string]interface{}
	var err error

	if format == "json" {
		preview, err = getJSONRestorePreview(filePath)
	} else if format == "sql" {
		preview, err = getSQLRestorePreview(filePath)
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "不支持的备份格式"})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("获取还原预览失败: %v", err)})
		return
	}

	// 获取当前数据统计
	currentStats := getCurrentDataStats()

	c.JSON(http.StatusOK, gin.H{
		"filename":     filename,
		"format":       format,
		"backup_data":  preview,
		"current_data": currentStats,
		"will_replace": true, // 完整还原会替换所有数据
	})
}

// 获取JSON还原预览
func getJSONRestorePreview(filePath string) (map[string]interface{}, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var backupData models.BackupData
	decoder := json.NewDecoder(file)
	if err := decoder.Decode(&backupData); err != nil {
		return nil, err
	}

	preview := map[string]interface{}{
		"version":             backupData.Version,
		"created_at":          backupData.CreatedAt,
		"created_by":          backupData.CreatedBy,
		"description":         backupData.Description,
		"members_count":       len(backupData.Members),
		"rooms_count":         len(backupData.Rooms),
		"bookings_count":      len(backupData.Bookings),
		"booking_users_count": len(backupData.BookingUsers),
	}

	return preview, nil
}

// 获取SQL还原预览
func getSQLRestorePreview(filePath string) (map[string]interface{}, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	sqlContent := string(content)

	// 简单统计INSERT语句数量
	insertCount := strings.Count(strings.ToUpper(sqlContent), "INSERT INTO")

	preview := map[string]interface{}{
		"format":            "sql",
		"insert_statements": insertCount,
		"file_size":         len(content),
		"description":       "SQL格式备份文件",
	}

	return preview, nil
}

// 获取当前数据统计
func getCurrentDataStats() map[string]interface{} {
	var memberCount, roomCount, bookingCount, bookingUserCount int64

	database.DB.Model(&models.Member{}).Count(&memberCount)
	database.DB.Model(&models.Room{}).Count(&roomCount)
	database.DB.Model(&models.Booking{}).Count(&bookingCount)
	database.DB.Model(&models.BookingUser{}).Count(&bookingUserCount)

	return map[string]interface{}{
		"members_count":       memberCount,
		"rooms_count":         roomCount,
		"bookings_count":      bookingCount,
		"booking_users_count": bookingUserCount,
	}
}
