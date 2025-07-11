package handlers

import (
	"net/http"

	"roomly/database"
	"roomly/models"

	"github.com/gin-gonic/gin"
)

// 获取所有会员
func GetMembers(c *gin.Context) {
	var members []models.Member
	if err := database.DB.Find(&members).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch members"})
		return
	}
	c.JSON(http.StatusOK, members)
}

// 获取单个会员
func GetMember(c *gin.Context) {
	id := c.Param("id")
	var member models.Member
	if err := database.DB.First(&member, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
		return
	}
	c.JSON(http.StatusOK, member)
}

// 根据dootask_id获取会员
func GetMemberForDootaskId(c *gin.Context) {
	id := c.Param("id")
	var member models.Member
	if err := database.DB.Where("dootask_id = ?", id).First(&member).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
		return
	}
	c.JSON(http.StatusOK, member)
}

// 创建会员
func CreateMember(c *gin.Context) {
	var member models.Member
	if err := c.ShouldBindJSON(&member); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := database.DB.Create(&member).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create member"})
		return
	}

	c.JSON(http.StatusCreated, member)
}

// 更新会员
func UpdateMember(c *gin.Context) {
	id := c.Param("id")
	var member models.Member

	if err := database.DB.First(&member, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
		return
	}

	if err := c.ShouldBindJSON(&member); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := database.DB.Save(&member).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update member"})
		return
	}

	c.JSON(http.StatusOK, member)
}

// 删除会员
func DeleteMember(c *gin.Context) {
	id := c.Param("id")

	if err := database.DB.Delete(&models.Member{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete member"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Member deleted successfully"})
}

// 设置管理员权限
func SetAdminPermission(c *gin.Context) {
	id := c.Param("id")

	var request struct {
		IsAdmin bool `json:"is_admin"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var member models.Member
	if err := database.DB.First(&member, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
		return
	}

	member.IsAdmin = request.IsAdmin
	if err := database.DB.Save(&member).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update admin permission"})
		return
	}

	c.JSON(http.StatusOK, member)
}

// 设置会议室管理员权限
func SetRoomAdminPermission(c *gin.Context) {
	id := c.Param("id")

	var request struct {
		IsRoomAdmin bool `json:"is_room_admin"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var member models.Member
	if err := database.DB.First(&member, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
		return
	}

	member.IsRoomAdmin = request.IsRoomAdmin
	if err := database.DB.Save(&member).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update room admin permission"})
		return
	}

	c.JSON(http.StatusOK, member)
}
