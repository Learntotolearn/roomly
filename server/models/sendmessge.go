package models

import (
	"fmt"

	"github.com/dootask/tools/go/utils"
)

// SendMessageWithToken 用指定 token 给多个用户发送消息
func SendMessageWithToken(userIDs []int, token string, date string, timeSlots []string, roomName string) {
	// 优雅地格式化会议时间
	meetingTime := date
	if len(timeSlots) == 1 {
		meetingTime = fmt.Sprintf("%s %s", date, timeSlots[0])
	} else if len(timeSlots) > 1 {
		meetingTime = fmt.Sprintf("%s %s-%s", date, timeSlots[0], timeSlots[len(timeSlots)-1])
	}
	msg := fmt.Sprintf("## 📢 温馨提示\n\n**您有新的会议，请按时参加。**\n\n会议时间：%s\n会议地点：%s", meetingTime, roomName)

	for _, userID := range userIDs {
		client := utils.NewClient(token)
		response, err := client.SendBotMessage(userID, msg, "md","meeting-alert")
		if err != nil {
			fmt.Printf("发送消息给用户%d失败: %v\n", userID, err)
			continue
		}
		fmt.Printf("消息发送成功: %+v\n", response)
	}
}