# 会议纪要功能说明

## 📋 功能概述

本次更新为Roomly会议室预定系统新增了完整的会议纪要管理功能，包括：

1. **会议纪要管理** - 创建、编辑、查看会议纪要
2. **语音转文字** - 录制会议音频并自动转换为文字
3. **智能纪要生成** - 基于语音识别结果生成结构化会议纪要

## 🚀 新增功能

### 1. 会议纪要管理 (`/minutes`)

#### 功能特点：
- ✅ 创建和编辑会议纪要
- ✅ 关联预定记录
- ✅ 支持草稿、已发布、已归档状态
- ✅ 富文本内容编辑
- ✅ 摘要、关键点、行动项分类管理
- ✅ 按预定、状态、创建者筛选
- ✅ 搜索功能

#### 数据结构：
```typescript
interface MeetingMinutes {
  id: number;
  booking_id: number;
  title: string;
  content: string;
  summary: string;
  key_points: string;
  action_items: string;
  status: 'draft' | 'published' | 'archived';
  created_by: number;
  updated_by: number;
  created_at: string;
  updated_at: string;
}
```

### 2. 语音转文字 (`/speech-to-text`)

#### 功能特点：
- ✅ 实时音频录制
- ✅ 音频播放和下载
- ✅ 语音识别处理
- ✅ 实时处理状态显示
- ✅ 转换结果预览
- ✅ 一键生成会议纪要

#### 技术实现：
- 使用WebRTC MediaRecorder API录制音频
- 支持WAV格式音频文件
- 异步语音识别处理
- 状态轮询机制

### 3. 智能纪要生成

#### 功能特点：
- ✅ 基于语音识别结果生成纪要
- ✅ 自动提取关键信息
- ✅ 结构化内容组织
- ✅ 支持手动编辑和优化

## 🔧 技术架构

### 后端API

#### 会议纪要相关接口：
```
GET    /api/minutes              # 获取会议纪要列表
GET    /api/minutes/:id          # 获取单个会议纪要
POST   /api/minutes              # 创建会议纪要
PUT    /api/minutes/:id          # 更新会议纪要
DELETE /api/minutes/:id          # 删除会议纪要
GET    /api/bookings/:id/minutes # 获取预定的会议纪要
```

#### 语音转文字相关接口：
```
POST   /api/speech/to-text       # 处理语音转文字
GET    /api/speech/to-text/:id   # 获取处理状态
```

### 前端组件

#### 新增页面：
- `/minutes` - 会议纪要管理页面
- `/speech-to-text` - 语音转文字页面

#### 新增组件：
- `AudioRecorder` - 音频录制组件
- `MinutesPage` - 会议纪要管理组件
- `SpeechToTextPage` - 语音转文字组件

## 📊 数据库设计

### 新增数据表：

#### 1. meeting_minutes 表
```sql
CREATE TABLE meeting_minutes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  key_points TEXT,
  action_items TEXT,
  status TEXT DEFAULT 'draft',
  created_by INTEGER NOT NULL,
  updated_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (created_by) REFERENCES members(id),
  FOREIGN KEY (updated_by) REFERENCES members(id)
);
```

#### 2. speech_to_text 表
```sql
CREATE TABLE speech_to_text (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL,
  audio_file TEXT NOT NULL,
  text TEXT,
  status TEXT DEFAULT 'processing',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);
```

## 🎯 使用流程

### 1. 创建会议纪要

1. 访问 `/minutes` 页面
2. 点击"新建纪要"按钮
3. 选择关联的预定记录
4. 填写标题、内容、摘要等信息
5. 设置状态（草稿/已发布/已归档）
6. 保存纪要

### 2. 语音转文字

1. 访问 `/speech-to-text` 页面
2. 选择要生成纪要的预定记录
3. 点击"开始录音"录制会议音频
4. 录音完成后点击"开始语音转文字"
5. 等待处理完成，查看转换结果
6. 复制文本或直接生成会议纪要

### 3. 管理会议纪要

1. 在会议纪要列表页面查看所有纪要
2. 使用筛选和搜索功能快速定位
3. 点击编辑按钮修改纪要内容
4. 设置纪要状态（草稿/已发布/已归档）
5. 删除不需要的纪要

## 🔮 未来扩展

### 1. AI增强功能
- 使用GPT等AI模型自动生成会议摘要
- 智能提取关键决策和行动项
- 自动识别发言人身份
- 情感分析和会议效果评估

### 2. 集成第三方服务
- 集成阿里云、腾讯云等语音识别服务
- 支持多种音频格式（MP3、M4A等）
- 实时语音转文字（流式处理）
- 多语言支持

### 3. 高级功能
- 会议纪要模板系统
- 自动发送纪要邮件
- 纪要版本控制
- 协作编辑功能
- 纪要导出（PDF、Word等格式）

## 🛠️ 部署说明

### 环境要求
- Node.js 18+
- Go 1.23+
- 支持WebRTC的现代浏览器

### 安装步骤
1. 更新代码到最新版本
2. 运行数据库迁移：`go run server/main.go`
3. 启动前端服务：`npm run dev`
4. 访问新功能页面进行测试

### 注意事项
- 语音录制需要HTTPS环境或localhost
- 需要用户授权麦克风权限
- 语音识别功能目前为模拟实现，需要集成实际的语音识别服务

## 📝 更新日志

### v0.2.0 (2024-01-XX)
- ✨ 新增会议纪要管理功能
- ✨ 新增语音转文字功能
- ✨ 新增音频录制组件
- ✨ 新增数据库表结构
- 🔧 优化用户界面和交互体验
- 📚 完善API文档和类型定义

---

**Roomly会议纪要功能** - 让会议记录变得简单高效 🚀 