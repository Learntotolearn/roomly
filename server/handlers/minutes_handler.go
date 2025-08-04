package handlers

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"roomly/database"
	"roomly/models"

	"os/exec"

	whisper "github.com/ggerganov/whisper.cpp/bindings/go/pkg/whisper"
	"github.com/gin-gonic/gin"
	"github.com/go-audio/wav"
)

// 获取会议纪要列表
func GetMinutes(c *gin.Context) {
	var minutes []models.MeetingMinutes

	query := database.DB.Preload("Booking").Preload("Creator").Preload("Updater")

	// 支持按预定ID筛选
	if bookingID := c.Query("booking_id"); bookingID != "" {
		if id, err := strconv.ParseUint(bookingID, 10, 32); err == nil {
			query = query.Where("booking_id = ?", id)
		}
	}

	// 支持按状态筛选
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	// 支持按创建者筛选
	if createdBy := c.Query("created_by"); createdBy != "" {
		if id, err := strconv.ParseUint(createdBy, 10, 32); err == nil {
			query = query.Where("created_by = ?", id)
		}
	}

	if err := query.Order("created_at DESC").Find(&minutes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取会议纪要失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": minutes})
}

// 获取单个会议纪要
func GetMinutesById(c *gin.Context) {
	id := c.Param("id")

	var minutes models.MeetingMinutes
	if err := database.DB.Preload("Booking").Preload("Creator").Preload("Updater").First(&minutes, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "会议纪要不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": minutes})
}

// 创建会议纪要
func CreateMinutes(c *gin.Context) {
	var request models.MinutesRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	// 验证预定是否存在
	var booking models.Booking
	if err := database.DB.First(&booking, request.BookingID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "预定记录不存在"})
		return
	}

	// 获取当前用户ID（这里需要根据实际的用户认证系统调整）
	currentUserID := uint(1) // 临时写死，实际应该从JWT或session中获取

	minutes := models.MeetingMinutes{
		BookingID:   request.BookingID,
		Title:       request.Title,
		Content:     request.Content,
		Summary:     request.Summary,
		KeyPoints:   request.KeyPoints,
		ActionItems: request.ActionItems,
		Status:      "draft",
		CreatedBy:   currentUserID,
		UpdatedBy:   currentUserID,
	}

	if err := database.DB.Create(&minutes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建会议纪要失败"})
		return
	}

	// 重新加载关联数据
	database.DB.Preload("Booking").Preload("Creator").Preload("Updater").First(&minutes, minutes.ID)

	c.JSON(http.StatusCreated, gin.H{"data": minutes})
}

// 更新会议纪要
func UpdateMinutes(c *gin.Context) {
	id := c.Param("id")

	var minutes models.MeetingMinutes
	if err := database.DB.First(&minutes, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "会议纪要不存在"})
		return
	}

	var request models.MinutesRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	// 获取当前用户ID
	currentUserID := uint(1) // 临时写死，实际应该从JWT或session中获取

	// 更新字段
	if request.Title != "" {
		minutes.Title = request.Title
	}
	if request.Content != "" {
		minutes.Content = request.Content
	}
	if request.Summary != "" {
		minutes.Summary = request.Summary
	}
	if request.KeyPoints != "" {
		minutes.KeyPoints = request.KeyPoints
	}
	if request.ActionItems != "" {
		minutes.ActionItems = request.ActionItems
	}
	if request.Status != "" {
		minutes.Status = request.Status
	}

	minutes.UpdatedBy = currentUserID
	minutes.UpdatedAt = time.Now()

	if err := database.DB.Save(&minutes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新会议纪要失败"})
		return
	}

	// 重新加载关联数据
	database.DB.Preload("Booking").Preload("Creator").Preload("Updater").First(&minutes, minutes.ID)

	c.JSON(http.StatusOK, gin.H{"data": minutes})
}

// 删除会议纪要
func DeleteMinutes(c *gin.Context) {
	id := c.Param("id")

	var minutes models.MeetingMinutes
	if err := database.DB.First(&minutes, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "会议纪要不存在"})
		return
	}

	if err := database.DB.Delete(&minutes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除会议纪要失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "删除成功"})
}

// 语音识别：go-whisper 实现
func processAudioWithGo(audioFile string) (string, error) {
	modelPath := "server/models/ggml-small.bin"
	wavFile := audioFile + ".wav"
	cmd := exec.Command("ffmpeg", "-i", audioFile, "-ar", "16000", "-ac", "1", "-f", "wav", "-y", wavFile)
	var outb, errb bytes.Buffer
	cmd.Stdout = &outb
	cmd.Stderr = &errb
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("ffmpeg 转换失败: %v, %s", err, errb.String())
	}
	defer os.Remove(wavFile)

	// 1. 解码 wav 文件为 float32 slice
	fh, err := os.Open(wavFile)
	if err != nil {
		return "", fmt.Errorf("打开 wav 文件失败: %v", err)
	}
	defer fh.Close()
	dec := wav.NewDecoder(fh)
	buf, err := dec.FullPCMBuffer()
	if err != nil {
		return "", fmt.Errorf("解码 wav 失败: %v", err)
	}
	data := buf.AsFloat32Buffer().Data

	// 2. 加载模型
	model, err := whisper.New(modelPath)
	if err != nil {
		return "", fmt.Errorf("加载Whisper模型失败: %v", err)
	}
	defer model.Close()

	ctx, err := model.NewContext()
	if err != nil {
		return "", fmt.Errorf("创建Whisper上下文失败: %v", err)
	}

	// 3. 推理
	if err := ctx.Process(data, nil, nil, nil); err != nil {
		return "", fmt.Errorf("Whisper识别失败: %v", err)
	}

	// 4. 获取识别结果
	var result string
	for {
		seg, err := ctx.NextSegment()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", fmt.Errorf("获取识别结果失败: %v", err)
		}
		result += seg.Text
	}
	return result, nil
}

