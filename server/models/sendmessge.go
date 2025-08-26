package models

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	dootask "github.com/dootask/tools/server/go"
)

func getEndTime(start string) string {
	parts := strings.Split(start, ":")
	hour, _ := strconv.Atoi(parts[0])
	minute, _ := strconv.Atoi(parts[1])
	minute += 30
	if minute >= 60 {
		minute -= 60
		hour += 1
	}
	// 特殊处理：如果是 0 点，显示为 24:00
	if hour == 0 && minute == 0 {
		return "24:00"
	}
	return fmt.Sprintf("%02d:%02d", hour, minute)
}

// DooTaskClient 封装 dootask.Client
// 你可以将它放到 utils.go 或单独文件
// 这里只做内嵌实现

type DooTaskClient struct {
	Client *dootask.Client
}

func NewDooTaskClient(token string) DooTaskClient {
	return DooTaskClient{Client: dootask.NewClient(token)}
}

func (d *DooTaskClient) SendBotMessage(userID uint, message string) error {
	if userID == 0 {
		return errors.New("userID is required")
	}
	return d.Client.SendBotMessage(dootask.SendBotMessageRequest{
		UserID:  int(userID),
		Text:    message,
		BotType: "dootask-meeting",
		BotName: "会议室通知",
	})
}

// SendMessageWithToken 用指定 token 给多个用户发送消息，msgType 支持 'remind'（会议提醒）、'cancel'（会议取消）、'summary'（会议纪要），如有 msgContent 则优先用自定义内容
func SendMessageWithToken(userIDs []int, adminIDs []int, token string, date string, timeSlots []string, roomName string, msgType string, reason string, attendees string, msgContent ...string) {
	client := NewDooTaskClient(token)
	user, err := client.Client.GetUserInfo()
	var nickname string
	if err == nil {
		nickname = user.Nickname
		if user.Profession != "" {
			nickname = nickname + " (" + user.Profession + ")"
		}
	} else {
		nickname = ""
	}

	meetingTime := date
	if len(timeSlots) > 0 {
		start := timeSlots[0]
		end := getEndTime(timeSlots[len(timeSlots)-1])
		meetingTime = fmt.Sprintf("%s %s-%s", date, start, end)
	}
	// 通知所有参会人员
	var msg string
	switch msgType {
	case "cancel":
		// 获取取消理由
		cancelReason := ""
		if len(msgContent) > 0 {
			cancelReason = msgContent[0]
		}

		cancelReasonSection := ""
		if cancelReason != "" {
			cancelReasonSection = fmt.Sprintf("\n- **会议取消理由**：%s", cancelReason)
		}

		msg = fmt.Sprintf(`## ❌  会议取消通知
### **您参与的会议已被取消**

- **会议室**：%s
- **原定时间**：%s
- **参会人员**：%s
- **会议发起人**：%s%s

> 如有疑问请联系会议发起人或管理员。`, roomName, meetingTime, attendees, nickname, cancelReasonSection)
	case "summary":
		// 获取会议纪要内容
		summaryContent := ""
		if len(msgContent) > 0 {
			summaryContent = msgContent[0]
		}

		summarySection := ""
		if summaryContent != "" {
			summarySection = fmt.Sprintf("\n\n### **会议纪要内容**\n%s", summaryContent)
		}
		
		msg = fmt.Sprintf(`%s
`, summarySection)
	default:
		// 添加预定理由到会议提醒消息中
		reasonSection := ""
		if reason != "" {
			reasonSection = fmt.Sprintf("\n- **预定理由**：%s", reason)
		}
		msg = fmt.Sprintf(`## 📢  会议提醒
### **您有新的会议安排，请按时参加！**

- **会议室**：%s
- **会议时间**：%s
- **参会人员**：%s
- **会议发起人**：%s%s`, roomName, meetingTime, attendees, nickname, reasonSection)
	}
	// 对 userIDs 去重
	userIDMap := make(map[int]struct{})
	var uniqueUserIDs []int
	for _, id := range userIDs {
		if _, exists := userIDMap[id]; !exists {
			userIDMap[id] = struct{}{}
			uniqueUserIDs = append(uniqueUserIDs, id)
		}
	}
	// 对 adminIDs 去重
	adminIDMap := make(map[int]struct{})
	var uniqueAdminIDs []int
	for _, id := range adminIDs {
		if _, exists := adminIDMap[id]; !exists {
			adminIDMap[id] = struct{}{}
			uniqueAdminIDs = append(uniqueAdminIDs, id)
		}
	}
	for _, userID := range uniqueUserIDs {
		err := client.SendBotMessage(uint(userID), msg)
		if err != nil {
			fmt.Printf("发送消息给用户%d失败: %v, %s\n", userID, err, nickname)
			continue
		}
		fmt.Printf("消息发送成功: %d, %s\n", userID, nickname)
	}

	// 通知所有会议室管理员
	for _, adminID := range uniqueAdminIDs {
		adminToken := token
		adminClient := NewDooTaskClient(adminToken)
		var adminMsg string
		switch msgType {
		case "cancel":
			// 获取取消理由
			cancelReason := ""
			if len(msgContent) > 0 {
				cancelReason = msgContent[0]
			}

			cancelReasonSection := ""
			if cancelReason != "" {
				cancelReasonSection = fmt.Sprintf("\n- **会议取消理由**：%s", cancelReason)
			}

			adminMsg = fmt.Sprintf(`## ❌  会议室预定取消提醒
### **有会议室预定被取消，请关注。**

- **会议室**：%s
- **原定时间**：%s
- **会议室预定人**：%s%s`, roomName, meetingTime, nickname, cancelReasonSection)
		default:
			// 添加预定理由到管理员通知消息中
			reasonSection := ""
			if reason != "" {
				reasonSection = fmt.Sprintf("\n- **预定理由**：%s", reason)
			}
			adminMsg = fmt.Sprintf(`## 📢  会议室新预定提醒
### **会议室有新预定，请关注。**

- **会议室**：%s
- **时间**：%s
- **会议室预定人**：%s%s
`, roomName, meetingTime, nickname, reasonSection)
		}
		err := adminClient.SendBotMessage(uint(adminID), adminMsg)
		if err != nil {
			fmt.Printf("发送消息给管理员%d失败: %v, %s\n", adminID, err, nickname)
			continue
		}
		fmt.Printf("管理员消息发送成功: %+v, %s\n", adminID, nickname)
	}
}
