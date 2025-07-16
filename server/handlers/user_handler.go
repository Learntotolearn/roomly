package handlers

import (
    "net/http"
    "strconv"
    "roomly/models"
    "github.com/gin-gonic/gin"
    "fmt"
)

// 会议通知推送接口，支持参数：userid[]、date、time_slots[]、room_name
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
    fmt.Printf("收到发送消息请求，userIDs: %v, date: %s, timeSlots: %v, roomName: %s\n", userIDs, date, timeSlots, roomName)
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
    models.SendMessageWithToken(userIDs, token, date, timeSlots, roomName)
    c.JSON(http.StatusOK, gin.H{"status": "ok"})
} 