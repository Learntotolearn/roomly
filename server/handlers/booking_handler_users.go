package handlers

import (
	"fmt"
	"net/http"
	"os"
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
		fmt.Printf("Error fetching original booking users: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get original booking users"})
		return
	}
	fmt.Printf("Original booking users: %+v\n", originalBookingUsers)

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
			fmt.Printf("Error creating booking user: %v\n", err)
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
			fmt.Printf("Found new participant: %s (ID: %d)\n", user.Nickname, user.Userid)
		}
	}

	fmt.Printf("Added user IDs: %v\n", addedUserIDs)
	fmt.Printf("Added user names: %v\n", addedUserNames)

	// 获取所有参会用户昵称（用于管理员通知）
	var attendeeNames []string
	for _, user := range req.BookingUsers {
		attendeeNames = append(attendeeNames, user.Nickname)
	}
	attendees := strings.Join(attendeeNames, "、")

	// 3. 向被移除的参会人员发送通知
	if len(removedUserIDs) > 0 {
		fmt.Printf("Sending cancellation notice to removed users: %v\n", removedUserIDs)
		// 在现有群组内发送取消通知与 Notice，并向管理员发机器人提醒
		meetingTime := fmt.Sprintf("%s %s-%s", booking.Date, booking.StartTime, booking.EndTime)
		_ = models.SendCancelNotifications(int(booking.DialogID), roomName, meetingTime, attendees, "您已被移出此会议", token, []int{})
	}

	// 4. 向新增的参会人员发送通知
	if len(addedUserIDs) > 0 {
		fmt.Printf("Sending invitation to new users: %v\n", addedUserIDs)

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

		// 使用goroutine确保消息发送不会阻塞API响应
		go func() {
			fmt.Printf("Actually sending messages to: %v\n", addedUserIDsCopy)
			// 直接在现有群组内发送新增参会人通知，避免重复创建群
			dt := models.NewDooTaskClient(tokenCopy)
			_ = dt.Client.SendMessage(dootask.SendMessageRequest{
				DialogID: int(booking.DialogID),
				Text:     "您已被添加到此会议",
			})
			// 可选：管理员机器人提醒
			if len(adminIDsCopy) > 0 {
				adminMsg := fmt.Sprintf("会议参会人员更新：%s %s-%s，新增：%s", roomNameCopy, dateCopy, strings.Join(timeSlotsCopy, "-"), attendeesCopy)
				botToken := os.Getenv("MEETING_BOT_TOKEN")
				if botToken == "" {
					botToken = tokenCopy
				}
				adminClient := models.NewDooTaskClient(botToken)
				seen := make(map[int]struct{})
				for _, adminID := range adminIDsCopy {
					if _, ok := seen[adminID]; ok {
						continue
					}
					seen[adminID] = struct{}{}
					_ = adminClient.SendBotMessage(uint(adminID), adminMsg)
				}
			}
			fmt.Printf("Messages sent successfully to new participants\n")
		}()
	} else {
		fmt.Printf("No new participants to notify\n")
	}

	c.JSON(http.StatusOK, booking)
}
