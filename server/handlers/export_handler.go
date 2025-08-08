package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"roomly/database"
	"roomly/models"

	"github.com/gin-gonic/gin"
	"github.com/tealeg/xlsx"
)

// 导出预订记录到Excel
func ExportBookings(c *gin.Context) {
	// 获取查询参数
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	roomID := c.Query("room_id")
	memberID := c.Query("member_id")
	status := c.Query("status")

	// 构建查询
	query := database.DB.Model(&models.Booking{}).Preload("Room").Preload("Member").Preload("BookingUsers")

	if startDate != "" {
		query = query.Where("date >= ?", startDate)
	}
	if endDate != "" {
		query = query.Where("date <= ?", endDate)
	}
	if roomID != "" {
		query = query.Where("room_id = ?", roomID)
	}
	if memberID != "" {
		query = query.Where("member_id = ?", memberID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	// 执行查询
	var bookings []models.Booking
	if err := query.Find(&bookings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch bookings"})
		return
	}

	// 创建Excel文件
	file := xlsx.NewFile()
	sheet, err := file.AddSheet("预订记录")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create Excel sheet"})
		return
	}

	// 创建表头
	headerRow := sheet.AddRow()
	headers := []string{"预订ID", "会议室名称", "会员姓名", "预订日期", "开始时间", "结束时间", "参会人员", "预定理由", "取消理由", "状态", "创建时间"}
	for _, header := range headers {
		cell := headerRow.AddCell()
		cell.Value = header
		cell.GetStyle().Font.Bold = true
	}

	// 添加数据行
	for _, booking := range bookings {
		row := sheet.AddRow()

		// 预订ID
		row.AddCell().SetInt(int(booking.ID))

		// 会议室名称
		row.AddCell().SetString(booking.Room.Name)

		// 会员姓名
		row.AddCell().SetString(booking.Member.Name)

		// 预订日期
		row.AddCell().SetString(booking.Date)

		// 开始时间
		row.AddCell().SetString(booking.StartTime)

		// 结束时间
		row.AddCell().SetString(booking.EndTime)

		// 参会人员
		var userNames []string
		for _, user := range booking.BookingUsers {
			userNames = append(userNames, user.Nickname)
		}
		row.AddCell().SetString(strings.Join(userNames, ", "))

		// 预定理由
		row.AddCell().SetString(booking.Reason)

		// 取消理由
		row.AddCell().SetString(booking.CancelReason)

		// 状态
		statusText := "有效"
		if booking.Status == "cancelled" {
			statusText = "已取消"
		}
		row.AddCell().SetString(statusText)

		// 创建时间
		row.AddCell().SetString(booking.CreatedAt.Format("2006-01-02 15:04:05"))
	}

	// 设置列宽
	sheet.SetColWidth(0, 0, 8)    // 预订ID
	sheet.SetColWidth(1, 1, 15)   // 会议室名称
	sheet.SetColWidth(2, 2, 12)   // 会员姓名
	sheet.SetColWidth(3, 3, 12)   // 预订日期
	sheet.SetColWidth(4, 4, 10)   // 开始时间
	sheet.SetColWidth(5, 5, 10)   // 结束时间
	sheet.SetColWidth(6, 6, 25)   // 参会人员
	sheet.SetColWidth(7, 7, 25)   // 预定理由
	sheet.SetColWidth(8, 8, 25)   // 取消理由
	sheet.SetColWidth(9, 9, 8)    // 状态
	sheet.SetColWidth(10, 10, 20) // 创建时间

	// 生成文件名
	filename := fmt.Sprintf("预订记录_%s.xlsx", time.Now().Format("20060102_150405"))

	// 设置HTTP响应头
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("Cache-Control", "no-cache")

	// 写入响应
	if err := file.Write(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write Excel file"})
		return
	}
}

// 导出会议室使用统计
func ExportRoomUsage(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	// 构建查询
	query := `
		SELECT 
			r.name as room_name,
			r.capacity,
			COUNT(b.id) as booking_count,
			SUM(
				CASE 
					WHEN b.status = 'active' THEN 
						(strftime('%s', b.end_time) - strftime('%s', b.start_time)) / 3600.0 
					ELSE 0 
				END
			) as total_hours
		FROM rooms r
		LEFT JOIN bookings b ON r.id = b.room_id
	`

	args := []interface{}{}
	if startDate != "" && endDate != "" {
		query += " WHERE b.date BETWEEN ? AND ?"
		args = append(args, startDate, endDate)
	}

	query += " GROUP BY r.id, r.name, r.capacity ORDER BY booking_count DESC"

	// 执行查询
	type RoomUsage struct {
		RoomName     string  `json:"room_name"`
		Capacity     int     `json:"capacity"`
		BookingCount int     `json:"booking_count"`
		TotalHours   float64 `json:"total_hours"`
	}

	var usageStats []RoomUsage
	if err := database.DB.Raw(query, args...).Scan(&usageStats).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room usage statistics"})
		return
	}

	// 创建Excel文件
	file := xlsx.NewFile()
	sheet, err := file.AddSheet("会议室使用统计")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create Excel sheet"})
		return
	}

	// 创建表头
	headerRow := sheet.AddRow()
	headers := []string{"会议室名称", "可容纳人数", "预订次数", "总使用时长(小时)"}
	for _, header := range headers {
		cell := headerRow.AddCell()
		cell.Value = header
		cell.GetStyle().Font.Bold = true
	}

	// 添加数据行
	for _, usage := range usageStats {
		row := sheet.AddRow()
		row.AddCell().SetString(usage.RoomName)
		row.AddCell().SetInt(usage.Capacity)
		row.AddCell().SetInt(usage.BookingCount)
		row.AddCell().SetFloat(usage.TotalHours)
	}

	// 设置列宽
	sheet.SetColWidth(0, 0, 15) // 会议室名称
	sheet.SetColWidth(1, 1, 12) // 可容纳人数
	sheet.SetColWidth(2, 2, 12) // 预订次数
	sheet.SetColWidth(3, 3, 15) // 总使用时长

	// 生成文件名
	filename := fmt.Sprintf("会议室使用统计_%s.xlsx", time.Now().Format("20060102_150405"))

	// 设置HTTP响应头
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("Cache-Control", "no-cache")

	// 写入响应
	if err := file.Write(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write Excel file"})
		return
	}
}
