package handlers

import (
    "net/http"
    "strconv"
    "roomly/models"
    "github.com/gin-gonic/gin"
)

// GET /api/users/basic
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
    models.SendMessageWithToken(userIDs, token)
    c.JSON(http.StatusOK, gin.H{"status": "ok"})
} 