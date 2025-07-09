# Roomly - 会议室预定系统

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/your-org/roomly)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![DooTask](https://img.shields.io/badge/DooTask-Plugin-orange.svg)](https://dootask.com)

## 📋 项目简介

Roomly 是一个现代化的会议室预定管理系统，专为企业和组织提供高效的会议室资源管理解决方案。该系统支持在线预定、实时查看会议室状态、管理员后台管理等功能，并可作为 DooTask 平台的应用插件使用。

## ✨ 主要功能

### 🏢 会议室管理
- 📅 **实时预定**：直观的界面显示会议室状态和可用时间段
- 🔍 **智能筛选**：按容量、设备、位置等条件筛选会议室
- 📊 **使用统计**：会议室使用率统计和数据导出
- 🔧 **状态管理**：管理员可灵活开启/关闭会议室

### 👥 用户体验
- 🎨 **现代化UI**：基于 Tailwind CSS 的响应式设计
- 🌙 **深色模式**：支持亮色/深色主题切换
- 📱 **移动友好**：完美适配移动设备和桌面端
- 🔄 **实时更新**：使用 React Query 实现数据实时同步

### 🛠️ 管理功能
- 👤 **用户管理**：会员注册、权限分配、状态管理
- 📝 **预定管理**：查看、修改、取消预定记录
- 📈 **数据导出**：预定记录和使用统计数据导出
- 🔐 **权限控制**：基于角色的访问控制系统

## 🚀 技术栈

### 前端技术
- **框架**: Next.js 15.3.5 (React 19)
- **语言**: TypeScript 5.x
- **样式**: Tailwind CSS 4.x
- **组件库**: Radix UI + ShadCN UI
- **状态管理**: React Query (TanStack Query)
- **图标**: Lucide React

### 后端技术
- **语言**: Go 1.23+
- **框架**: Gin Web Framework
- **数据库**: SQLite 3
- **ORM**: GORM
- **API**: RESTful API 设计

### 部署技术
- **容器化**: Docker + Docker Compose
- **构建**: 多阶段构建优化
- **部署**: 生产环境优化配置

## 📦 快速开始

### 环境要求
- Node.js 18.x 或更高版本
- Go 1.23 或更高版本
- Docker 和 Docker Compose（推荐）

### 使用 Docker 部署（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/your-org/roomly.git
cd roomly

# 2. 启动服务
docker-compose up -d

# 3. 访问应用
# 前端：http://localhost:3005
# 后端API：http://localhost:8085
```

### 本地开发部署

```bash
# 1. 安装前端依赖
npm install

# 2. 启动前端开发服务器
npm run dev

# 3. 启动后端服务器
cd server
go mod tidy
go run main.go

# 4. 访问应用
# 前端：http://localhost:3000
# 后端API：http://localhost:8080
```

## 🔧 配置说明

### 环境变量
- `NEXT_PUBLIC_BASE_PATH`: 应用基路径（默认：`/apps/roomly`）
- `NEXT_PUBLIC_API_URL`: API 接口地址（默认：`/apps/roomly/api`）
- `PORT`: 后端服务端口（默认：8080）

### 数据库
系统使用 SQLite 数据库，数据文件存储在 `server/db/roomly.db`。首次运行时会自动创建数据库表和初始数据。

## 🎯 应用场景

- **企业办公**：公司内部会议室资源管理
- **共享办公**：联合办公空间的会议室预定
- **教育机构**：学校教室和会议室管理
- **活动场所**：活动中心和培训机构的场地管理
- **DooTask 集成**：作为 DooTask 平台的应用插件

## 🔗 集成 DooTask

本系统已集成 DooTask 平台接口，支持：
- 用户身份认证
- 权限管理同步
- 主题切换
- 应用生命周期管理

## 📝 API 文档

系统提供完整的 RESTful API 接口：

- **会员管理**: `/api/members`
- **会议室管理**: `/api/rooms`
- **预定管理**: `/api/bookings`
- **数据导出**: `/api/export`
- **健康检查**: `/health`

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request 来改进这个项目！

## 📄 许可证

本项目基于 MIT 许可证开源。

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和用户！

---

**Roomly** - 让会议室管理变得简单高效 🚀
