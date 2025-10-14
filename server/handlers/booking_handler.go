package handlers

import (
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"roomly/database"
	"roomly/models"

	dootask "github.com/dootask/tools/server/go"

	"github.com/gin-gonic/gin"
)

func GetBookings(c *gin.Context) {
	// 解析分页参数
	pageStr := c.DefaultQuery("page", "1")
	pageSizeStr := c.DefaultQuery("page_size", "20")
	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}

	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize < 1 {
		pageSize = 20
	}

	// 解析日期筛选参数
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	status := c.Query("status")

	// 解析排序参数
	sortBy := c.DefaultQuery("sort_by", "date")
	sortOrder := c.DefaultQuery("sort_order", "desc")
	orderStr := "id desc"
	switch sortBy {
	case "date":
		orderStr = "date " + sortOrder + ", start_time " + sortOrder
	case "room":
		orderStr = "room_id " + sortOrder
	case "member":
		orderStr = "member_id " + sortOrder
	case "created":
		orderStr = "created_at " + sortOrder
	}

	var total int64
	db := database.DB.Model(&models.Booking{})
	if startDate != "" {
		db = db.Where("date >= ?", startDate)
	}
	if endDate != "" {
		db = db.Where("date <= ?", endDate)
	}
	// 修复：支持expired状态
	if status == "active" {
		db = db.Where("status = ?", "active")
	} else if status == "expired" {
		db = db.Where("status = ?", "expired")
	} else if status == "cancelled" {
		db = db.Where("status = ?", "cancelled")
	}
	db.Count(&total)

	var bookings []models.Booking
	db = db.Preload("Room").Preload("Member").Preload("BookingUsers").Order(orderStr).Limit(pageSize).Offset((page - 1) * pageSize)
	if err := db.Find(&bookings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch bookings"})
		return
	}

	// 实时检查并更新过期状态
	bookings = CheckAndUpdateExpiredBookings(bookings)

	c.JSON(http.StatusOK, gin.H{
		"data":  bookings,
		"total": total,
	})
}

// 获取指定会员的预定记录
func GetMemberBookings(c *gin.Context) {
	memberID := c.Param("id")

	// 解析分页参数
	pageStr := c.DefaultQuery("page", "1")
	pageSizeStr := c.DefaultQuery("page_size", "20")
	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}
	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize < 1 {
		pageSize = 20
	}

	// 新增：解析分组参数
	status := c.DefaultQuery("status", "")

	var total int64
	db := database.DB.Model(&models.Booking{}).Where("member_id = ?", memberID)

	// 新增：分组过滤
	if status == "active" {
		db = db.Where("status = ?", "active")
	} else if status == "expired" {
		db = db.Where("status = ?", "expired")
	} else if status == "cancelled" {
		db = db.Where("status = ?", "cancelled")
	}
	db.Count(&total)

	var bookings []models.Booking
	db = db.Preload("Room").Preload("Member").Preload("BookingUsers").Order("id desc").Limit(pageSize).Offset((page - 1) * pageSize)
	if err := db.Find(&bookings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch member bookings"})
		return
	}

	// 实时检查并更新过期状态
	bookings = CheckAndUpdateExpiredBookings(bookings)

	c.JSON(http.StatusOK, gin.H{
		"data":  bookings,
		"total": total,
	})
}

// 获取指定会议室的预定记录
func GetRoomBookings(c *gin.Context) {
	roomID := c.Param("id")
	var bookings []models.Booking
	if err := database.DB.Where("room_id = ?", roomID).Preload("Room").Preload("Member").Preload("BookingUsers").Find(&bookings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room bookings"})
		return
	}
	c.JSON(http.StatusOK, bookings)
}

