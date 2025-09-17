package handlers

import (
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"roomly/config"
	"roomly/models"

	"github.com/gin-gonic/gin"
)

// isValidFilename 检查文件名是否安全
func isValidFilename(filename string) bool {
	if filename == "" || strings.Contains(filename, "..") ||
		strings.Contains(filename, "/") || strings.Contains(filename, "\\") {
		return false
	}
	return true
}

// getBackupFileList 获取备份文件列表
func getBackupFileList() ([]models.BackupInfo, error) {
	cfg := config.Load()
	backupDir := cfg.BackupPath
	files, err := os.ReadDir(backupDir)
	if err != nil {
		return nil, err
	}

	var backupList []models.BackupInfo
	for _, file := range files {
		if file.IsDir() || strings.HasSuffix(file.Name(), ".md5") {
			continue
		}

		info, err := file.Info()
		if err != nil {
			continue
		}

		backup := models.BackupInfo{
			Filename:  file.Name(),
			FilePath:  filepath.Join(backupDir, file.Name()),
			Size:      info.Size(),
			CreatedAt: info.ModTime(),
		}

		if strings.HasSuffix(file.Name(), ".sql") {
			backup.Format = "sql"
		} else {
			backup.Format = "json"
		}

		backupList = append(backupList, backup)
	}

	return backupList, nil
}

// ValidateBackupFile 验证备份文件API
func ValidateBackupFile(c *gin.Context) {
	// 检查管理员权限
	if !checkAdminPermission(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "需要管理员权限"})
		return
	}

	filename := c.Param("filename")
	if filename == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "文件名不能为空"})
		return
	}

	// 安全检查文件名
	if !isValidFilename(filename) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的文件名"})
		return
	}

	cfg := config.Load()
	filePath := filepath.Join(cfg.BackupPath, filename)

	// 确定文件格式
	format := "json"
	if filepath.Ext(filename) == ".sql" {
		format = "sql"
	}

	// 创建验证器并验证
	validator := NewBackupValidator(filePath, format)
	result := validator.ValidateBackupFile()

	c.JSON(http.StatusOK, gin.H{
		"validation_result": result,
	})
}

// VerifyBackupChecksumHandler 验证备份文件校验和API
func VerifyBackupChecksumHandler(c *gin.Context) {
	// 检查管理员权限
	if !checkAdminPermission(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "需要管理员权限"})
		return
	}

	filename := c.Param("filename")
	if filename == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "文件名不能为空"})
		return
	}

	// 安全检查文件名
	if !isValidFilename(filename) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的文件名"})
		return
	}

	cfg := config.Load()
	filePath := filepath.Join(cfg.BackupPath, filename)

	// 验证校验和
	isValid, err := VerifyBackupChecksum(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "校验和验证失败",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"filename":       filename,
		"checksum_valid": isValid,
	})
}

// CleanupCorruptedBackups 清理损坏的备份文件API
func CleanupCorruptedBackupsHandler(c *gin.Context) {
	// 检查管理员权限
	if !checkAdminPermission(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "需要管理员权限"})
		return
	}

	// 执行清理
	cleanedCount, err := CleanupCorruptedBackups()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "清理失败",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "清理完成",
		"cleaned_count": cleanedCount,
	})
}

// RepairBackupFile 修复备份文件API
func RepairBackupFileHandler(c *gin.Context) {
	// 检查管理员权限
	if !checkAdminPermission(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "需要管理员权限"})
		return
	}

	filename := c.Param("filename")
	if filename == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "文件名不能为空"})
		return
	}

	// 安全检查文件名
	if !isValidFilename(filename) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的文件名"})
		return
	}

	cfg := config.Load()
	filePath := filepath.Join(cfg.BackupPath, filename)

	// 尝试修复
	err := RepairBackupFile(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "修复失败",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "文件修复成功",
		"filename": filename,
	})
}

// BatchValidateBackups 批量验证备份文件API
func BatchValidateBackups(c *gin.Context) {
	// 检查管理员权限
	if !checkAdminPermission(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "需要管理员权限"})
		return
	}

	// 获取参数
	onlyInvalid := c.DefaultQuery("only_invalid", "false")
	showOnlyInvalid, _ := strconv.ParseBool(onlyInvalid)

	// 获取备份列表
	backupList, err := getBackupFileList()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "获取备份列表失败",
			"details": err.Error(),
		})
		return
	}

	var results []map[string]interface{}
	validCount := 0
	invalidCount := 0

	// 验证每个备份文件
	for _, backup := range backupList {
		format := "json"
		if filepath.Ext(backup.Filename) == ".sql" {
			format = "sql"
		}

		validator := NewBackupValidator(backup.FilePath, format)
		result := validator.ValidateBackupFile()

		if result.IsValid {
			validCount++
		} else {
			invalidCount++
		}

		// 根据参数决定是否包含此结果
		if !showOnlyInvalid || !result.IsValid {
			results = append(results, map[string]interface{}{
				"filename":          backup.Filename,
				"validation_result": result,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"summary": map[string]interface{}{
			"total_files":   len(backupList),
			"valid_files":   validCount,
			"invalid_files": invalidCount,
		},
		"results": results,
	})
}
