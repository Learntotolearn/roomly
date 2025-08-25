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

	// 启动定时任务，每5分钟更新一次已过期预定状态
	go func() {
		for {
			UpdateExpiredBookings()
			time.Sleep(5 * time.Minute)
		}
	}()

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

// 修复错误标记为过期的预订
func FixWronglyExpiredBookings() {
	now := time.Now()
	log.Printf("开始修复错误标记的过期预订，当前时间: %s", now.Format("2006-01-02 15:04:05"))

	var bookings []models.Booking
	database.DB.Model(&models.Booking{}).
		Where("status = ?", "expired").
		Find(&bookings)

	fixedCount := 0
	for _, booking := range bookings {
		// 解析预定日期
		bookingDate, err := time.Parse("2006-01-02", booking.Date)
		if err != nil {
			log.Printf("解析日期失败: %s, 错误: %v", booking.Date, err)
			continue
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
				log.Printf("解析开始时间失败: %s, 错误: %v", booking.StartTime, err)
				continue
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
				log.Printf("解析时间失败: %s, 错误: %v", booking.EndTime, err)
				continue
			}
			// 组合日期和时间
			endTime = time.Date(bookingDate.Year(), bookingDate.Month(), bookingDate.Day(),
				parsedTime.Hour(), parsedTime.Minute(), parsedTime.Second(), 0, bookingDate.Location())
		}

		// 调试日志
		log.Printf("检查已过期预订 ID:%d, 日期:%s, 时间:%s-%s, 结束时间:%s, 当前时间:%s, 是否应该过期:%v",
			booking.ID, booking.Date, booking.StartTime, booking.EndTime,
			endTime.Format("2006-01-02 15:04:05"), now.Format("2006-01-02 15:04:05"),
			endTime.Before(now))

		// 如果实际上还没过期，则修复状态
		if endTime.After(now) {
			log.Printf("修复预订状态为active: ID:%d, 日期:%s, 时间:%s-%s, 结束时间:%s",
				booking.ID, booking.Date, booking.StartTime, booking.EndTime, endTime.Format("2006-01-02 15:04:05"))

			booking.Status = "active"
			database.DB.Save(&booking)
			fixedCount++
		}
	}

	log.Printf("修复完成，共修复了 %d 个预订", fixedCount)
}

// 定时任务：将已过期的active预定状态更新为expired
func UpdateExpiredBookings() {
	now := time.Now()
	log.Printf("定时任务开始检查过期预订，当前时间: %s", now.Format("2006-01-02 15:04:05"))

	var activeBookings []models.Booking
	database.DB.Model(&models.Booking{}).
		Where("status = ?", "active").
		Find(&activeBookings)

	expiredCount := 0
	for _, booking := range activeBookings {
		// 解析预定日期
		bookingDate, err := time.Parse("2006-01-02", booking.Date)
		if err != nil {
			log.Printf("解析日期失败: %s, 错误: %v", booking.Date, err)
			continue
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
				log.Printf("解析开始时间失败: %s, 错误: %v", booking.StartTime, err)
				continue
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
				log.Printf("解析时间失败: %s, 错误: %v", booking.EndTime, err)
				continue
			}
			// 组合日期和时间
			endTime = time.Date(bookingDate.Year(), bookingDate.Month(), bookingDate.Day(),
				parsedTime.Hour(), parsedTime.Minute(), parsedTime.Second(), 0, bookingDate.Location())
		}

		// 调试日志
		log.Printf("检查预订 ID:%d, 日期:%s, 时间:%s-%s, 结束时间:%s, 当前时间:%s, 是否过期:%v",
			booking.ID, booking.Date, booking.StartTime, booking.EndTime,
			endTime.Format("2006-01-02 15:04:05"), now.Format("2006-01-02 15:04:05"),
			endTime.Before(now))

		// 检查是否已过期
		if endTime.Before(now) {
			log.Printf("标记预订为过期: ID:%d", booking.ID)
			booking.Status = "expired"
			database.DB.Save(&booking)
			expiredCount++
		}
	}

	log.Printf("定时任务完成，共标记 %d 个预订为过期", expiredCount)
}