// 获取指定日期和会议室的可用时间段
func GetAvailableSlots(c *gin.Context) {
	roomIDStr := c.Query("room_id")
	date := c.Query("date")

	if roomIDStr == "" || date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "room_id and date are required"})
		return
	}

	// 验证日期格式
	if _, err := time.Parse("2006-01-02", date); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date format, use YYYY-MM-DD"})
		return
	}

	// 解析 room_id 为数值，避免类型不匹配导致查询不到占用记录
	rid, err := strconv.Atoi(roomIDStr)
	if err != nil || rid <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room_id"})
		return
	}

	// 获取该日期该会议室的所有预定（可选：排除当前预定，用于修改时间不把自身标记为占用）
	var bookings []models.Booking
	excludeIDStr := c.Query("exclude_booking_id")
	// DEBUG: 请求参数
	fmt.Printf("[AvailableSlots DEBUG] rid=%d date=%s exclude_booking_id=%s\n", rid, date, excludeIDStr)
	db := database.DB.Where("room_id = ? AND date = ? AND status = ?", rid, date, "active")
	if excludeIDStr != "" {
		if excludeID, err := strconv.Atoi(excludeIDStr); err == nil && excludeID > 0 {
			db = db.Where("id <> ?", excludeID)
		}
	}
	if err := db.Find(&bookings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch bookings"})
		return
	}
	// DEBUG: 打印当天该房间的 active 预定列表
	for _, b := range bookings {
		fmt.Printf("[AvailableSlots DEBUG] booking_id=%d room_id=%d date=%s start=%s end=%s status=%s\n",
			b.ID, b.RoomID, b.Date, b.StartTime, b.EndTime, b.Status)
	}

	// 生成所有可能的时间段（24小时，每30分钟一个时间段）
	allSlots := generateAllTimeSlots()

	// 标记已被预定的时间段
	slotsWithBookingStatus := markBookedSlots(allSlots, bookings)

	// DEBUG: 统计被标记为占用的时段数量，并重点打印 23:30 这一格
	bookedCount := 0
	slot2330Booked := "N/A"
	for _, s := range slotsWithBookingStatus {
		if s.IsBooked {
			bookedCount++
		}
		if s.Start == "23:30" {
			slot2330Booked = fmt.Sprintf("%v", s.IsBooked)
		}
	}
	fmt.Printf("[AvailableSlots DEBUG] bookedCount=%d slot[23:30].is_booked=%s (date=%s room_id=%s)\n", bookedCount, slot2330Booked, date, c.Query("room_id"))

	c.JSON(http.StatusOK, models.AvailableSlots{
		Date:      date,
		TimeSlots: slotsWithBookingStatus,
	})
}

