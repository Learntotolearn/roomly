package config

import (
	"os"
	"path/filepath"
)

// Config 应用配置结构
type Config struct {
	BackupPath string // 备份文件存储路径
}

// Load 加载配置
func Load() *Config {
	// 获取备份路径，优先使用环境变量，否则使用默认值
	backupPath := os.Getenv("ROOMLY_BACKUP_PATH")
	if backupPath == "" {
		// 默认备份路径：server/backups
		backupPath = "db/backups"
	}

	// 确保路径是绝对路径
	if !filepath.IsAbs(backupPath) {
		// 相对于server目录的路径
		backupPath = filepath.Join(".", backupPath)
	}

	return &Config{
		BackupPath: backupPath,
	}
}

// SetBackupPath 设置备份路径（用于动态修改）
func (c *Config) SetBackupPath(path string) {
	c.BackupPath = path
}
