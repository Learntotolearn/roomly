package handlers

import (
	"net/http"
	"strconv"

	"roomly/database"
	"roomly/models"

	"github.com/gin-gonic/gin"
)

// 获取所有会员
func GetMembers(c *gin.Context) {
	// 解析分页参数
	pageStr := c.DefaultQuery("page", "1")
	pageSizeStr := c.DefaultQuery("page_size", "20")
	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}
	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize < 1 {
		pageSize = 20
	}

	// 新增：解析筛选参数
	search := c.Query("search")
	role := c.Query("role")

	var total int64
	db := database.DB.Model(&models.Member{})

	// 新增：筛选逻辑
	if search != "" {
		db = db.Where("name LIKE ? OR id = ?", "%"+search+"%", search)
	}
	if role != "" && role != "all" {
		switch role {
		case "admin":
			db = db.Where("is_admin = ?", true)
		case "room_admin":
			db = db.Where("is_admin = ? AND is_room_admin = ?", false, true)
		case "user":
			db = db.Where("is_admin = ? AND is_room_admin = ?", false, false)
		}
	}

	db.Count(&total)

	var members []models.Member
	db = db.Order("id desc").Limit(pageSize).Offset((page - 1) * pageSize)
	if err := db.Find(&members).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch members"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"data":  members,
		"total": total,
	})
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
