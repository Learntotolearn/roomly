package handlers

import (
	"net/http"
	"strconv"
	"time"

	"roomly/database"
	"roomly/models"

	"github.com/gin-gonic/gin"
)

// GetBackupLogs 获取备份操作日志
func GetBackupLogs(c *gin.Context) {
	// 检查管理员权限
	if !checkAdminPermission(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "需要管理员权限"})
		return
	}

	// 获取分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	operation := c.Query("operation") // backup, restore, delete
	status := c.Query("status")       // success, failed, in_progress

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize

	// 构建查询
	query := database.DB.Model(&models.BackupLog{})

	// 添加过滤条件
	if operation != "" {
		query = query.Where("operation = ?", operation)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	// 获取总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取日志总数失败"})
		return
	}

	// 获取日志列表
	var logs []models.BackupLog
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取日志列表失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"logs":        logs,
		"total":       total,
		"page":        page,
		"page_size":   pageSize,
		"total_pages": (total + int64(pageSize) - 1) / int64(pageSize),
	})
}

// GetBackupLogDetail 获取备份日志详情
func GetBackupLogDetail(c *gin.Context) {
	// 检查管理员权限
	if !checkAdminPermission(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "需要管理员权限"})
		return
	}

	logID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的日志ID"})
		return
	}

	var log models.BackupLog
	if err := database.DB.First(&log, uint(logID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "日志不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"log": log})
}

// DeleteBackupLogs 清理旧的备份日志
func DeleteBackupLogs(c *gin.Context) {
	// 检查管理员权限
	if !checkAdminPermission(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "需要管理员权限"})
		return
	}

	// 获取参数
	daysStr := c.DefaultQuery("days", "30") // 默认删除30天前的日志
	days, err := strconv.Atoi(daysStr)
	if err != nil || days < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的天数参数"})
		return
	}

	// 计算截止时间
	cutoffTime := time.Now().AddDate(0, 0, -days)

	// 删除旧日志
	result := database.DB.Where("created_at < ?", cutoffTime).Delete(&models.BackupLog{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "清理日志失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "日志清理完成",
		"deleted_count": result.RowsAffected,
		"cutoff_date":   cutoffTime.Format("2006-01-02 15:04:05"),
	})
}
