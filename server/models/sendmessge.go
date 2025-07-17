package models

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/dootask/tools/go/utils"
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

// SendMessageWithToken 用指定 token 给多个用户发送消息
func SendMessageWithToken(userIDs []int, token string, date string, timeSlots []string, roomName string) {
	client := utils.NewClient(token)
	user, err := client.GetUserInfo()
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
	msg := fmt.Sprintf("## 📢 会议提醒\n\n**您有新的会议安排，请按时参加！**\n\n会议室：%s\n会议时间：%s\n会议发起人：%s", roomName, meetingTime, nickname)
	for _, userID := range userIDs {
		response, err := client.SendBotMessage(userID, msg)
		if err != nil {
			fmt.Printf("发送消息给用户%d失败: %v\n", userID, err)
			continue
		}
		fmt.Printf("消息发送成功: %+v\n", response)
	}
}
