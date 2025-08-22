package handlers

import (
	"net/http"
	"roomly/models"
	"strconv"

	"github.com/gin-gonic/gin"
)

// 会议通知推送接口，支持参数：userid[]、date、time_slots[]、room_name、reason
// 由预约流程或相关业务自动调用
func SendMessageToUsers(c *gin.Context) {
	// 兼容 userid[] 和 userid 两种参数
	userIDStrs := c.QueryArray("userid[]")
	if len(userIDStrs) == 0 {
		userIDStrs = c.QueryArray("userid")
	}
	var userIDs []int
	for _, idStr := range userIDStrs {
		id, err := strconv.Atoi(idStr)
		if err == nil {
			userIDs = append(userIDs, id)
		}
	}
	date := c.Query("date")
	timeSlots := c.QueryArray("time_slots[]")
	roomName := c.Query("room_name")
	reason := c.Query("reason") // 新增预定理由参数
	if len(userIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "用户ID不能为空"})
		return
	}
	// 从 header 获取 token
	authHeader := c.GetHeader("Authorization")
	var token string
	if len(authHeader) > 0 {
		// 兼容 Bearer token
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			token = authHeader[7:]
		} else {
			token = authHeader
		}
	}
	// 异步发送会议通知
	models.SendMessageWithToken(userIDs, []int{}, token, date, timeSlots, roomName, "remind", reason, "")
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// 会议纪要通知推送接口，支持参数：userid[]、date、time_slots[]、room_name、summary_content
// 由会议纪要生成流程调用
func SendMeetingSummary(c *gin.Context) {
	// 兼容 userid[] 和 userid 两种参数
	userIDStrs := c.QueryArray("userid[]")
	if len(userIDStrs) == 0 {
		userIDStrs = c.QueryArray("userid")
	}
	var userIDs []int
	for _, idStr := range userIDStrs {
		id, err := strconv.Atoi(idStr)
		if err == nil {
			userIDs = append(userIDs, id)
		}
	}
	date := c.Query("date")
	timeSlots := c.QueryArray("time_slots[]")
	roomName := c.Query("room_name")
	summaryContent := c.Query("summary_content") // 会议纪要内容
	if len(userIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "用户ID不能为空"})
		return
	}
	// 从 header 获取 token
	authHeader := c.GetHeader("Authorization")
	var token string
	if len(authHeader) > 0 {
		// 兼容 Bearer token
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			token = authHeader[7:]
		} else {
			token = authHeader
		}
	}
	// 异步发送会议纪要通知
	models.SendMessageWithToken(userIDs, []int{}, token, date, timeSlots, roomName, "summary", "", "", summaryContent)
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// 会议纪要通知推送接口（POST JSON）
// 请求体示例：{"user_ids":[1,2],"summary_content":"...","date":"2025-08-22","time_slots":["15:00","15:30"],"room_name":"A会议室"}
func SendMeetingSummaryPost(c *gin.Context) {
	var req struct {
		UserIDs        []int    `json:"user_ids"`
		Date           string   `json:"date"`
		TimeSlots      []string `json:"time_slots"`
		RoomName       string   `json:"room_name"`
		SummaryContent string   `json:"summary_content"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	if len(req.UserIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "用户ID不能为空"})
		return
	}

	// 从 header 获取 token
	authHeader := c.GetHeader("Authorization")
	var token string
	if len(authHeader) > 0 {
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			token = authHeader[7:]
		} else {
			token = authHeader
		}
	}

	models.SendMessageWithToken(req.UserIDs, []int{}, token, req.Date, req.TimeSlots, req.RoomName, "summary", "", "", req.SummaryContent)
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
