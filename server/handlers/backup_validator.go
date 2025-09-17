package handlers

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"roomly/config"
	"roomly/database"
	"roomly/models"
)

// BackupValidator 备份验证器
type BackupValidator struct {
	FilePath string
	Format   string
}

// ValidationResult 验证结果
type ValidationResult struct {
	IsValid       bool     `json:"is_valid"`
	FileExists    bool     `json:"file_exists"`
	FileSize      int64    `json:"file_size"`
	Checksum      string   `json:"checksum"`
	Format        string   `json:"format"`
	CreatedAt     string   `json:"created_at"`
	DataIntegrity bool     `json:"data_integrity"`
	Errors        []string `json:"errors"`
	Warnings      []string `json:"warnings"`
}

// NewBackupValidator 创建新的验证器
func NewBackupValidator(filePath, format string) *BackupValidator {
	return &BackupValidator{
		FilePath: filePath,
		Format:   format,
	}
}

// ValidateBackupFile 验证备份文件完整性
func (v *BackupValidator) ValidateBackupFile() *ValidationResult {
	result := &ValidationResult{
		Format:   v.Format,
		Errors:   []string{},
		Warnings: []string{},
	}

	// 1. 检查文件是否存在
	fileInfo, err := os.Stat(v.FilePath)
	if err != nil {
		result.FileExists = false
		result.Errors = append(result.Errors, "备份文件不存在")
		return result
	}

	result.FileExists = true
	result.FileSize = fileInfo.Size()
	result.CreatedAt = fileInfo.ModTime().Format("2006-01-02 15:04:05")

	// 2. 检查文件大小
	if result.FileSize == 0 {
		result.Errors = append(result.Errors, "备份文件为空")
		return result
	}

	if result.FileSize < 100 { // 小于100字节可能有问题
		result.Warnings = append(result.Warnings, "备份文件过小，可能不完整")
	}

	// 3. 计算文件校验和
	checksum, err := v.calculateChecksum()
	if err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("计算校验和失败: %v", err))
		return result
	}
	result.Checksum = checksum

	// 4. 验证文件格式和内容完整性
	if err := v.validateContent(result); err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("内容验证失败: %v", err))
		result.DataIntegrity = false
	} else {
		result.DataIntegrity = true
	}

	// 5. 综合判断是否有效
	result.IsValid = len(result.Errors) == 0 && result.DataIntegrity

	return result
}

// calculateChecksum 计算文件MD5校验和
func (v *BackupValidator) calculateChecksum() (string, error) {
	file, err := os.Open(v.FilePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hash := md5.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}

	return hex.EncodeToString(hash.Sum(nil)), nil
}

// validateContent 验证备份内容完整性
func (v *BackupValidator) validateContent(result *ValidationResult) error {
	file, err := os.Open(v.FilePath)
	if err != nil {
		return fmt.Errorf("无法打开文件: %v", err)
	}
	defer file.Close()

	if v.Format == "json" {
		return v.validateJSONContent(file, result)
	} else if v.Format == "sql" {
		return v.validateSQLContent(file, result)
	}

	return fmt.Errorf("不支持的格式: %s", v.Format)
}

// validateJSONContent 验证JSON格式备份内容
func (v *BackupValidator) validateJSONContent(file *os.File, result *ValidationResult) error {
	var backupData models.BackupData
	decoder := json.NewDecoder(file)

	if err := decoder.Decode(&backupData); err != nil {
		return fmt.Errorf("JSON格式错误: %v", err)
	}

	// 验证必要字段
	if backupData.Version == "" {
		result.Warnings = append(result.Warnings, "缺少版本信息")
	}

	if backupData.CreatedAt.IsZero() {
		result.Warnings = append(result.Warnings, "缺少创建时间")
	}

	// 验证数据表是否存在
	tableCount := 0
	if backupData.Members != nil {
		tableCount++
	}
	if backupData.Rooms != nil {
		tableCount++
	}
	if backupData.Bookings != nil {
		tableCount++
	}

	if tableCount == 0 {
		result.Warnings = append(result.Warnings, "备份中没有数据表")
	}

	return nil
}