// 创建预定
func CreateBooking(c *gin.Context) {
	var request models.BookingRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 验证日期格式
	if _, err := time.Parse("2006-01-02", request.Date); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date format, use YYYY-MM-DD"})
		return
	}

	// 验证预定不能超过30天
	requestDate, _ := time.Parse("2006-01-02", request.Date)
	if requestDate.After(time.Now().AddDate(0, 0, 30)) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot book more than 30 days in advance"})
		return
	}

	// 验证时间段连续性
	if !areTimeSlotsConsecutive(request.TimeSlots) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Time slots must be consecutive"})
		return
	}

	// 检查时间段是否可用
	if !areSlotsAvailable(request.RoomID, request.Date, request.TimeSlots) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Some time slots are already booked"})
		return
	}

	// 创建预定记录
	startTime := request.TimeSlots[0]
	endTime := getEndTime(request.TimeSlots[len(request.TimeSlots)-1])

	booking := models.Booking{
		RoomID:    request.RoomID,
		MemberID:  request.MemberID,
		Date:      request.Date,
		StartTime: startTime,
		EndTime:   endTime,
		Reason:    request.Reason,
		Status:    "active",
	}

	if err := database.DB.Create(&booking).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create booking"})
		return
	}

	for _, user := range request.BookingUsers {
		bookingUser := models.BookingUser{
			BookingID: booking.ID,
			Userid:    user.Userid,
			Nickname:  user.Nickname,
		}
		if err := database.DB.Create(&bookingUser).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create booking user"})
			return
		}
	}

	// 返回包含关联数据的预定记录
	database.DB.Preload("Room").Preload("Member").Preload("BookingUsers").First(&booking, booking.ID)

	// 获取所有参会用户ID
	var userIDs []int
	for _, user := range request.BookingUsers {
		userIDs = append(userIDs, int(user.Userid))
	}
	// 查找所有会议室管理员 dootask_id
	var adminIDs []int
	var admins []models.Member
	database.DB.Where("is_room_admin = ?", true).Find(&admins)
	for _, admin := range admins {
		adminIDs = append(adminIDs, int(admin.DootaskID))
	}
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
	if err := database.DB.First(&room, request.RoomID).Error; err == nil {
		roomName = room.Name
	}
	// 获取所有参会用户昵称
	var attendeeNames []string
	for _, user := range request.BookingUsers {
		attendeeNames = append(attendeeNames, user.Nickname)
	}
	attendees := strings.Join(attendeeNames, "、")
	// 异步创建群组并发送会议通知 + 管理员机器人通知
	go func() {
		// 1) 群组通知（预定者身份）
		dialogID, err := models.CreateGroupAndNotify(userIDs, token, request.Date, request.TimeSlots, roomName, request.Reason, attendees)
		if err != nil {
			fmt.Printf("创建群组通知失败: %v\n", err)
		} else {
			// 保存群组ID到数据库
			booking.DialogID = dialogID
			database.DB.Save(&booking)
			fmt.Printf("群组创建成功，DialogID: %d\n", dialogID)
		}

		// 2) 管理员机器人通知：优先用环境变量 MEETING_BOT_TOKEN（无则回退当前 token）
		botToken := os.Getenv("MEETING_BOT_TOKEN")
		if botToken == "" {
			botToken = token
		}
		adminClient := models.NewDooTaskClient(botToken)

		// 计算会议时间区间（用于文案）
		meetingTime := fmt.Sprintf("%s %s-%s", request.Date, request.TimeSlots[0], getEndTime(request.TimeSlots[len(request.TimeSlots)-1]))

		// 获取预定者昵称（用于文案）：通过当前用户 token 查询 dootask 用户信息
		bookerName := ""
		userClient := models.NewDooTaskClient(token)
		u, uErr := userClient.Client.GetUserInfo()
		if uErr == nil && u.Nickname != "" {
			bookerName = u.Nickname
			if u.Profession != "" {
				bookerName = bookerName + " (" + u.Profession + ")"
			}
		}

		reasonSection := ""
		if request.Reason != "" {
			reasonSection = fmt.Sprintf("\n- **预定理由**：%s", request.Reason)
		}

		adminMsg := fmt.Sprintf(`## 📢  会议室新预定提醒
### **会议室有新预定，请关注。**

- **会议室**：%s
- **时间**：%s
- **会议室预定人**：%s%s
`, roomName, meetingTime, bookerName, reasonSection)

		// 去重并逐个发送机器人通知
		seen := make(map[int]struct{})
		for _, adminID := range adminIDs {
			if _, ok := seen[adminID]; ok {
				continue
			}
			seen[adminID] = struct{}{}
			if err := adminClient.SendBotMessage(uint(adminID), adminMsg); err != nil {
				fmt.Printf("管理员机器人消息发送失败: adminID=%d, err=%v\n", adminID, err)
			}
		}
	}()

	c.JSON(http.StatusCreated, booking)
}

