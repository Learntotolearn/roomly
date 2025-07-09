package database

import (
	"log"
	"os"

	"roomly/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

// 初始化数据库连接
func InitDB() {
	os.MkdirAll("db", 0755)

	var err error
	DB, err = gorm.Open(sqlite.Open("db/roomly.db"), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// 自动迁移数据库结构
	err = DB.AutoMigrate(&models.Member{}, &models.Room{}, &models.Booking{})
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	// 创建初始数据
	seedData()
}

// 创建初始数据
func seedData() {
	// 创建示例会议室
	var roomCount int64
	DB.Model(&models.Room{}).Count(&roomCount)
	if roomCount == 0 {
		rooms := []models.Room{
			{Name: "多功能会议室A", Description: "适合30人以内的团队会议，配备投影仪和白板", Capacity: 30, IsOpen: true},
		}
		DB.Create(&rooms)
	}
}