// validateSQLContent 验证SQL格式备份内容
func (v *BackupValidator) validateSQLContent(file *os.File, result *ValidationResult) error {
	content, err := io.ReadAll(file)
	if err != nil {
		return fmt.Errorf("读取文件失败: %v", err)
	}

	sqlContent := string(content)

	// 检查基本SQL语句
	requiredStatements := []string{
		"CREATE TABLE",
		"INSERT INTO",
	}

	for _, stmt := range requiredStatements {
		if !strings.Contains(sqlContent, stmt) {
			result.Warnings = append(result.Warnings, fmt.Sprintf("缺少 %s 语句", stmt))
		}
	}

	// 检查表结构
	expectedTables := []string{"members", "rooms", "bookings"}
	for _, table := range expectedTables {
		if !strings.Contains(sqlContent, table) {
			result.Warnings = append(result.Warnings, fmt.Sprintf("缺少 %s 表", table))
		}
	}

	return nil
}

// ValidateRestoreCompatibility 验证还原兼容性
func ValidateRestoreCompatibility(backupPath string) (*ValidationResult, error) {
	// 获取备份文件格式
	format := "json"
	if strings.HasSuffix(backupPath, ".sql") {
		format = "sql"
	}

	validator := NewBackupValidator(backupPath, format)
	result := validator.ValidateBackupFile()

	if !result.IsValid {
		return result, fmt.Errorf("备份文件验证失败")
	}

	// 额外的还原兼容性检查
	if err := checkDatabaseCompatibility(backupPath, format, result); err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("数据库兼容性检查失败: %v", err))
		result.IsValid = false
	}

	return result, nil
}

// checkDatabaseCompatibility 检查数据库兼容性
func checkDatabaseCompatibility(backupPath, format string, result *ValidationResult) error {
	// 检查当前数据库连接
	if database.DB == nil {
		return fmt.Errorf("数据库连接不可用")
	}

	// 检查数据库表结构
	expectedTables := []string{"members", "rooms", "bookings", "backup_logs"}
	for _, tableName := range expectedTables {
		if !database.DB.Migrator().HasTable(tableName) {
			result.Warnings = append(result.Warnings, fmt.Sprintf("当前数据库缺少 %s 表", tableName))
		}
	}

	return nil
}

// RepairBackupFile 尝试修复损坏的备份文件
func RepairBackupFile(backupPath string) error {
	// 这里可以实现一些基本的修复逻辑
	// 例如：移除损坏的行、修复JSON格式错误等

	// 目前只是一个占位符实现
	return fmt.Errorf("自动修复功能暂未实现")
}

// CreateBackupChecksum 为备份文件创建校验和文件
func CreateBackupChecksum(backupPath string) error {
	validator := NewBackupValidator(backupPath, "")
	checksum, err := validator.calculateChecksum()
	if err != nil {
		return err
	}

	checksumPath := backupPath + ".md5"
	checksumContent := fmt.Sprintf("%s  %s\n", checksum, filepath.Base(backupPath))

	return os.WriteFile(checksumPath, []byte(checksumContent), 0644)
}

// VerifyBackupChecksum 验证备份文件校验和
func VerifyBackupChecksum(backupPath string) (bool, error) {
	checksumPath := backupPath + ".md5"

	// 检查校验和文件是否存在
	if _, err := os.Stat(checksumPath); os.IsNotExist(err) {
		return false, fmt.Errorf("校验和文件不存在")
	}

	// 读取存储的校验和
	checksumContent, err := os.ReadFile(checksumPath)
	if err != nil {
		return false, err
	}

	storedChecksum := strings.Fields(string(checksumContent))[0]

	// 计算当前文件校验和
	validator := NewBackupValidator(backupPath, "")
	currentChecksum, err := validator.calculateChecksum()
	if err != nil {
		return false, err
	}

	return storedChecksum == currentChecksum, nil
}

// CleanupCorruptedBackups 清理损坏的备份文件
func CleanupCorruptedBackups() (int, error) {
	cfg := config.Load()
	backupDir := cfg.BackupPath
	files, err := os.ReadDir(backupDir)
	if err != nil {
		return 0, err
	}

	cleanedCount := 0
	for _, file := range files {
		if file.IsDir() || strings.HasSuffix(file.Name(), ".md5") {
			continue
		}

		filePath := filepath.Join(backupDir, file.Name())
		format := "json"
		if strings.HasSuffix(file.Name(), ".sql") {
			format = "sql"
		}

		validator := NewBackupValidator(filePath, format)
		result := validator.ValidateBackupFile()

		if !result.IsValid {
			// 删除损坏的文件
			if err := os.Remove(filePath); err == nil {
				cleanedCount++

				// 同时删除对应的校验和文件
				checksumPath := filePath + ".md5"
				os.Remove(checksumPath) // 忽略错误
			}
		}
	}

	return cleanedCount, nil
}