/*
*
修改预定时间（仅 active 状态允许）
请求体：{ "date": "YYYY-MM-DD", "time_slots": ["HH:MM", ...] } （连续的30分钟刻）
规则：
- 验证日期格式与连续性
- 冲突检测：排除自身预定，与同房间同日期的其它 active 预定不重叠
*/
func RescheduleBooking(c *gin.Context) {
	id := c.Param("id")

	var payload struct {
		Date         string   `json:"date" binding:"required"`
		TimeSlots    []string `json:"time_slots" binding:"required"`
		ChangeReason string   `json:"change_reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	// 验证日期
	if _, err := time.Parse("2006-01-02", payload.Date); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date format, use YYYY-MM-DD"})
		return
	}
	// 验证连续性
	if !areTimeSlotsConsecutive(payload.TimeSlots) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Time slots must be consecutive"})
		return
	}

	// 查询原预定
	var booking models.Booking
	if err := database.DB.Preload("Room").Preload("Member").Preload("BookingUsers").First(&booking, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Booking not found"})
		return
	}
	// 仅 active 允许修改
	if booking.Status != "active" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only active bookings can be rescheduled"})
		return
	}

	// 检查新时间段是否可用（排除自身）
	if !areSlotsAvailableExcludeBooking(booking.RoomID, payload.Date, payload.TimeSlots, booking.ID) {
		c.JSON(http.StatusConflict, gin.H{"error": "Time slots conflict"})
		return
	}

	// 计算新开始/结束时间
	startTime := payload.TimeSlots[0]
	endTime := getEndTime(payload.TimeSlots[len(payload.TimeSlots)-1])

	// 更新
	booking.Date = payload.Date
	booking.StartTime = startTime
	booking.EndTime = endTime

	if err := database.DB.Save(&booking).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update booking"})
		return
	}

	// 返回包含关联数据
	database.DB.Preload("Room").Preload("Member").Preload("BookingUsers").First(&booking, booking.ID)

	// 修改时间成功后，重新发送会议通知（变更提醒）
	// 收集参会人员 userIDs
	var userIDs []int
	for _, user := range booking.BookingUsers {
		userIDs = append(userIDs, int(user.Userid))
	}
	// 收集会议室管理员 dootask_id
	var adminIDs []int
	var admins []models.Member
	database.DB.Where("is_room_admin = ?", true).Find(&admins)
	for _, admin := range admins {
		adminIDs = append(adminIDs, int(admin.DootaskID))
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
	// 会议室名称
	roomName := ""
	if booking.Room.Name != "" {
		roomName = booking.Room.Name
	}
	// 参会人昵称拼接
	var attendeeNames []string
	for _, user := range booking.BookingUsers {
		attendeeNames = append(attendeeNames, user.Nickname)
	}
	attendees := strings.Join(attendeeNames, "、")
	// 异步处理：不创建新群组，在原群组修改名称并发送“时间变更”通知；无群组则创建
	go func() {
		dt := models.NewDooTaskClient(token)

		// 新会议时间字符串与群组新名称
		meetingTime := fmt.Sprintf("%s %s-%s", booking.Date, booking.StartTime, booking.EndTime)
		newGroupName := fmt.Sprintf("会议群组 - %s - %s", roomName, meetingTime)

		if booking.DialogID > 0 {
			// 修改群组名称
			_ = dt.Client.EditGroup(dootask.EditGroupRequest{
				DialogID: booking.DialogID,
				ChatName: newGroupName,
			})
			// 在原群组发送“时间变更”通知（包含变更理由）
			reasonSection := ""
			if payload.ChangeReason != "" {
				reasonSection = fmt.Sprintf("\n- **时间变更理由**：%s", payload.ChangeReason)
			}
			_ = dt.Client.SendMessage(dootask.SendMessageRequest{
				DialogID: booking.DialogID,
				Text: fmt.Sprintf(`## 🔄  会议时间变更通知
### **您参与的会议时间已更新，请留意新的安排**

- **会议室**：%s
- **新的会议时间**：%s
- **参会人员**：%s%s

> 若您无法按新时间参加，请尽快与会议发起人或管理员沟通。`, roomName, meetingTime, attendees, reasonSection),
			})
		} else {
			// 无群组则创建并通知（回退策略）
			_, _ = models.CreateGroupAndNotify(userIDs, token, booking.Date, []string{booking.StartTime, booking.EndTime}, roomName, booking.Reason, attendees)
		}

		// 管理员机器人通知（保持与新预定一致）
		botToken := os.Getenv("MEETING_BOT_TOKEN")
		if botToken == "" {
			botToken = token
		}
		adminClient := models.NewDooTaskClient(botToken)

		// 预定者昵称（用于文案）
		bookerName := ""
		u, uErr := dt.Client.GetUserInfo()
		if uErr == nil && u.Nickname != "" {
			bookerName = u.Nickname
			if u.Profession != "" {
				bookerName = bookerName + " (" + u.Profession + ")"
			}
		}

		// 管理员通知文案（包含变更理由）
		reasonSection := ""
		if payload.ChangeReason != "" {
			reasonSection = fmt.Sprintf("\n- **时间变更理由**：%s", payload.ChangeReason)
		}
		adminMsg := fmt.Sprintf(`## 🔄  会议室预定变更提醒
### **会议室预定时间已更新，请关注。**

- **会议室**：%s
- **新的时间**：%s
- **会议室预定人**：%s%s
`, roomName, meetingTime, bookerName, reasonSection)

		// 去重并逐个发送机器人通知
		seen := make(map[int]struct{})
		for _, adminID := range adminIDs {
			if _, ok := seen[adminID]; ok {
				continue
			}
			seen[adminID] = struct{}{}
			if err := adminClient.SendBotMessage(uint(adminID), adminMsg); err != nil {
				fmt.Printf("管理员机器人消息发送失败: adminID=%d, err=%v\n", adminID, err)
			}
		}
	}()

	c.JSON(http.StatusOK, booking)
}

// 取消预定
func CancelBooking(c *gin.Context) {
	id := c.Param("id")

	// 解析请求体，获取取消理由
	var request struct {
		CancelReason string `json:"cancel_reason"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// 验证取消理由必填
	if request.CancelReason == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "取消理由不能为空"})
		return
	}

	var booking models.Booking
	if err := database.DB.Preload("BookingUsers").Preload("Room").First(&booking, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Booking not found"})
		return
	}

	// 幂等性校验
	if booking.Status == "cancelled" {
		c.JSON(http.StatusOK, gin.H{"message": "Booking already cancelled"})
		return
	}

	booking.Status = "cancelled"
	booking.CancelReason = request.CancelReason
	if err := database.DB.Save(&booking).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel booking"})
		return
	}

	// 获取所有参会人员 userID
	var userIDs []int
	for _, user := range booking.BookingUsers {
		userIDs = append(userIDs, int(user.Userid))
	}
	// 查找所有会议室管理员 dootask_id
	var adminIDs []int
	var admins []models.Member
	database.DB.Where("is_room_admin = ?", true).Find(&admins)
	for _, admin := range admins {
		adminIDs = append(adminIDs, int(admin.DootaskID))
	}
	fmt.Printf("adminIDs: %v\n", adminIDs)
	// 获取会议室名称
	roomName := ""
	if booking.Room.Name != "" {
		roomName = booking.Room.Name
	}
	// 拼接参会人昵称
	var attendeeNames []string
	for _, u := range booking.BookingUsers {
		attendeeNames = append(attendeeNames, u.Nickname)
	}
	attendees := strings.Join(attendeeNames, "、")

	// 获取 token
	authHeader := c.GetHeader("Authorization")
	var token string
	if len(authHeader) > 0 {
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			token = authHeader[7:]
		} else {
			token = authHeader
		}
	}
	// 发送取消通知（消息内容由 sendmessge.go 内部组装）
	if len(userIDs) > 0 {
		// 在会议群组内发送“会议已取消”的通知

		go func() {
			if booking.DialogID > 0 {
				meetingTime := fmt.Sprintf("%s %s-%s", booking.Date, booking.StartTime, booking.EndTime)
				_ = models.SendCancelNotifications(booking.DialogID, roomName, meetingTime, attendees, request.CancelReason, token, adminIDs)
			}
		}()
	}

	c.JSON(http.StatusOK, gin.H{"message": "Booking cancelled successfully"})
}

