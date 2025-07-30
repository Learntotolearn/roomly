package handlers

import (
	"net/http"
	"strconv"
	"time"

	"roomly/database"
	"roomly/models"

	"github.com/gin-gonic/gin"
)

// 获取会议纪要列表
func GetMinutes(c *gin.Context) {
	var minutes []models.MeetingMinutes

	query := database.DB.Preload("Booking").Preload("Creator").Preload("Updater")

	// 支持按预定ID筛选
	if bookingID := c.Query("booking_id"); bookingID != "" {
		if id, err := strconv.ParseUint(bookingID, 10, 32); err == nil {
			query = query.Where("booking_id = ?", id)
		}
	}

	// 支持按状态筛选
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	// 支持按创建者筛选
	if createdBy := c.Query("created_by"); createdBy != "" {
		if id, err := strconv.ParseUint(createdBy, 10, 32); err == nil {
			query = query.Where("created_by = ?", id)
		}
	}

	if err := query.Order("created_at DESC").Find(&minutes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取会议纪要失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": minutes})
}

// 获取单个会议纪要
func GetMinutesById(c *gin.Context) {
	id := c.Param("id")

	var minutes models.MeetingMinutes
	if err := database.DB.Preload("Booking").Preload("Creator").Preload("Updater").First(&minutes, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "会议纪要不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": minutes})
}

// 创建会议纪要
func CreateMinutes(c *gin.Context) {
	var request models.MinutesRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	// 验证预定是否存在
	var booking models.Booking
	if err := database.DB.First(&booking, request.BookingID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "预定记录不存在"})
		return
	}

	// 获取当前用户ID（这里需要根据实际的用户认证系统调整）
	currentUserID := uint(1) // 临时写死，实际应该从JWT或session中获取

	minutes := models.MeetingMinutes{
		BookingID:   request.BookingID,
		Title:       request.Title,
		Content:     request.Content,
		Summary:     request.Summary,
		KeyPoints:   request.KeyPoints,
		ActionItems: request.ActionItems,
		Status:      "draft",
		CreatedBy:   currentUserID,
		UpdatedBy:   currentUserID,
	}

	if err := database.DB.Create(&minutes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建会议纪要失败"})
		return
	}

	// 重新加载关联数据
	database.DB.Preload("Booking").Preload("Creator").Preload("Updater").First(&minutes, minutes.ID)

	c.JSON(http.StatusCreated, gin.H{"data": minutes})
}

// 更新会议纪要
func UpdateMinutes(c *gin.Context) {
	id := c.Param("id")

	var minutes models.MeetingMinutes
	if err := database.DB.First(&minutes, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "会议纪要不存在"})
		return
	}

	var request models.MinutesRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	// 获取当前用户ID
	currentUserID := uint(1) // 临时写死，实际应该从JWT或session中获取

	// 更新字段
	if request.Title != "" {
		minutes.Title = request.Title
	}
	if request.Content != "" {
		minutes.Content = request.Content
	}
	if request.Summary != "" {
		minutes.Summary = request.Summary
	}
	if request.KeyPoints != "" {
		minutes.KeyPoints = request.KeyPoints
	}
	if request.ActionItems != "" {
		minutes.ActionItems = request.ActionItems
	}
	if request.Status != "" {
		minutes.Status = request.Status
	}

	minutes.UpdatedBy = currentUserID
	minutes.UpdatedAt = time.Now()

	if err := database.DB.Save(&minutes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新会议纪要失败"})
		return
	}

	// 重新加载关联数据
	database.DB.Preload("Booking").Preload("Creator").Preload("Updater").First(&minutes, minutes.ID)

	c.JSON(http.StatusOK, gin.H{"data": minutes})
}

// 删除会议纪要
func DeleteMinutes(c *gin.Context) {
	id := c.Param("id")

	var minutes models.MeetingMinutes
	if err := database.DB.First(&minutes, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "会议纪要不存在"})
		return
	}

	if err := database.DB.Delete(&minutes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除会议纪要失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "删除成功"})
}

// 语音转文字处理
func ProcessSpeechToText(c *gin.Context) {
	var request models.SpeechToTextRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	// 验证预定是否存在
	var booking models.Booking
	if err := database.DB.First(&booking, request.BookingID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "预定记录不存在"})
		return
	}

	// 创建语音转文字记录
	speechToText := models.SpeechToText{
		BookingID: request.BookingID,
		AudioFile: request.AudioFile,
		Status:    "processing",
	}

	if err := database.DB.Create(&speechToText).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建语音转文字记录失败"})
		return
	}

	// 这里应该调用实际的语音识别服务
	// 为了演示，我们模拟一个异步处理过程
	go func(id uint) {
		time.Sleep(5 * time.Second)
		var stt models.SpeechToText
		if err := database.DB.First(&stt, id).Error; err == nil {
			stt.Status = "completed"
			stt.Text = "这是从语音识别得到的文本内容示例。实际应用中，这里应该是调用语音识别API的结果。"
			stt.UpdatedAt = time.Now()
			database.DB.Save(&stt)
		}
	}(speechToText.ID)

	c.JSON(http.StatusAccepted, gin.H{
		"data":    speechToText,
		"message": "语音转文字处理已开始，请稍后查询结果",
	})
}

// 获取语音转文字状态
func GetSpeechToTextStatus(c *gin.Context) {
	id := c.Param("id")

	var speechToText models.SpeechToText
	if err := database.DB.Preload("Booking").First(&speechToText, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "语音转文字记录不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": speechToText})
}

// 获取预定的会议纪要
func GetBookingMinutes(c *gin.Context) {
	bookingID := c.Param("id")

	var minutes []models.MeetingMinutes
	if err := database.DB.Preload("Creator").Preload("Updater").Where("booking_id = ?", bookingID).Order("created_at DESC").Find(&minutes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取会议纪要失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": minutes})
}
