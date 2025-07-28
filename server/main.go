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
	// 初始化数据库
	database.InitDB()

	// 启动定时任务，每5分钟更新一次已过期预定状态
	go func() {
		for {
			UpdateExpiredBookings()
			time.Sleep(5 * time.Minute)
		}
	}()

	// 设置路由
	r := routes.SetupRoutes()

	// 获取端口，默认为8080
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// 启动服务器
	log.Printf("服务器启动在端口 %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal("服务器启动失败:", err)
	}
}

// 定时任务：将已过期的active预定状态更新为expired
func UpdateExpiredBookings() {
	now := time.Now()
	today := now.Format("2006-01-02")
	currentTime := now.Format("15:04")

	var expiredBookings []models.Booking
	database.DB.Model(&models.Booking{}).
		Where("status = ?", "active").
		Where("(date < ? OR (date = ? AND end_time <= ?))", today, today, currentTime).
		Find(&expiredBookings)

	for _, booking := range expiredBookings {
		booking.Status = "expired"
		database.DB.Save(&booking)
	}
}