// 生成所有时间段 (00:00 - 23:30)
func generateAllTimeSlots() []models.TimeSlot {
	var slots []models.TimeSlot
	for hour := 0; hour < 24; hour++ {
		for minute := 0; minute < 60; minute += 30 {
			start := fmt.Sprintf("%02d:%02d", hour, minute)
			end := getEndTime(start)
			slots = append(slots, models.TimeSlot{
				Start:    start,
				End:      end,
				IsBooked: false, // 默认未预定
			})
		}
	}
	return slots
}

// 获取结束时间（增加30分钟）
func getEndTime(startTime string) string {
	parts := strings.Split(startTime, ":")
	hour, _ := strconv.Atoi(parts[0])
	minute, _ := strconv.Atoi(parts[1])

	minute += 30
	if minute >= 60 {
		minute -= 60
		hour += 1
		if hour >= 24 {
			hour = 0
		}
	}

	return fmt.Sprintf("%02d:%02d", hour, minute)
}

// 过滤可用时间段
func filterAvailableSlots(allSlots []models.TimeSlot, bookings []models.Booking) []models.TimeSlot {
	var availableSlots []models.TimeSlot

	for _, slot := range allSlots {
		isAvailable := true
		for _, booking := range bookings {
			if isTimeSlotOverlap(slot, booking) {
				isAvailable = false
				break
			}
		}
		if isAvailable {
			availableSlots = append(availableSlots, slot)
		}
	}

	return availableSlots
}

