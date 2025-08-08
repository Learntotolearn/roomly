package models

import (
	"time"
)

// 会员模型
type Member struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"not null" json:"name"`
	DootaskID   uint      `gorm:"not null" json:"dootask_id"`
	IsAdmin     bool      `gorm:"default:false" json:"is_admin"`
	IsRoomAdmin bool      `gorm:"default:false" json:"is_room_admin"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// 会议室模型
type Room struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"not null" json:"name"`
	Description string    `json:"description"`
	Capacity    int       `gorm:"not null" json:"capacity"`
	IsOpen      bool      `gorm:"default:true" json:"is_open"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// 预定记录模型
type Booking struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	RoomID       uint      `gorm:"not null" json:"room_id"`
	MemberID     uint      `gorm:"not null" json:"member_id"`
	Date         string    `gorm:"not null" json:"date"`       // 格式: YYYY-MM-DD
	StartTime    string    `gorm:"not null" json:"start_time"` // 格式: HH:MM
	EndTime      string    `gorm:"not null" json:"end_time"`   // 格式: HH:MM
	Reason       string    `gorm:"not null" json:"reason"`
	CancelReason string    `json:"cancel_reason"`                // 取消理由
	Status       string    `gorm:"default:active" json:"status"` // active, cancelled
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`

	// 关联关系
	Room         Room          `gorm:"foreignKey:RoomID" json:"room"`
	Member       Member        `gorm:"foreignKey:MemberID" json:"member"`
	BookingUsers []BookingUser `gorm:"foreignKey:BookingID" json:"booking_users"`
}

// 预定人员模型
type BookingUser struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	BookingID uint      `gorm:"not null" json:"booking_id"`
	Userid    uint      `gorm:"not null" json:"userid"`
	Nickname  string    `gorm:"not null" json:"nickname"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// 预定请求结构
type BookingRequest struct {
	RoomID       uint          `json:"room_id" binding:"required"`
	MemberID     uint          `json:"member_id" binding:"required"`
	Date         string        `json:"date" binding:"required"`
	TimeSlots    []string      `json:"time_slots" binding:"required"`
	Reason       string        `json:"reason" binding:"required"`
	BookingUsers []BookingUser `json:"booking_users" binding:"required"`
}

// 时间段结构
type TimeSlot struct {
	Start    string `json:"start"`
	End      string `json:"end"`
	IsBooked bool   `json:"is_booked"`
}

// 可用时间段响应
type AvailableSlots struct {
	Date      string     `json:"date"`
	TimeSlots []TimeSlot `json:"time_slots"`
}
