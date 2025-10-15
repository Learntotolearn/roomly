package handlers

import (
	"fmt"
	"net/http"
	"roomly/database"
	"roomly/models"
	"strings"

	dootask "github.com/dootask/tools/server/go"
	"github.com/gin-gonic/gin"
)

// 更新预定参会人员
func UpdateBookingUsers(c *gin.Context) {
	bookingID := c.Param("id")

	// 解析请求体
	type updateBookingUsersRequest struct {
		BookingUsers []models.BookingUser `json:"booking_users" binding:"required"`
	}
	var req updateBookingUsersRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	// 检查预定是否存在且有效
	var booking models.Booking
	if err := database.DB.First(&booking, bookingID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Booking not found"})
		return
	}

	// 检查预定是否有效
	if booking.Status != "active" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot update participants for non-active booking"})
		return
	}

	// 获取原有参会人员信息（在事务开始前获取）
	var originalBookingUsers []models.BookingUser
	if err := database.DB.Where("booking_id = ?", bookingID).Find(&originalBookingUsers).Error; err != nil {

		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get original booking users"})
		return
	}

	// 开始事务
	tx := database.DB.Begin()

	// 删除原有参会人员
	if err := tx.Where("booking_id = ?", bookingID).Delete(&models.BookingUser{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update booking users"})
		return
	}

	// 添加新的参会人员
	for _, user := range req.BookingUsers {

		// 创建新的参会人员记录，确保设置正确的BookingID
		bookingUser := models.BookingUser{
			BookingID: booking.ID,
			Userid:    user.Userid,
			Nickname:  user.Nickname,
		}

		if err := tx.Create(&bookingUser).Error; err != nil {

			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create booking user: " + err.Error()})
			return
		}
	}

	// 提交事务
	tx.Commit()

	// 获取更新后的预定信息
	database.DB.Preload("Room").Preload("Member").Preload("BookingUsers").First(&booking, bookingID)

	// 从header获取token
	authHeader := c.GetHeader("Authorization")
	var token string
	if len(authHeader) > 0 {
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			token = authHeader[7:]
		} else {
			token = authHeader
		}
	}

	// 获取会议室名称
	var room models.Room
	roomName := ""
	if err := database.DB.First(&room, booking.RoomID).Error; err == nil {
		roomName = room.Name
	}

	// 组装时间段
	timeSlots := []string{booking.StartTime, booking.EndTime}

	// 查找所有会议室管理员 dootask_id
	var adminIDs []int
	var admins []models.Member
	database.DB.Where("is_room_admin = ?", true).Find(&admins)
	for _, admin := range admins {
		adminIDs = append(adminIDs, int(admin.DootaskID))
	}

	// 1. 识别被移除的参会人员
	var removedUserIDs []int
	var removedUserMap = make(map[uint]bool)
	// 记录被移除用户昵称，便于群组与管理员文案
	var removedUserNames []string

	// 创建新参会人员的映射，用于快速查找
	newUserMap := make(map[uint]bool)
	for _, user := range req.BookingUsers {
		newUserMap[user.Userid] = true
	}

	// 找出被移除的参会人员
	for _, originalUser := range originalBookingUsers {
		if !newUserMap[originalUser.Userid] {
			removedUserIDs = append(removedUserIDs, int(originalUser.Userid))
			removedUserMap[originalUser.Userid] = true
			removedUserNames = append(removedUserNames, originalUser.Nickname)
		}
	}

	// 2. 识别新增的参会人员
	var addedUserIDs []int

	// 创建原参会人员的映射，用于快速查找
	originalUserMap := make(map[uint]bool)
	for _, originalUser := range originalBookingUsers {
		originalUserMap[originalUser.Userid] = true
	}

	// 找出新增的参会人员
	var addedUserNames []string
	for _, user := range req.BookingUsers {
		if !originalUserMap[user.Userid] {
			addedUserIDs = append(addedUserIDs, int(user.Userid))
			addedUserNames = append(addedUserNames, user.Nickname)

		}
	}

	// 获取所有参会用户昵称（用于管理员通知）——以数据库最新记录为准
	var attendeeNames []string
	for _, bu := range booking.BookingUsers {
		attendeeNames = append(attendeeNames, bu.Nickname)
	}
	attendees := strings.Join(attendeeNames, "、")

	// 3. 向被移除的参会人员发送提醒（不再发送“会议已取消”）
	if len(removedUserIDs) > 0 {

		dt := models.NewDooTaskClient(token)

		// 机器人私信提醒每位被移除的参会者
		for _, uid := range removedUserIDs {
			_ = dt.SendBotMessage(uint(uid), fmt.Sprintf(`## 📢  会议室通知
### 提示：您已被移出会议
- 会议室：%s，
- 时间：%s %s-%s`, roomName, booking.Date, booking.StartTime, booking.EndTime))
		}

		// 同步群聊成员：移除被删除的用户
		if int(booking.DialogID) > 0 {
			for _, uid := range removedUserIDs {
				_ = dt.Client.RemoveGroupUser(dootask.RemoveGroupUserRequest{
					DialogID: int(booking.DialogID),
					UserIDs:  []int{uid},
				})
			}
			// 在群组中发送“参会人员更新”普通消息，避免出现“会议已取消”的误导性提示
			removedList := strings.Join(removedUserNames, "、")
			groupMsg := fmt.Sprintf(`## 📢  参会人员变更

- 会议室：%s
- 时间：%s %s
- 移除：%s
- 当前参会人员：%s`, roomName, booking.Date, strings.Join(timeSlots, "-"), removedList, attendees)
			_ = dt.Client.SendMessage(dootask.SendMessageRequest{
				DialogID: int(booking.DialogID),
				Text:     groupMsg,
			})

			// 给每位新增参会人员发送会议提醒（Markdown）
			meetingTime := fmt.Sprintf("%s %s", booking.Date, strings.Join(timeSlots, "-"))
			initiator := ""
			// 尝试使用发起人名称，如结构体无该字段则保持为空
			// models.Member 常见字段为 Name
			initiator = booking.Member.Name
			for _, uid := range addedUserIDs {
				msg := fmt.Sprintf(`## 📢  会议提醒
### **有新的会议安排，请按时参加！**

- **会议室**：%s
- **会议时间**：%s
- **参会人员**：%s
- **会议发起人**：%s`, roomName, meetingTime, attendees, initiator)
				_ = dt.SendBotMessage(uint(uid), msg)
			}
		}
	}

	// 4. 向新增的参会人员发送通知
	if len(addedUserIDs) > 0 {

		// 确保异步发送消息前所有数据都已准备好
		addedUserIDsCopy := make([]int, len(addedUserIDs))
		copy(addedUserIDsCopy, addedUserIDs)

		adminIDsCopy := make([]int, len(adminIDs))
		copy(adminIDsCopy, adminIDs)

		tokenCopy := token
		dateCopy := booking.Date
		timeSlotsCopy := make([]string, len(timeSlots))
		copy(timeSlotsCopy, timeSlots)
		roomNameCopy := roomName

		attendeesCopy := attendees

		// 复制新增/移除昵称，供管理员提醒文案使用
		addedUserNamesCopy := make([]string, len(addedUserNames))
		copy(addedUserNamesCopy, addedUserNames)
		removedUserNamesCopy := make([]string, len(removedUserNames))
		copy(removedUserNamesCopy, removedUserNames)

		// 在进入异步发送消息前，同步将新增用户加入群聊
		if int(booking.DialogID) > 0 {
			dt := models.NewDooTaskClient(tokenCopy)
			for _, uid := range addedUserIDsCopy {
				_ = dt.Client.AddGroupUser(dootask.AddGroupUserRequest{
					DialogID: int(booking.DialogID),
					UserIDs:  []int{uid},
				})
			}
			// 群内汇总文案：参会人员更新（新增）
			addedList := strings.Join(addedUserNamesCopy, "、")
			groupMsg := fmt.Sprintf(`## 📢  参会人员变更
- 会议室：%s
- 时间：%s %s
- 新增：%s
- 当前参会人员：%s`, roomNameCopy, dateCopy, strings.Join(timeSlotsCopy, "-"), addedList, attendeesCopy)
			_ = dt.Client.SendMessage(dootask.SendMessageRequest{
				DialogID: int(booking.DialogID),
				Text:     groupMsg,
			})
		}

		// 使用goroutine确保消息发送不会阻塞API响应
		go func() {
			// 管理员机器人提醒已禁用，避免发送人员变动通知

		}()
	} else {

	}

	c.JSON(http.StatusOK, booking)
}