// 检查时间段是否重叠
func isTimeSlotOverlap(slot models.TimeSlot, booking models.Booking) bool {
	// 处理跨越午夜的情况
	slotStart := timeToMinutes(slot.Start)
	slotEnd := timeToMinutes(slot.End)
	bookingStart := timeToMinutes(booking.StartTime)
	bookingEnd := timeToMinutes(booking.EndTime)

	// 如果时间段跨越午夜，调整结束时间
	if slotEnd == 0 && slotStart > 0 {
		slotEnd = 24 * 60 // 24:00 转换为分钟
	}
	if bookingEnd == 0 && bookingStart > 0 {
		bookingEnd = 24 * 60 // 24:00 转换为分钟
	}

	return slotStart < bookingEnd && slotEnd > bookingStart
}

// 将时间字符串转换为分钟数
func timeToMinutes(timeStr string) int {
	parts := strings.Split(timeStr, ":")
	hour, _ := strconv.Atoi(parts[0])
	minute, _ := strconv.Atoi(parts[1])
	return hour*60 + minute
}

// 检查时间段是否连续
func areTimeSlotsConsecutive(timeSlots []string) bool {
	if len(timeSlots) <= 1 {
		return true
	}

	for i := 0; i < len(timeSlots)-1; i++ {
		if getEndTime(timeSlots[i]) != timeSlots[i+1] {
			return false
		}
	}

	return true
}

// 检查时间段是否可用（排除指定 bookingID）
func areSlotsAvailableExcludeBooking(roomID uint, date string, timeSlots []string, excludeBookingID uint) bool {
	// 获取该日期该会议室的所有 active 预定（排除自身）
	var bookings []models.Booking
	if err := database.DB.
		Where("room_id = ? AND date = ? AND status = ? AND id <> ?", roomID, date, "active", excludeBookingID).
		Find(&bookings).Error; err != nil {
		return false
	}

	for _, slotTime := range timeSlots {
		slot := models.TimeSlot{
			Start: slotTime,
			End:   getEndTime(slotTime),
		}
		for _, booking := range bookings {
			if isTimeSlotOverlap(slot, booking) {
				return false
			}
		}
	}
	return true
}

