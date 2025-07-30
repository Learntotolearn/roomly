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
	ID        uint      `gorm:"primaryKey" json:"id"`
	RoomID    uint      `gorm:"not null" json:"room_id"`
	MemberID  uint      `gorm:"not null" json:"member_id"`
	Date      string    `gorm:"not null" json:"date"`       // 格式: YYYY-MM-DD
	StartTime string    `gorm:"not null" json:"start_time"` // 格式: HH:MM
	EndTime   string    `gorm:"not null" json:"end_time"`   // 格式: HH:MM
	Reason    string    `gorm:"not null" json:"reason"`
	Status    string    `gorm:"default:active" json:"status"` // active, cancelled
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// 关联关系
	Room         Room             `gorm:"foreignKey:RoomID" json:"room"`
	Member       Member           `gorm:"foreignKey:MemberID" json:"member"`
	BookingUsers []BookingUser    `gorm:"foreignKey:BookingID" json:"booking_users"`
	Minutes      []MeetingMinutes `gorm:"foreignKey:BookingID" json:"minutes"`
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

// 会议纪要模型
type MeetingMinutes struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	BookingID   uint      `gorm:"not null" json:"booking_id"`
	Title       string    `gorm:"not null" json:"title"`
	Content     string    `gorm:"type:text" json:"content"`
	Summary     string    `gorm:"type:text" json:"summary"`
	KeyPoints   string    `gorm:"type:text" json:"key_points"`
	ActionItems string    `gorm:"type:text" json:"action_items"`
	Status      string    `gorm:"default:draft" json:"status"` // draft, published, archived
	CreatedBy   uint      `gorm:"not null" json:"created_by"`
	UpdatedBy   uint      `gorm:"not null" json:"updated_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// 关联关系
	Booking Booking `gorm:"foreignKey:BookingID" json:"booking"`
	Creator Member  `gorm:"foreignKey:CreatedBy" json:"creator"`
	Updater Member  `gorm:"foreignKey:UpdatedBy" json:"updater"`
}

// 语音转文字记录模型
type SpeechToText struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	BookingID uint      `gorm:"not null" json:"booking_id"`
	AudioFile string    `gorm:"not null" json:"audio_file"`
	Text      string    `gorm:"type:text" json:"text"`
	Status    string    `gorm:"default:processing" json:"status"` // processing, completed, failed
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// 关联关系
	Booking Booking `gorm:"foreignKey:BookingID" json:"booking"`
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

// 会议纪要请求结构
type MinutesRequest struct {
	BookingID   uint   `json:"booking_id" binding:"required"`
	Title       string `json:"title" binding:"required"`
	Content     string `json:"content"`
	Summary     string `json:"summary"`
	KeyPoints   string `json:"key_points"`
	ActionItems string `json:"action_items"`
	Status      string `json:"status"`
}

// 语音转文字请求结构
type SpeechToTextRequest struct {
	BookingID uint   `json:"booking_id" binding:"required"`
	AudioFile string `json:"audio_file" binding:"required"`
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
