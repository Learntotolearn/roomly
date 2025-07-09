package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"roomly/database"
	"roomly/models"

	"github.com/gin-gonic/gin"
)

// 获取所有预定记录
func GetBookings(c *gin.Context) {
	var bookings []models.Booking
	if err := database.DB.Preload("Room").Preload("Member").Find(&bookings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch bookings"})
		return
	}
	c.JSON(http.StatusOK, bookings)
}

// 获取指定会员的预定记录
func GetMemberBookings(c *gin.Context) {
	memberID := c.Param("id")
	var bookings []models.Booking
	if err := database.DB.Where("member_id = ?", memberID).Preload("Room").Preload("Member").Find(&bookings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch member bookings"})
		return
	}
	c.JSON(http.StatusOK, bookings)
}

// 获取指定会议室的预定记录
func GetRoomBookings(c *gin.Context) {
	roomID := c.Param("id")
	var bookings []models.Booking
	if err := database.DB.Where("room_id = ?", roomID).Preload("Room").Preload("Member").Find(&bookings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room bookings"})
		return
	}
	c.JSON(http.StatusOK, bookings)
}

// 获取指定日期和会议室的可用时间段
func GetAvailableSlots(c *gin.Context) {
	roomID := c.Query("room_id")
	date := c.Query("date")

	if roomID == "" || date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "room_id and date are required"})
		return
	}

	// 验证日期格式
	if _, err := time.Parse("2006-01-02", date); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date format, use YYYY-MM-DD"})
		return
	}

	// 获取该日期该会议室的所有预定
	var bookings []models.Booking
	if err := database.DB.Where("room_id = ? AND date = ? AND status = ?", roomID, date, "active").Find(&bookings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch bookings"})
		return
	}

	// 生成所有可能的时间段（24小时，每30分钟一个时间段）
	allSlots := generateAllTimeSlots()

	// 移除已被预定的时间段
	availableSlots := filterAvailableSlots(allSlots, bookings)

	c.JSON(http.StatusOK, models.AvailableSlots{
		Date:      date,
		TimeSlots: availableSlots,
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

	// 返回包含关联数据的预定记录
	database.DB.Preload("Room").Preload("Member").First(&booking, booking.ID)
	c.JSON(http.StatusCreated, booking)
}

// 取消预定
func CancelBooking(c *gin.Context) {
	id := c.Param("id")

	var booking models.Booking
	if err := database.DB.First(&booking, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Booking not found"})
		return
	}

	booking.Status = "cancelled"
	if err := database.DB.Save(&booking).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel booking"})
		return
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
				Start: start,
				End:   end,
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
	return slot.Start < booking.EndTime && slot.End > booking.StartTime
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

// 检查时间段是否可用
func areSlotsAvailable(roomID uint, date string, timeSlots []string) bool {
	for _, slot := range timeSlots {
		endTime := getEndTime(slot)

		var count int64
		database.DB.Model(&models.Booking{}).
			Where("room_id = ? AND date = ? AND status = ? AND start_time < ? AND end_time > ?",
				roomID, date, "active", endTime, slot).
			Count(&count)

		if count > 0 {
			return false
		}
	}

	return true
}
