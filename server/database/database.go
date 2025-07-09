package database

import (
	"log"

	"roomly/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

// 初始化数据库连接
func InitDB() {
	var err error
	DB, err = gorm.Open(sqlite.Open("roomly.db"), &gorm.Config{})
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
	// 创建管理员用户
	var adminCount int64
	DB.Model(&models.Member{}).Where("is_admin = ?", true).Count(&adminCount)
	if adminCount == 0 {
		admin := models.Member{
			Name:    "管理员",
			IsAdmin: true,
		}
		DB.Create(&admin)
	}

	// 创建普通用户
	var userCount int64
	DB.Model(&models.Member{}).Where("is_admin = ?", false).Count(&userCount)
	if userCount == 0 {
		users := []models.Member{
			{Name: "张三", IsAdmin: false},
			{Name: "李四", IsAdmin: false},
			{Name: "王五", IsAdmin: false},
		}
		DB.Create(&users)
	}

	// 创建示例会议室
	var roomCount int64
	DB.Model(&models.Room{}).Count(&roomCount)
	if roomCount == 0 {
		rooms := []models.Room{
			{Name: "会议室A", Description: "小型会议室，适合团队讨论", Capacity: 6, IsOpen: true},
			{Name: "会议室B", Description: "中型会议室，适合部门会议", Capacity: 12, IsOpen: true},
			{Name: "会议室C", Description: "大型会议室，适合全体会议", Capacity: 24, IsOpen: true},
		}
		DB.Create(&rooms)
	}
}
