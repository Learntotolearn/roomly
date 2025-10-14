package main

import (
	"log"
	"os"
	"time"

	"roomly/database"
	"roomly/models"
	"roomly/routes"
)

func main() {
	// 设置时区为 Asia/Shanghai
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		log.Fatal("Failed to load timezone:", err)
	}
	time.Local = loc

	// 初始化数据库
	database.InitDB()

	// 修复错误标记为过期的预订
	FixWronglyExpiredBookings()

	// 已改为前端触发扫描过期与通知，禁用后端定时任务以避免竞争
	// go func() {
	// 	for {
	// 		UpdateExpiredBookings()
	// 		time.Sleep(1 * time.Minute) // 每分钟检查一次
	// 	}
	// }()

	// 设置路由
	r := routes.SetupRoutes()

	// 获取端口，默认为8090
	port := os.Getenv("PORT")
	if port == "" {
		port = "8090"
	}

	// 启动服务器
	log.Printf("服务器启动在端口 %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal("服务器启动失败:", err)
	}
}

// 计算预订的结束时间
func calculateBookingEndTime(booking models.Booking) (time.Time, error) {
	// 获取上海时区
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		loc = time.Local // 如果加载失败，使用本地时区
	}

	// 解析预定日期，并设置为上海时区
	bookingDate, err := time.ParseInLocation("2006-01-02", booking.Date, loc)
	if err != nil {
		return time.Time{}, err
	}

	// 处理结束时间，特别是24:00和跨日00:00的情况
	var endTime time.Time
	if booking.EndTime == "24:00" {
		// 24:00表示当天的24点，即次日的00:00:00
		endTime = time.Date(bookingDate.Year(), bookingDate.Month(), bookingDate.Day()+1,
			0, 0, 0, 0, loc)
	} else if booking.EndTime == "00:00" {
		// 对于00:00结束时间，使用逻辑推理判断是否跨日
		// 解析开始时间
		startTimeStr := booking.StartTime + ":00"
		parsedStartTime, err := time.Parse("15:04:05", startTimeStr)
		if err != nil {
			return time.Time{}, err
		}

		// 逻辑推理：如果开始时间不是00:00，且结束时间是00:00，则认为是跨日预订
		if parsedStartTime.Hour() > 0 || parsedStartTime.Minute() > 0 {
			// 跨日：结束时间是次日的00:00:00
			endTime = time.Date(bookingDate.Year(), bookingDate.Month(), bookingDate.Day()+1,
				0, 0, 0, 0, loc)
		} else {
			// 同日：00:00-00:00的特殊情况（理论上不应该存在）
			endTime = time.Date(bookingDate.Year(), bookingDate.Month(), bookingDate.Day(),
				0, 0, 0, 0, loc)
		}
	} else {
		// 解析结束时间
		endTimeStr := booking.EndTime + ":00"
		parsedTime, err := time.Parse("15:04:05", endTimeStr)
		if err != nil {
			return time.Time{}, err
		}
		// 组合日期和时间，使用上海时区
		endTime = time.Date(bookingDate.Year(), bookingDate.Month(), bookingDate.Day(),
			parsedTime.Hour(), parsedTime.Minute(), parsedTime.Second(), 0, loc)
	}

	return endTime, nil
}

// 修复错误标记为过期的预订
func FixWronglyExpiredBookings() {
	// 获取上海时区的当前时间
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		loc = time.Local
	}
	now := time.Now().In(loc)

	var bookings []models.Booking
	database.DB.Model(&models.Booking{}).
		Where("status = ?", "expired").
		Find(&bookings)

	fixedCount := 0
	for _, booking := range bookings {
		endTime, err := calculateBookingEndTime(booking)
		if err != nil {
			continue
		}

		// 如果实际上还没过期，则修复状态
		if endTime.After(now) {
			booking.Status = "active"
			database.DB.Save(&booking)
			fixedCount++
		}
	}

}

// 定时任务：将已过期的active预定状态更新为expired，并发送会议结束通知
func UpdateExpiredBookings() {
	// 获取上海时区的当前时间
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		loc = time.Local
	}
	now := time.Now().In(loc)

	var activeBookings []models.Booking
	database.DB.Model(&models.Booking{}).
		Where("status = ?", "active").
		Find(&activeBookings)

	expiredCount := 0
	for _, booking := range activeBookings {
		endTime, err := calculateBookingEndTime(booking)
		if err != nil {
			continue
		}

		// 检查是否已过期（使用相同时区进行比较）
		if endTime.Before(now) || endTime.Equal(now) {
			// 如果状态还是active，说明刚刚过期，仅更新状态（通知统一由 /api/bookings/scan-expired 负责）
			if booking.Status == "active" {
				// 后台定时任务不再发送通知，避免无 token 情况下误触发
			}
			booking.Status = "expired"
			database.DB.Save(&booking)
			expiredCount++
		}
	}

	if expiredCount > 0 {
		log.Printf("更新了 %d 个过期会议状态", expiredCount)
	}
}

// sendMeetingEndNotification 发送会议结束通知
