# PaddleSpeech 语音识别集成

本项目集成了 [PaddleSpeech](https://github.com/PaddlePaddle/PaddleSpeech) 进行中文语音识别，提供更准确的语音转文字功能。

## 🚀 快速开始

### 1. 安装PaddleSpeech

```bash
cd server
chmod +x install-paddle.sh
./install-paddle.sh
```

### 2. 启动PaddleSpeech服务

```bash
chmod +x start-paddle-local.sh
./start-paddle-local.sh
```

### 3. 测试语音识别

1. 打开浏览器访问语音转文字页面
2. 录制音频（建议5-10秒，清晰说话）
3. 点击"开始语音转文字"
4. 等待识别结果

## 📁 文件说明

- `paddle_server.py` - PaddleSpeech Flask API服务
- `install-paddle.sh` - PaddleSpeech安装脚本
- `start-paddle-local.sh` - 本地启动脚本
- `audio/` - 音频文件目录

## 🔧 技术架构

```
前端录音 → Go后端 → HTTP API → PaddleSpeech → 识别结果
```

## ⚡ 优势特性

- **高准确率**：专门针对中文优化
- **自动标点**：自动添加标点符号
- **流式识别**：支持实时语音识别
- **本地部署**：无需网络连接，保护隐私

## 🐛 故障排除

### 安装失败
```bash
# 使用国内镜像
python3 -m pip install paddlepaddle -i https://mirror.baidu.com/pypi/simple
python3 -m pip install paddlespeech -i https://mirror.baidu.com/pypi/simple
```

### 服务启动失败
```bash
# 检查端口占用
lsof -i :8090

# 手动启动服务
python3 paddle_server.py
```

### 识别效果不佳
1. 确保录音环境安静
2. 说话清晰，语速适中
3. 录音时长建议5-10秒
4. 检查音频文件质量

## 📊 性能对比

| 特性 | Vosk | PaddleSpeech |
|------|------|--------------|
| 中文支持 | ✅ | ✅ 更优 |
| 识别准确率 | 中等 | 高 |
| 标点符号 | ❌ | ✅ |
| 安装复杂度 | 中等 | 简单 |
| 模型大小 | 小 | 中等 |

## 🔗 相关链接

- [PaddleSpeech GitHub](https://github.com/PaddlePaddle/PaddleSpeech)
- [PaddleSpeech 文档](https://paddlespeech.readthedocs.io/)
- [PaddlePaddle 官网](https://www.paddlepaddle.org.cn/) 