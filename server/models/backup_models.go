package models

import (
	"time"
)

// 备份操作日志
type BackupLog struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	Operation   string     `gorm:"not null" json:"operation"` // "backup", "restore", "download", "delete"
	Status      string     `gorm:"not null" json:"status"`    // "success", "failed", "in_progress"
	Filename    string     `json:"filename"`
	Format      string     `json:"format"`
	Size        int64      `json:"size"`
	Checksum    string     `json:"checksum"` // 文件校验和
	CreatedBy   string     `gorm:"not null" json:"created_by"`
	ErrorMsg    string     `json:"error_msg"`
	Duration    int64      `json:"duration"` // 操作耗时（毫秒）
	CreatedAt   time.Time  `json:"created_at"`
	CompletedAt *time.Time `json:"completed_at"`
}

// 备份文件信息结构
type BackupInfo struct {
	ID          string    `json:"id"`
	Filename    string    `json:"filename"`
	FilePath    string    `json:"file_path"`
	Format      string    `json:"format"` // "sql" or "json"
	Size        int64     `json:"size"`   // 文件大小（字节）
	CreatedAt   time.Time `json:"created_at"`
	CreatedBy   string    `json:"created_by"`  // 创建者
	IsValid     bool      `json:"is_valid"`    // 文件完整性状态
	Description string    `json:"description"` // 备份描述
}

// 备份数据结构（JSON格式）
type BackupData struct {
	Version      string        `json:"version"`
	CreatedAt    time.Time     `json:"created_at"`
	CreatedBy    string        `json:"created_by"`
	Description  string        `json:"description"`
	Members      []Member      `json:"members"`
	Rooms        []Room        `json:"rooms"`
	Bookings     []Booking     `json:"bookings"`
	BookingUsers []BookingUser `json:"booking_users"`
}

// 数据还原请求结构
type RestoreRequest struct {
	Filename     string `json:"filename" binding:"required"`
	BackupBefore bool   `json:"backup_before"` // 还原前是否备份当前数据
	Description  string `json:"description"`   // 还原操作描述
}
