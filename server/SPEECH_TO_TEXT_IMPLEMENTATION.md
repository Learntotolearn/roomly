# 语音转文字功能实现说明

## 当前实现状态

### 真实语音识别实现
项目现在使用**Vosk真实语音识别**，通过Python脚本调用Vosk库进行离线语音识别。

### 技术架构
- **前端**: React + TypeScript + Web Audio API
- **后端**: Go + Gin + SQLite
- **语音识别**: Vosk (Python) + 中文语音模型
- **音频处理**: 纯Go实现音频文件处理

### 工作流程
#### 1. 前端录音
- 使用 `MediaRecorder` API 录制音频
- 支持多种音频格式（webm, mp4, ogg）
- 实时预览和播放功能
- 使用 `AudioContext` 进行音频播放

#### 2. 后端处理
- 接收 base64 编码的音频数据
- 解码并保存为临时文件
- 调用Python脚本进行语音识别
- 异步处理音频文件
- 返回真实的识别结果

#### 3. 语音识别
- 使用Vosk中文语音模型
- 离线识别，无需网络连接
- 支持中文语音识别
- 返回JSON格式的识别结果

#### 4. 数据流程
```
前端录音 → base64编码 → 后端接收 → 临时文件 → Python脚本 → Vosk识别 → 返回结果
```

## 文件结构

```
server/
├── handlers/
│   └── minutes_handler.go     # 语音转文字处理逻辑
├── models/
│   ├── models.go              # 数据模型定义
│   └── vosk-model-small-cn-0.22/  # Vosk中文语音模型
├── tmp/
│   └── audio/                 # 临时音频文件存储
├── vosk_transcribe.py         # Python语音识别脚本
└── SPEECH_TO_TEXT_IMPLEMENTATION.md  # 本文档
```

## 依赖要求

### Python依赖
```bash
pip3 install vosk
```

### 语音模型
- 模型名称: `vosk-model-small-cn-0.22`
- 语言: 中文
- 大小: 约42MB
- 下载地址: https://alphacephei.com/vosk/models/

## API 接口

### POST /api/speech/to-text
处理语音转文字请求

**请求参数：**
```json
{
  "booking_id": 1,
  "audio_file": "base64编码的音频数据"
}
```

**响应：**
```json
{
  "data": {
    "id": 1,
    "booking_id": 1,
    "audio_file": "base64数据",
    "status": "processing",
    "text": "",
    "created_at": "2025-07-31T12:00:00Z",
    "updated_at": "2025-07-31T12:00:00Z"
  },
  "message": "语音转文字处理已开始，请稍后查询结果"
}
```

### GET /api/speech/to-text/:id
查询语音转文字状态

**响应：**
```json
{
  "data": {
    "id": 1,
    "booking_id": 1,
    "audio_file": "base64数据",
    "status": "completed",
    "text": "真实的语音识别结果",
    "created_at": "2025-07-31T12:00:00Z",
    "updated_at": "2025-07-31T12:02:00Z"
  }
}
```

## 状态说明

- `processing`: 正在处理中
- `completed`: 处理完成
- `failed`: 处理失败

## 技术特点

### 1. 真实语音识别
- 使用Vosk离线语音识别引擎
- 支持中文语音识别
- 无需网络连接，保护隐私

### 2. 异步处理
- 使用goroutine异步处理音频
- 不阻塞API响应
- 实时状态更新

### 3. 错误处理
- 完善的错误处理机制
- 详细的错误信息反馈
- 自动清理临时文件

### 4. 跨语言集成
- Go调用Python脚本
- JSON格式数据交换
- 模块化设计

## 使用说明

1. 在前端选择预定记录
2. 点击录音按钮开始录音
3. 录音完成后点击"开始语音转文字"
4. 等待处理完成（时间取决于音频长度）
5. 查看真实的识别结果

## 性能特点

1. **离线识别**: 无需网络连接，响应速度快
2. **中文支持**: 专门针对中文优化的语音模型
3. **高准确率**: Vosk在中文语音识别方面表现优秀
4. **资源占用**: 模型文件约42MB，内存占用适中

## 注意事项

- 需要安装Python和Vosk库
- 语音模型文件较大，首次下载需要时间
- 识别准确率取决于录音质量和环境噪音
- 建议在安静环境中录音以获得最佳效果
- 支持常见的音频格式（webm, mp4, ogg等）

## 故障排除

### 常见问题
1. **Python脚本不存在**: 确保 `vosk_transcribe.py` 文件存在且有执行权限
2. **Vosk库未安装**: 运行 `pip3 install vosk` 安装依赖
3. **模型文件缺失**: 确保 `models/vosk-model-small-cn-0.22/` 目录存在
4. **音频格式不支持**: 确保音频文件格式正确

### 调试方法
1. 检查Python脚本输出
2. 查看Go后端日志
3. 验证音频文件完整性
4. 测试Vosk模型加载 