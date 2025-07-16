package models

import (
	"fmt"
	"github.com/dootask/tools/go/utils"
)

// SendMessageWithToken 用指定 token 给多个用户发送消息
func SendMessageWithToken(userIDs []int, token string) {
	
	for _, userID := range userIDs {
		client := utils.NewClient(token, "http://localhost")
		response, err := client.SendBotMessage(userID, "## 温馨提示\n\n**您有新的会议，请及时查看。**", "md","meeting-alert")
		if err != nil {
			fmt.Printf("发送消息给用户%d失败: %v\n", userID, err)
			continue
		}
		fmt.Printf("消息发送成功: %+v\n", response)
	}
}