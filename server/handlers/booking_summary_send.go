package handlers

import (
	"net/http"
	"roomly/database"
	"roomly/models"

	dootask "github.com/dootask/tools/server/go"
	"github.com/gin-gonic/gin"
)

// SendBookingSummaryToGroup 将会议纪要发送到当前会议的群组（DialogID）
// 路径：POST /api/bookings/:id/summary/send
// 请求体（可选）：{"summary_content": "..."}，为空则回退读取 booking.SummaryContent
func SendBookingSummaryToGroup(c *gin.Context) {
	bookingID := c.Param("id")

	// 查询预定
	var booking models.Booking
	if err := database.DB.First(&booking, bookingID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Booking not found"})
		return
	}

	// 校验 DialogID
	if booking.DialogID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "该会议未绑定群组（DialogID 为空）"})
		return
	}

	// 解析请求体中的纪要内容（可选）
	var req struct {
		SummaryContent string `json:"summary_content"`
	}
	_ = c.ShouldBindJSON(&req)

	content := req.SummaryContent
	if content == "" {
		content = booking.SummaryContent
	}
	if content == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "会议纪要内容为空"})
		return
	}

	// 获取 token
	authHeader := c.GetHeader("Authorization")
	var token string
	if len(authHeader) > 0 {
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			token = authHeader[7:]
		} else {
			token = authHeader
		}
	}
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "缺少授权信息"})
		return
	}

	// 发送群消息（默认 Markdown）
	dt := models.NewDooTaskClient(token)
	if err := dt.Client.SendMessage(dootask.SendMessageRequest{
		DialogID: booking.DialogID,
		Text:     content,
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "发送会议纪要失败", "detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    "ok",
		"dialog_id": booking.DialogID,
		"sent":      true,
	})
}
