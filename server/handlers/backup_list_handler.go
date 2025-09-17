package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"roomly/config"
	"roomly/models"

	"github.com/gin-gonic/gin"
)

// 获取备份文件列表
func GetBackupList(c *gin.Context) {
	// 检查管理员权限
	if !checkAdminPermission(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "仅管理员可查看备份列表"})
		return
	}

	cfg := config.Load()
	backupDir := cfg.BackupPath

	// 检查备份目录是否存在
	if _, err := os.Stat(backupDir); os.IsNotExist(err) {
		c.JSON(http.StatusOK, gin.H{
			"backups": []models.BackupInfo{},
			"total":   0,
		})
		return
	}

	// 读取备份目录
	files, err := os.ReadDir(backupDir)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "读取备份目录失败"})
		return
	}

	var backups []models.BackupInfo

	// 处理每个备份文件
	for _, file := range files {
		if file.IsDir() {
			continue
		}

		filename := file.Name()

		// 检查文件扩展名
		ext := strings.ToLower(filepath.Ext(filename))
		if ext != ".sql" && ext != ".json" {
			continue
		}

		filePath := filepath.Join(backupDir, filename)

		// 获取文件信息
		fileInfo, err := os.Stat(filePath)
		if err != nil {
			continue
		}

		// 验证文件完整性
		isValid := validateBackupFile(filePath, ext[1:])

		// 设置默认创建者信息
		createdBy := "admin"
		description := ""
		// 对于JSON文件，可以尝试从文件中读取描述
		if ext == ".json" {
			if desc := getDescriptionFromJSONBackup(filePath); desc != "" {
				description = desc
			}
		}

		backup := models.BackupInfo{
			ID:          generateBackupID(filename),
			Filename:    filename,
			FilePath:    filePath,
			Format:      ext[1:], // 去掉点号
			Size:        fileInfo.Size(),
			CreatedAt:   fileInfo.ModTime(),
			CreatedBy:   createdBy,
			IsValid:     isValid,
			Description: description,
		}

		backups = append(backups, backup)
	}

	// 按创建时间倒序排列
	sort.Slice(backups, func(i, j int) bool {
		return backups[i].CreatedAt.After(backups[j].CreatedAt)
	})

	c.JSON(http.StatusOK, gin.H{
		"backups": backups,
		"total":   len(backups),
	})
}

// 下载备份文件
func DownloadBackup(c *gin.Context) {
	// 检查管理员权限
	if !checkAdminPermission(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "仅管理员可下载备份文件"})
		return
	}

	filename := c.Param("filename")
	if filename == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "文件名不能为空"})
		return
	}

	// 安全检查：防止路径遍历攻击
	if strings.Contains(filename, "..") || strings.Contains(filename, "/") || strings.Contains(filename, "\\") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的文件名"})
		return
	}

	cfg := config.Load()
	filePath := filepath.Join(cfg.BackupPath, filename)

	// 检查文件是否存在
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "备份文件不存在"})
		return
	}

	// 设置下载响应头
	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Transfer-Encoding", "binary")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("Content-Type", "application/octet-stream")

	// 发送文件
	c.File(filePath)
}

// 删除备份文件
func DeleteBackup(c *gin.Context) {
	// 检查管理员权限
	if !checkAdminPermission(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "仅管理员可删除备份文件"})
		return
	}

	filename := c.Param("filename")
	if filename == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "文件名不能为空"})
		return
	}

	// 安全检查
	if strings.Contains(filename, "..") || strings.Contains(filename, "/") || strings.Contains(filename, "\\") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的文件名"})
		return
	}

	cfg := config.Load()
	filePath := filepath.Join(cfg.BackupPath, filename)

	// 检查文件是否存在
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "备份文件不存在"})
		return
	}

	// 删除文件
	if err := os.Remove(filePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除文件失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "备份文件删除成功"})
}

// 获取备份文件详情
func GetBackupDetail(c *gin.Context) {
	// 检查管理员权限
	if !checkAdminPermission(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "仅管理员可查看备份详情"})
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
	fileInfo, err := os.Stat(filePath)
	if os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "备份文件不存在"})
		return
	}

	// 获取文件格式
	ext := strings.ToLower(filepath.Ext(filename))
	format := ext[1:] // 去掉点号

	// 验证文件完整性
	isValid := validateBackupFile(filePath, format)

	// 获取备份统计信息
	stats := getBackupStats(filePath, format)

	backup := models.BackupInfo{
		ID:          generateBackupID(filename),
		Filename:    filename,
		FilePath:    filePath,
		Format:      format,
		Size:        fileInfo.Size(),
		CreatedAt:   fileInfo.ModTime(),
		CreatedBy:   "admin",
		IsValid:     isValid,
		Description: getDescriptionFromBackup(filePath, format),
	}

	c.JSON(http.StatusOK, gin.H{
		"backup": backup,
		"stats":  stats,
	})
}

// 验证备份文件完整性
func validateBackupFile(filePath, format string) bool {
	file, err := os.Open(filePath)
	if err != nil {
		return false
	}
	defer file.Close()

	if format == "json" {
		// 验证JSON格式
		var backupData models.BackupData
		decoder := json.NewDecoder(file)
		return decoder.Decode(&backupData) == nil
	} else if format == "sql" {
		// 验证SQL文件（简单检查）
		content := make([]byte, 1024)
		n, err := file.Read(content)
		if err != nil && n == 0 {
			return false
		}
		// 检查是否包含备份头信息
		return strings.Contains(string(content[:n]), "Roomly Database Backup")
	}

	return false
}

// 生成备份ID
func generateBackupID(filename string) string {
	// 使用文件名生成简单的ID
	return strings.TrimSuffix(filename, filepath.Ext(filename))
}

// 从JSON备份文件获取描述
func getDescriptionFromJSONBackup(filePath string) string {
	file, err := os.Open(filePath)
	if err != nil {
		return ""
	}
	defer file.Close()

	var backupData models.BackupData
	decoder := json.NewDecoder(file)
	if err := decoder.Decode(&backupData); err != nil {
		return ""
	}

	return backupData.Description
}

// 从备份文件获取描述
func getDescriptionFromBackup(filePath, format string) string {
	if format == "json" {
		return getDescriptionFromJSONBackup(filePath)
	}
	// SQL文件暂时不支持描述提取
	return ""
}

// 获取备份统计信息
func getBackupStats(filePath, format string) map[string]interface{} {
	stats := make(map[string]interface{})

	if format == "json" {
		file, err := os.Open(filePath)
		if err != nil {
			return stats
		}
		defer file.Close()

		var backupData models.BackupData
		decoder := json.NewDecoder(file)
		if err := decoder.Decode(&backupData); err != nil {
			return stats
		}

		stats["members_count"] = len(backupData.Members)
		stats["rooms_count"] = len(backupData.Rooms)
		stats["bookings_count"] = len(backupData.Bookings)
		stats["booking_users_count"] = len(backupData.BookingUsers)
		stats["version"] = backupData.Version
	}

	return stats
}
