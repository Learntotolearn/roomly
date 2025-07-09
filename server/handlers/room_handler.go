package handlers

import (
	"net/http"

	"roomly/database"
	"roomly/models"

	"github.com/gin-gonic/gin"
)

// 获取所有会议室
func GetRooms(c *gin.Context) {
	var rooms []models.Room
	if err := database.DB.Find(&rooms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rooms"})
		return
	}
	c.JSON(http.StatusOK, rooms)
}

// 获取开放的会议室
func GetOpenRooms(c *gin.Context) {
	var rooms []models.Room
	if err := database.DB.Where("is_open = ?", true).Find(&rooms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch open rooms"})
		return
	}
	c.JSON(http.StatusOK, rooms)
}

// 获取单个会议室
func GetRoom(c *gin.Context) {
	id := c.Param("id")
	var room models.Room
	if err := database.DB.First(&room, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}
	c.JSON(http.StatusOK, room)
}

// 创建会议室
func CreateRoom(c *gin.Context) {
	var room models.Room
	if err := c.ShouldBindJSON(&room); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := database.DB.Create(&room).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create room"})
		return
	}

	c.JSON(http.StatusCreated, room)
}

// 更新会议室
func UpdateRoom(c *gin.Context) {
	id := c.Param("id")
	var room models.Room

	if err := database.DB.First(&room, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	if err := c.ShouldBindJSON(&room); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := database.DB.Save(&room).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update room"})
		return
	}

	c.JSON(http.StatusOK, room)
}

// 删除会议室
func DeleteRoom(c *gin.Context) {
	id := c.Param("id")

	// 检查是否有预定记录
	var bookingCount int64
	if err := database.DB.Model(&models.Booking{}).Where("room_id = ? AND status = ?", id, "active").Count(&bookingCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check bookings"})
		return
	}

	if bookingCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete room with active bookings"})
		return
	}

	if err := database.DB.Delete(&models.Room{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete room"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Room deleted successfully"})
}

// 切换会议室开放状态
func ToggleRoomStatus(c *gin.Context) {
	id := c.Param("id")

	var room models.Room
	if err := database.DB.First(&room, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	room.IsOpen = !room.IsOpen
	if err := database.DB.Save(&room).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to toggle room status"})
		return
	}

	c.JSON(http.StatusOK, room)
}
