package handlers

import (
	"fmt"
	"time"

	"roomly/database"
	"roomly/models"
)

// 实时检查并更新预订过期状态
func CheckAndUpdateExpiredBookings(bookings []models.Booking) []models.Booking {
	// 获取上海时区的当前时间
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		loc = time.Local
	}
	now := time.Now().In(loc)

	for i := range bookings {
		booking := &bookings[i]

		// 只检查active状态的预订
		if booking.Status != "active" {
			continue
		}

		// 计算预订结束时间
		endTime, err := calculateBookingEndTime(*booking)
		if err != nil {
			continue
		}

		// 检查是否已过期
		if endTime.Before(now) || endTime.Equal(now) {
			// 如果状态还是active，说明刚刚过期，仅更新状态（通知统一由 /api/bookings/scan-expired 负责）
			if booking.Status == "active" {
				// 后台实时路径不再发送通知，避免无 token 情况下误触发
			}
			booking.Status = "expired"
			// 立即更新数据库
			database.DB.Save(booking)
		}
	}

	return bookings
}

// 计算预订的结束时间（从main.go移动过来）
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

// 检查单个预订是否过期（不更新数据库）
func IsBookingExpired(booking models.Booking) bool {
	if booking.Status != "active" {
		return booking.Status == "expired"
	}

	endTime, err := calculateBookingEndTime(booking)
	if err != nil {
		return false
	}

	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		loc = time.Local
	}
	now := time.Now().In(loc)

	return endTime.Before(now) || endTime.Equal(now)
}

// sendMeetingEndNotification 发送会议结束通知
func sendMeetingEndNotification(booking models.Booking) {
	// 检查是否有群组ID
	if booking.DialogID == 0 {
		fmt.Printf("会议ID %d 没有群组ID，跳过发送结束通知\n", booking.ID)
		return
	}

	// 获取会议发起人的token（这里需要从数据库获取，暂时使用空字符串）
	// 在实际应用中，应该从Member表中获取对应的token
	var member models.Member
	if err := database.DB.First(&member, booking.MemberID).Error; err != nil {
		fmt.Printf("获取会议发起人信息失败: %v\n", err)
		return
	}

	// 实时路径缺少请求上下文与有效 token 来源，为避免误用写死 token或空 token，这里不直接发送通知。
	// 建议使用前端触发的 /api/bookings/scan-expired 接口进行统一通知（该接口已从 Authorization 获取并清洗 token）。
	fmt.Printf("[realtime] 跳过发送会议结束通知：无可用 token（请通过 scan-expired 接口统一发送） bookingID=%d dialogID=%d\n", booking.ID, booking.DialogID)
}