// 检查时间段是否可用
func areSlotsAvailable(roomID uint, date string, timeSlots []string) bool {
	// 获取该日期该会议室的所有预定
	var bookings []models.Booking
	if err := database.DB.Where("room_id = ? AND date = ? AND status = ?", roomID, date, "active").Find(&bookings).Error; err != nil {
		return false
	}

	// 检查每个时间段是否与现有预定重叠
	for _, slotTime := range timeSlots {
		slot := models.TimeSlot{
			Start: slotTime,
			End:   getEndTime(slotTime),
		}

		// 检查是否与任何预定重叠
		for _, booking := range bookings {
			if isTimeSlotOverlap(slot, booking) {
				return false
			}
		}
	}

	return true
}

// 标记已被预定的时间段
func markBookedSlots(allSlots []models.TimeSlot, bookings []models.Booking) []models.TimeSlot {
	var slotsWithStatus []models.TimeSlot

	for _, slot := range allSlots {
		slotCopy := slot
		slotCopy.IsBooked = false

		// 检查该时间段是否与任何预定记录重叠
		for _, booking := range bookings {
			if isTimeSlotOverlap(slot, booking) {
				slotCopy.IsBooked = true
				break
			}
		}

		slotsWithStatus = append(slotsWithStatus, slotCopy)
	}

	return slotsWithStatus
}

func isBookingExpired(booking models.Booking) bool {
	// 解析预定日期
	bookingDate, err := time.Parse("2006-01-02", booking.Date)
	if err != nil {
		return false
	}

	// 处理结束时间，特别是24:00和跨日00:00的情况
	var endTime time.Time
	if booking.EndTime == "24:00" {
		// 24:00表示当天的24点，即次日的00:00:00
		endTime = time.Date(bookingDate.Year(), bookingDate.Month(), bookingDate.Day()+1,
			0, 0, 0, 0, bookingDate.Location())
	} else if booking.EndTime == "00:00" {
		// 对于00:00结束时间，使用逻辑推理判断是否跨日
		// 解析开始时间
		startTimeStr := booking.StartTime + ":00"
		parsedStartTime, err := time.Parse("15:04:05", startTimeStr)
		if err != nil {
			return false
		}

		// 逻辑推理：如果开始时间不是00:00，且结束时间是00:00，则认为是跨日预订
		if parsedStartTime.Hour() > 0 || parsedStartTime.Minute() > 0 {
			// 跨日：结束时间是次日的00:00:00
			endTime = time.Date(bookingDate.Year(), bookingDate.Month(), bookingDate.Day()+1,
				0, 0, 0, 0, bookingDate.Location())
		} else {
			// 同日：00:00-00:00的特殊情况（理论上不应该存在）
			endTime = time.Date(bookingDate.Year(), bookingDate.Month(), bookingDate.Day(),
				0, 0, 0, 0, bookingDate.Location())
		}
	} else {
		// 解析结束时间
		endTimeStr := booking.EndTime + ":00"
		parsedTime, err := time.Parse("15:04:05", endTimeStr)
		if err != nil {
			return false
		}
		// 组合日期和时间
		endTime = time.Date(bookingDate.Year(), bookingDate.Month(), bookingDate.Day(),
			parsedTime.Hour(), parsedTime.Minute(), parsedTime.Second(), 0, bookingDate.Location())
	}

	return booking.Status == "active" && endTime.Before(time.Now())
}

// 保存会议纪要
func SaveMeetingSummary(c *gin.Context) {
	bookingID := c.Param("id")

	// 解析请求体
	var req struct {
		SummaryContent string `json:"summary_content" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// 检查预定是否存在
	var booking models.Booking
	if err := database.DB.First(&booking, bookingID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Booking not found"})
		return
	}

	// 更新预定的会议纪要字段
	if err := database.DB.Model(&booking).Update("summary_content", req.SummaryContent).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save meeting summary"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Meeting summary saved successfully"})
}

// 获取会议纪要
func GetMeetingSummary(c *gin.Context) {
	bookingID := c.Param("id")

	// 检查预定是否存在
	var booking models.Booking
	if err := database.DB.First(&booking, bookingID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Booking not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"summary_content": booking.SummaryContent})
}
