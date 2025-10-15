package handlers

import (
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"roomly/database"
	"roomly/models"

	dootask "github.com/dootask/tools/server/go"
	"github.com/gin-gonic/gin"
)

// // 与 main.go 保持一致的结束时间计算（Asia/Shanghai）
//
//	func calculateBookingEndTime(b models.Booking) (time.Time, error) {
//		loc, err := time.LoadLocation("Asia/Shanghai")
//		if err != nil {
//			loc = time.Local
//		}
//		bookingDate, err := time.ParseInLocation("2006-01-02", b.Date, loc)
//		if err != nil {
//			return time.Time{}, err
//		}
//		var end time.Time
//		if b.EndTime == "24:00" {
//			end = time.Date(bookingDate.Year(), bookingDate.Month(), bookingDate.Day()+1, 0, 0, 0, 0, loc)
//		} else if b.EndTime == "00:00" {
//			startTimeStr := b.StartTime + ":00"
//			parsedStartTime, err := time.Parse("15:04:05", startTimeStr)
//			if err != nil {
//				return time.Time{}, err
//			}
//			if parsedStartTime.Hour() > 0 || parsedStartTime.Minute() > 0 {
//				end = time.Date(bookingDate.Year(), bookingDate.Month(), bookingDate.Day()+1, 0, 0, 0, 0, loc)
//			} else {
//				end = time.Date(bookingDate.Year(), bookingDate.Month(), bookingDate.Day(), 0, 0, 0, 0, loc)
//			}
//		} else {
//			endTimeStr := b.EndTime + ":00"
//			parsedTime, err := time.Parse("15:04:05", endTimeStr)
//			if err != nil {
//				return time.Time{}, err
//			}
//			end = time.Date(bookingDate.Year(), bookingDate.Month(), bookingDate.Day(), parsedTime.Hour(), parsedTime.Minute(), parsedTime.Second(), 0, loc)
//		}
//		return end, nil
//	}
//
// ScanExpiredBookings: 前端触发的扫描接口
// 逻辑：扫描所有 active 会议，若已过期，则更新为 expired 并在群组中发送“会议已结束”
func ScanExpiredBookings(c *gin.Context) {
	var activeBookings []models.Booking
	if err := database.DB.Where("status = ?", "active").Find(&activeBookings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch active bookings"})
		return
	}

	now := time.Now()
	expired := 0
	notified := 0

	// 优先使用前端传入的 Authorization 令牌；未提供则跳过通知，仅做过期状态更新
	authHeader := c.GetHeader("Authorization")

	var token string
	if len(authHeader) > 0 {
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			token = authHeader[7:]
		} else {
			token = authHeader
		}
	}
	// 规范化 token：去空格与去除首尾引号，避免认证失败
	token = strings.TrimSpace(token)
	token = strings.Trim(token, "\"'")
	skipNotify := false
	if token == "" {
		fmt.Printf("[scan-expired] Authorization 未提供，跳过群通知，仅更新过期状态\n")
		skipNotify = true
	} else {
		// Authorization token provided (logging suppressed)
	}
	// 记录 dootask server，用于排查连接目标是否正确
	server := os.Getenv("DOOTASK_SERVER")
	if server == "" {
		server = "http://127.0.0.1"
	}


	dt := models.NewDooTaskClient(token)

	for i := range activeBookings {
		booking := &activeBookings[i]

		// 判断是否过期（与 main.go 一致计算结束时间，使用 Asia/Shanghai）
		loc, _ := time.LoadLocation("Asia/Shanghai")
		nowLoc := time.Now().In(loc)
		endTime, eErr := calculateBookingEndTime(*booking)
		if eErr != nil {
			fmt.Printf("[scan-expired] 计算结束时间失败：id=%d err=%v\n", booking.ID, eErr)
			continue
		}
		isExpired := endTime.Before(nowLoc) || endTime.Equal(nowLoc)

		if !isExpired {
			continue
		}

		// 幂等：仅处理当前仍为 active 的记录
		if booking.Status != "active" {
			fmt.Printf("[scan-expired] 跳过发送：状态已非active id=%d current=%s\n", booking.ID, booking.Status)
			continue
		}

		// 发送“会议已结束”通知（有群组ID时）
		if !skipNotify && booking.DialogID > 0 {
			fmt.Printf("[scan-expired] 准备发送Notice: bookingID=%d dialog=%d content=%q\n", booking.ID, booking.DialogID, "会议已结束")
			// 在发送前验证 token，便于定位“身份已失效”问题
			if u, uErr := dt.Client.GetUserInfo(); uErr != nil {
				fmt.Printf("[scan-expired] token验证失败: %v\n", uErr)
			} else {
				fmt.Printf("[scan-expired] token验证成功: nickname=%s\n", u.Nickname)
			}
			// 按需求使用 Notice 通知“会议已结束”
			nErr := dt.Client.SendNoticeMessage(dootask.SendNoticeMessageRequest{
				DialogID: booking.DialogID,
				Notice:   "会议已结束",
			})
			if nErr != nil {
				fmt.Printf("[scan-expired] 发送群组Notice失败: bookingID=%d dialog=%d err=%v\n", booking.ID, booking.DialogID, nErr)
			} else {
				fmt.Printf("[scan-expired] 发送群组Notice成功: bookingID=%d dialog=%d\n", booking.ID, booking.DialogID)
				notified++
			}
		} else if skipNotify {
			fmt.Printf("[scan-expired] 跳过发送：缺少Authorization token bookingID=%d dialogID=%d\n", booking.ID, booking.DialogID)
		} else if booking.DialogID == 0 {
			fmt.Printf("[scan-expired] 跳过发送：无群组 dialogID=0 bookingID=%d\n", booking.ID)
		}

		// 更新状态为 expired（幂等）
		booking.Status = "expired"
		if err := database.DB.Save(booking).Error; err != nil {
			fmt.Printf("[scan-expired] 更新状态失败：bookingID=%d err=%v\n", booking.ID, err)
		}
		expired++
	}

	c.JSON(http.StatusOK, gin.H{
		"scanned":    len(activeBookings),
		"expired":    expired,
		"notified":   notified,
		"time":       now.Format(time.RFC3339),
		"tokenLen":   len(token),
		"server":     server,
		"skipNotify": skipNotify,
	})
}
