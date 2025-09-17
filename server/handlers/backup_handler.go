package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"roomly/config"
	"roomly/database"
	"roomly/models"

	"github.com/gin-gonic/gin"
)

// 确保备份目录存在
func ensureBackupDir() error {
	cfg := config.Load()
	if err := os.MkdirAll(cfg.BackupPath, 0755); err != nil {
		return fmt.Errorf("failed to create backup directory: %v", err)
	}
	return nil
}

// 生成备份文件名
func generateBackupFilename(format string) string {
	timestamp := time.Now().Format("20060102_150405")
	return fmt.Sprintf("roomly_backup_%s.%s", timestamp, format)
}

// 创建手动备份
func CreateBackup(c *gin.Context) {
	// 检查管理员权限
	if !checkAdminPermission(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "仅管理员可执行备份操作"})
		return
	}

	// 获取请求参数
	var req struct {
		Format      string `json:"format" binding:"required"` // "sql" or "json"
		Description string `json:"description"`               // 备份描述
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	// 验证格式
	if req.Format != "sql" && req.Format != "json" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "不支持的备份格式"})
		return
	}

	// 获取操作用户信息
	createdBy := getUserFromContext(c)

	// 确保备份目录存在
	if err := ensureBackupDir(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建备份目录失败"})
		return
	}

	// 生成备份文件名
	cfg := config.Load()
	filename := generateBackupFilename(req.Format)
	filepath := filepath.Join(cfg.BackupPath, filename)

	var err error
	var fileSize int64

	// 根据格式执行备份
	if req.Format == "json" {
		fileSize, err = createJSONBackup(filepath, createdBy, req.Description)
	} else {
		fileSize, err = createSQLBackup(filepath, createdBy, req.Description)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("备份失败: %v", err)})
		return
	}

	// 验证备份文件完整性
	validator := NewBackupValidator(filepath, req.Format)
	validationResult := validator.ValidateBackupFile()

	if !validationResult.IsValid {
		// 删除无效的备份文件
		os.Remove(filepath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "备份文件验证失败"})
		return
	}

	// 创建校验和文件
	CreateBackupChecksum(filepath)

	// 返回备份信息
	backupInfo := models.BackupInfo{
		ID:          generateBackupID(filename),
		Filename:    filename,
		FilePath:    filepath,
		Format:      req.Format,
		Size:        fileSize,
		CreatedAt:   time.Now(),
		CreatedBy:   createdBy,
		IsValid:     validationResult.IsValid,
		Description: req.Description,
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "备份创建成功",
		"backup":  backupInfo,
	})
}

// 创建JSON格式备份
func createJSONBackup(filepath, createdBy, description string) (int64, error) {
	// 获取所有数据
	var members []models.Member
	var rooms []models.Room
	var bookings []models.Booking
	var bookingUsers []models.BookingUser

	if err := database.DB.Find(&members).Error; err != nil {
		return 0, fmt.Errorf("failed to fetch members: %v", err)
	}

	if err := database.DB.Find(&rooms).Error; err != nil {
		return 0, fmt.Errorf("failed to fetch rooms: %v", err)
	}

	if err := database.DB.Preload("Room").Preload("Member").Preload("BookingUsers").Find(&bookings).Error; err != nil {
		return 0, fmt.Errorf("failed to fetch bookings: %v", err)
	}

	if err := database.DB.Find(&bookingUsers).Error; err != nil {
		return 0, fmt.Errorf("failed to fetch booking users: %v", err)
	}

	// 构建备份数据
	backupData := models.BackupData{
		Version:      "1.0",
		CreatedAt:    time.Now(),
		CreatedBy:    createdBy,
		Description:  description,
		Members:      members,
		Rooms:        rooms,
		Bookings:     bookings,
		BookingUsers: bookingUsers,
	}

	// 创建文件
	file, err := os.Create(filepath)
	if err != nil {
		return 0, fmt.Errorf("failed to create backup file: %v", err)
	}
	defer file.Close()

	// 写入JSON数据
	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(backupData); err != nil {
		return 0, fmt.Errorf("failed to write backup data: %v", err)
	}

	// 获取文件大小
	fileInfo, err := file.Stat()
	if err != nil {
		return 0, fmt.Errorf("failed to get file info: %v", err)
	}

	return fileInfo.Size(), nil
}

