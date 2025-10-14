package models

import (
	"errors"
	"fmt"
	"os"
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
	Token  string
}

func NewDooTaskClient(token string) DooTaskClient {
	// 支持从环境变量读取 dootask 服务地址，默认 127.0.0.1
	server := os.Getenv("DOOTASK_SERVER")
	if server == "" {
		server = "http://127.0.0.1"
	}
	// 初始化日志，便于核对目标地址与令牌长度
	fmt.Printf("[dootask] init client server=%s tokenLen=%d\n", server, len(token))

	return DooTaskClient{
		Client: dootask.NewClient(token, dootask.WithServer(server)),
		Token:  token,
	}
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

// CreateGroupAndSendNotification 创建群组并发送会议通知
func (d *DooTaskClient) CreateGroupAndSendNotification(userIDs []int, roomName string, date string, timeSlots []string, reason string, attendees string) (int, error) {
	// 创建群组名称
	meetingTime := date
	if len(timeSlots) > 0 {
		start := timeSlots[0]
		end := getEndTime(timeSlots[len(timeSlots)-1])
		meetingTime = fmt.Sprintf("%s %s-%s", date, start, end)
	}
	groupName := fmt.Sprintf("会议群组 - %s - %s", roomName, meetingTime)

	// 创建群组
	createGroupRequest := dootask.CreateGroupRequest{
		ChatName: groupName,
		UserIDs:  userIDs,
	}

	groupInfo, err := d.Client.CreateGroup(createGroupRequest)
	if err != nil {
		return 0, fmt.Errorf("创建群组失败: %v", err)
	}

	fmt.Printf("群组创建成功: ID=%d, Name=%s\n", groupInfo.ID, groupInfo.Name)

	// 在群组中发送会议通知
	reasonSection := ""
	if reason != "" {
		reasonSection = fmt.Sprintf("\n- **预定理由**：%s", reason)
	}

	notificationMsg := fmt.Sprintf(`## 📢 会议通知
### **有新的会议安排，请按时参加！**

- **会议室**：%s
- **会议时间**：%s
- **参会人员**：%s%s

> 若无法参加，请尽快与会议发起人或管理员沟通。`, roomName, meetingTime, attendees, reasonSection)

	// 发送群组通知
	if err := d.sendGroupNotice(groupInfo.ID, notificationMsg); err != nil {
		fmt.Printf("发送群组通知失败: %v\n", err)
		// 即使通知发送失败，群组创建成功也算成功
	}

	return groupInfo.ID, nil
}

// sendGroupNotice 发送群组通知
func (d *DooTaskClient) sendGroupNotice(dialogID int, notice string) error {
	// 使用 SDK 发送群组文本消息（Markdown）
	req := dootask.SendMessageRequest{
		DialogID: dialogID,
		// TextType 留空将默认 "md"
		Text: notice,
	}
	var resp any
	if err := d.Client.SendMessage(req, &resp); err != nil {
		return fmt.Errorf("发送群组通知失败: %v", err)
	}
	fmt.Printf("群组通知发送成功: DialogID=%d\n", dialogID)
	return nil
}

// SendMeetingEndNotification 发送会议结束通知
func (d *DooTaskClient) SendMeetingEndNotification(dialogID int) error {
	return d.sendGroupNotice(dialogID, "会议结束")
}

// SendCancelNotifications 在群组内发送取消通知（Markdown）与“会议已取消”Notice，并给管理员发送机器人提醒
func SendCancelNotifications(dialogID int, roomName string, meetingTime string, attendees string, cancelReason string, token string, adminIDs []int) error {
	if dialogID <= 0 {
		return errors.New("invalid dialogID")
	}

	dt := NewDooTaskClient(token)

	reasonSection := ""
	cancelReason = strings.TrimSpace(cancelReason)
	if cancelReason != "" {
		reasonSection = fmt.Sprintf("\n- 取消理由：%s", cancelReason)
	}

	// 1) 群组文本消息：会议取消通知（Markdown）
	cancelMsg := fmt.Sprintf(`## ❌  会议取消通知
### **您参与的会议已被取消** 

- **会议室**：%s
- **原定时间**：%s
- **参会人员**：%s%s
`, roomName, meetingTime, attendees, reasonSection)
	if err := dt.Client.SendMessage(dootask.SendMessageRequest{
		DialogID: dialogID,
		Text:     cancelMsg,
	}); err != nil {
		return fmt.Errorf("发送群组取消通知失败: %v", err)
	}

	// 2) 群组 Notice：会议已取消
	notice := "会议已取消"
	if err := dt.Client.SendNoticeMessage(dootask.SendNoticeMessageRequest{
		DialogID: dialogID,
		Notice:   notice,
	}); err != nil {
		return fmt.Errorf("发送群组取消Notice失败: %v", err)
	}

	// 3) 管理员机器人通知：会议取消提醒
	// 获取预定者昵称（用于文案）
	bookerName := ""
	u, uErr := dt.Client.GetUserInfo()
	if uErr == nil && u.Nickname != "" {
		bookerName = u.Nickname
		if u.Profession != "" {
			bookerName = bookerName + " (" + u.Profession + ")"
		}
	}
	adminMsg := fmt.Sprintf(`## ❌  会议室预定取消提醒
### **有会议室预定被取消，请关注。**

- **会议室**：%s
- **原定时间**：%s
- **会议室预定人**：%s%s`, roomName, meetingTime, bookerName, reasonSection)

	// 机器人 token：优先 MEETING_BOT_TOKEN，无则回退当前 token
	botToken := os.Getenv("MEETING_BOT_TOKEN")
	if botToken == "" {
		botToken = token
	}
	adminClient := NewDooTaskClient(botToken)

	seen := make(map[int]struct{})
	for _, adminID := range adminIDs {
		if _, ok := seen[adminID]; ok {
			continue
		}
		seen[adminID] = struct{}{}
		if err := adminClient.SendBotMessage(uint(adminID), adminMsg); err != nil {
			// 不中断主流程，记录错误
			fmt.Printf("管理员机器人消息发送失败: adminID=%d, err=%v\n", adminID, err)
		}
	}

	return nil
}

// CreateGroupAndNotify 创建群组并发送会议通知（替代原来的机器人通知）
func CreateGroupAndNotify(userIDs []int, token string, date string, timeSlots []string, roomName string, reason string, attendees string) (int, error) {
	client := NewDooTaskClient(token)

	// 对 userIDs 去重
	userIDMap := make(map[int]struct{})
	var uniqueUserIDs []int
	for _, id := range userIDs {
		if _, exists := userIDMap[id]; !exists {
			userIDMap[id] = struct{}{}
			uniqueUserIDs = append(uniqueUserIDs, id)
		}
	}

	// 创建群组并发送通知
	dialogID, err := client.CreateGroupAndSendNotification(uniqueUserIDs, roomName, date, timeSlots, reason, attendees)
	if err != nil {
		return 0, fmt.Errorf("创建群组并发送通知失败: %v", err)
	}

	return dialogID, nil
}

// SendMessageWithToken 用指定 token 给多个用户发送消息，msgType 支持 'remind'（会议提醒）、'cancel'（会议取消）、'summary'（会议纪要），如有 msgContent 则优先用自定义内容
// 注意：此函数已废弃，请使用 CreateGroupAndNotify 替代
func SendMessageWithToken(userIDs []int, adminIDs []int, token string, date string, timeSlots []string, roomName string, msgType string, reason string, attendees string, msgContent ...string) {
	// 对于新的会议提醒，使用群组通知
	if msgType == "remind" {
		dialogID, err := CreateGroupAndNotify(userIDs, token, date, timeSlots, roomName, reason, attendees)
		if err != nil {
			fmt.Printf("创建群组通知失败: %v\n", err)
		} else {
			fmt.Printf("群组创建成功，DialogID: %d\n", dialogID)
		}

		// 在新预定时，管理员需要单独收到机器人通知
		meetingTime := date
		if len(timeSlots) > 0 {
			start := timeSlots[0]
			end := getEndTime(timeSlots[len(timeSlots)-1])
			meetingTime = fmt.Sprintf("%s %s-%s", date, start, end)
		}

		// 获取预定者昵称（可选）
		client := NewDooTaskClient(token)
		user, uErr := client.Client.GetUserInfo()
		nickname := ""
		if uErr == nil {
			nickname = user.Nickname
			if user.Profession != "" {
				nickname = nickname + " (" + user.Profession + ")"
			}
		}

		adminMsg := fmt.Sprintf(`## 📢  会议室新预定提醒
### **会议室有新预定，请关注。**

- **会议室**：%s
- **时间**：%s
- **会议室预定人**：%s`, roomName, meetingTime, nickname)

		// 机器人 token；若未配置则回退当前 token
		botToken := os.Getenv("MEETING_BOT_TOKEN")
		if botToken == "" {
			botToken = token
		}
		adminClient := NewDooTaskClient(botToken)
		for _, adminID := range adminIDs {
			_ = adminClient.SendBotMessage(uint(adminID), adminMsg)
		}

		return
	}

	// 对于其他类型的通知（取消、变更等），仍然使用机器人通知
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
	case "reschedule":
		// 会议时间变更提醒（目前仅展示新时间；如需旧→新，请在 msgContent[0] 传入旧时间）
		// 预留变更理由：使用 reason 字段（若需要专门的"变更理由"，可在后端调用时传入自定义内容）
		reasonSection := ""
		if reason != "" {
			reasonSection = fmt.Sprintf("\n- **预定理由**：%s", reason)
		}
		msg = fmt.Sprintf(`## 🔄  会议时间变更通知
### **您参与的会议时间已更新，请留意新的安排**

- **会议室**：%s
- **新的会议时间**：%s
- **参会人员**：%s
- **会议发起人**：%s%s

> 若您无法按新时间参加，请尽快与会议发起人或管理员沟通。`, roomName, meetingTime, attendees, nickname, reasonSection)
	default:
		// 添加预定理由到会议提醒消息中
		reasonSection := ""
		if reason != "" {
			reasonSection = fmt.Sprintf("\n- **预定理由**：%s", reason)
		}
		msg = fmt.Sprintf(`## 📢  会议提醒
### **有新的会议安排，请按时参加！**

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

	// 创建群组（参会者 + 管理员），并在群组中发送通知
	allIDMap := make(map[int]struct{})
	var allMemberIDs []int
	for _, id := range uniqueUserIDs {
		if _, exists := allIDMap[id]; !exists {
			allIDMap[id] = struct{}{}
			allMemberIDs = append(allMemberIDs, id)
		}
	}
	for _, id := range uniqueAdminIDs {
		if _, exists := allIDMap[id]; !exists {
			allIDMap[id] = struct{}{}
			allMemberIDs = append(allMemberIDs, id)
		}
	}

	groupName := fmt.Sprintf("会议群组 - %s - %s", roomName, meetingTime)
	groupInfo, gErr := client.Client.CreateGroup(dootask.CreateGroupRequest{
		ChatName: groupName,
		UserIDs:  allMemberIDs,
	})
	if gErr != nil {
		fmt.Printf("创建群组失败: %v\n", gErr)
		return
	}

	// 在群组中发送参会者通知
	_ = client.Client.SendMessage(dootask.SendMessageRequest{
		DialogID: groupInfo.ID,
		Text:     msg, // 默认 Markdown
	})

	// 管理员文案需单独发送，使用会议室机器人逐一发至管理员对话
	var adminMsg string
	switch msgType {
	case "cancel":
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
	case "reschedule":
		reasonSection := ""
		if reason != "" {
			reasonSection = fmt.Sprintf("\n- **预定理由**：%s", reason)
		}
		adminMsg = fmt.Sprintf(`## 🔄  会议室预定变更提醒
### **会议室预定时间已更新，请关注。**

- **会议室**：%s
- **新的时间**：%s
- **会议室预定人**：%s%s
`, roomName, meetingTime, nickname, reasonSection)
	default:
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

	// 机器人 token 从环境变量获取：MEETING_BOT_TOKEN；若未配置则回退为当前 token
	botToken := os.Getenv("MEETING_BOT_TOKEN")
	if botToken == "" {
		botToken = token
	}
	adminClient := NewDooTaskClient(botToken)
	for _, adminID := range uniqueAdminIDs {
		if err := adminClient.SendBotMessage(uint(adminID), adminMsg); err != nil {
			fmt.Printf("管理员机器人消息发送失败: adminID=%d, err=%v\n", adminID, err)
		}
	}
}