// 更新语音转文字状态的辅助函数
func updateSpeechToTextStatus(id uint, status string, text string) {
	var stt models.SpeechToText
	if err := database.DB.First(&stt, id).Error; err != nil {
		return
	}

	stt.Status = status
	stt.Text = text
	stt.UpdatedAt = time.Now()

	database.DB.Save(&stt)
}

// 将base64数据写入文件的辅助函数
func writeBase64ToFile(base64Data string, filePath string) error {
	// 处理Data URL前缀
	if strings.HasPrefix(base64Data, "data:") {
		// 移除Data URL前缀，只保留base64数据部分
		parts := strings.Split(base64Data, ",")
		if len(parts) != 2 {
			return fmt.Errorf("无效的Data URL格式")
		}
		base64Data = parts[1]
	}

	// 解码base64数据
	decodedData, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return fmt.Errorf("base64解码失败: %v", err)
	}

	// 写入文件
	if err := os.WriteFile(filePath, decodedData, 0644); err != nil {
		return fmt.Errorf("写入文件失败: %v", err)
	}
	return nil
}

// 复制文件的辅助函数
func copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, sourceFile)
	return err
}

// 语音转文字处理
func ProcessSpeechToText(c *gin.Context) {
	var request models.SpeechToTextRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	// 验证预定是否存在
	var booking models.Booking
	if err := database.DB.First(&booking, request.BookingID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "预定记录不存在"})
		return
	}

	// 创建语音转文字记录
	speechToText := models.SpeechToText{
		BookingID: request.BookingID,
		AudioFile: request.AudioFile,
		Status:    "processing",
	}

	if err := database.DB.Create(&speechToText).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建语音转文字记录失败"})
		return
	}

	// 处理base64编码的音频数据
	go func(id uint, audioData string) {
		// 创建临时目录
		tempDir := "./tmp/audio"
		if err := os.MkdirAll(tempDir, 0755); err != nil {
			updateSpeechToTextStatus(id, "failed", fmt.Sprintf("创建临时目录失败: %v", err))
			return
		}

		// 生成临时文件路径
		timestamp := time.Now().UnixNano()
		tempFile := fmt.Sprintf("%s/audio_%d.webm", tempDir, timestamp)

		// 调试信息
		fmt.Printf("开始处理语音转文字，ID: %d\n", id)
		fmt.Printf("音频数据长度: %d\n", len(audioData))
		fmt.Printf("临时文件路径: %s\n", tempFile)

		// 将base64数据写入临时文件
		if err := writeBase64ToFile(audioData, tempFile); err != nil {
			fmt.Printf("保存音频文件失败: %v\n", err)
			updateSpeechToTextStatus(id, "failed", fmt.Sprintf("保存音频文件失败: %v", err))
			return
		}

		// 检查文件是否成功创建
		if fileInfo, err := os.Stat(tempFile); err == nil {
			fmt.Printf("音频文件保存成功，大小: %d bytes\n", fileInfo.Size())
		}

		// 使用纯Go处理音频文件
		text, processErr := processAudioWithGo(tempFile)

		// 清理临时文件
		os.Remove(tempFile)

		// 更新状态
		if processErr != nil {
			fmt.Printf("语音识别失败: %v\n", processErr)
			updateSpeechToTextStatus(id, "failed", fmt.Sprintf("语音识别失败: %v", processErr))
		} else {
			fmt.Printf("语音识别成功，结果: %s\n", text)
			updateSpeechToTextStatus(id, "completed", text)
		}
	}(speechToText.ID, request.AudioFile)

	c.JSON(http.StatusAccepted, gin.H{
		"data":    speechToText,
		"message": "语音转文字处理已开始，请稍后查询结果",
	})
}

// 获取语音转文字状态
func GetSpeechToTextStatus(c *gin.Context) {
	id := c.Param("id")

	var speechToText models.SpeechToText
	if err := database.DB.Preload("Booking").First(&speechToText, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "语音转文字记录不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": speechToText})
}

// 获取预定的会议纪要
func GetBookingMinutes(c *gin.Context) {
	bookingID := c.Param("id")

	var minutes []models.MeetingMinutes
	if err := database.DB.Preload("Creator").Preload("Updater").Where("booking_id = ?", bookingID).Order("created_at DESC").Find(&minutes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取会议纪要失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": minutes})
}