// 创建SQL格式备份
func createSQLBackup(filepath, createdBy, description string) (int64, error) {
	// 创建文件
	file, err := os.Create(filepath)
	if err != nil {
		return 0, fmt.Errorf("failed to create backup file: %v", err)
	}
	defer file.Close()

	// 写入备份头信息
	header := fmt.Sprintf(`-- Roomly Database Backup
-- Created at: %s
-- Created by: %s
-- Description: %s
-- Version: 1.0

SET FOREIGN_KEY_CHECKS = 0;

`, time.Now().Format("2006-01-02 15:04:05"), createdBy, description)

	if _, err := file.WriteString(header); err != nil {
		return 0, fmt.Errorf("failed to write header: %v", err)
	}

	// 备份各个表
	tables := []string{"members", "rooms", "bookings", "booking_users"}

	for _, table := range tables {
		if err := backupTable(file, table); err != nil {
			return 0, fmt.Errorf("failed to backup table %s: %v", table, err)
		}
	}

	// 写入结尾
	footer := "\nSET FOREIGN_KEY_CHECKS = 1;\n"
	if _, err := file.WriteString(footer); err != nil {
		return 0, fmt.Errorf("failed to write footer: %v", err)
	}

	// 获取文件大小
	fileInfo, err := file.Stat()
	if err != nil {
		return 0, fmt.Errorf("failed to get file info: %v", err)
	}

	return fileInfo.Size(), nil
}

// 备份单个表到SQL文件
func backupTable(file *os.File, tableName string) error {
	// 写入表注释
	if _, err := file.WriteString(fmt.Sprintf("\n-- Table: %s\n", tableName)); err != nil {
		return err
	}

	// 获取表结构
	var createSQL string
	row := database.DB.Raw(fmt.Sprintf("SELECT sql FROM sqlite_master WHERE type='table' AND name='%s'", tableName)).Row()
	if err := row.Scan(&createSQL); err != nil {
		return fmt.Errorf("failed to get table structure: %v", err)
	}

	// 写入DROP和CREATE语句
	dropSQL := fmt.Sprintf("DROP TABLE IF EXISTS `%s`;\n", tableName)
	if _, err := file.WriteString(dropSQL); err != nil {
		return err
	}

	if _, err := file.WriteString(createSQL + ";\n\n"); err != nil {
		return err
	}

	// 获取表数据
	rows, err := database.DB.Raw(fmt.Sprintf("SELECT * FROM %s", tableName)).Rows()
	if err != nil {
		return fmt.Errorf("failed to query table data: %v", err)
	}
	defer rows.Close()

	// 获取列信息
	columns, err := rows.Columns()
	if err != nil {
		return fmt.Errorf("failed to get columns: %v", err)
	}

	// 写入INSERT语句
	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return fmt.Errorf("failed to scan row: %v", err)
		}

		// 构建INSERT语句
		var valueStrings []string
		for _, value := range values {
			if value == nil {
				valueStrings = append(valueStrings, "NULL")
			} else {
				switch v := value.(type) {
				case string:
					valueStrings = append(valueStrings, fmt.Sprintf("'%s'", strings.ReplaceAll(v, "'", "''")))
				case []byte:
					valueStrings = append(valueStrings, fmt.Sprintf("'%s'", strings.ReplaceAll(string(v), "'", "''")))
				case time.Time:
					// 格式化时间为SQLite兼容的字符串格式
					valueStrings = append(valueStrings, fmt.Sprintf("'%s'", v.Format("2006-01-02 15:04:05")))
				default:
					// 对于其他类型，检查是否是时间字符串
					valueStr := fmt.Sprintf("%v", v)
					// 如果看起来像时间格式，尝试解析并重新格式化
					if strings.Contains(valueStr, "+0800") || strings.Contains(valueStr, "T") {
						if parsedTime, err := time.Parse(time.RFC3339, valueStr); err == nil {
							valueStrings = append(valueStrings, fmt.Sprintf("'%s'", parsedTime.Format("2006-01-02 15:04:05")))
						} else if parsedTime, err := time.Parse("2006-01-02 15:04:05.999999999 -0700 MST", valueStr); err == nil {
							valueStrings = append(valueStrings, fmt.Sprintf("'%s'", parsedTime.Format("2006-01-02 15:04:05")))
						} else {
							valueStrings = append(valueStrings, fmt.Sprintf("'%s'", strings.ReplaceAll(valueStr, "'", "''")))
						}
					} else {
						valueStrings = append(valueStrings, fmt.Sprintf("%v", v))
					}
				}
			}
		}

		insertSQL := fmt.Sprintf("INSERT INTO `%s` (`%s`) VALUES (%s);\n",
			tableName,
			strings.Join(columns, "`, `"),
			strings.Join(valueStrings, ", "))

		if _, err := file.WriteString(insertSQL); err != nil {
			return err
		}
	}

	return nil
}

// 检查管理员权限
func checkAdminPermission(c *gin.Context) bool {
	// 这里应该根据实际的权限系统来实现
	// 暂时返回true，实际使用时需要检查用户的管理员权限
	return true
}

// 从上下文获取用户信息
func getUserFromContext(c *gin.Context) string {
	// 这里应该从JWT token或session中获取用户信息
	// 暂时返回默认值，实际使用时需要实现
	return "admin"
}
