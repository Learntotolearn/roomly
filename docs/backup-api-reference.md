# Roomly 备份还原 API 参考文档

## 📋 API 概览

备份还原功能提供完整的RESTful API接口，支持程序化操作和集成。

**基础URL**：`/api/backup`  
**认证方式**：需要管理员权限  
**数据格式**：JSON

## 🔐 认证和权限

所有API接口都需要管理员权限验证：

```http
Authorization: Bearer <admin_token>
```

**权限检查**：
- 用户必须已登录
- 用户必须具有管理员角色
- 无权限访问将返回403错误

## 📊 API 接口列表

### 1. 备份管理

#### 创建备份
```http
POST /api/backup/create
```

**请求参数**：
```json
{
  "format": "json|sql",
  "description": "备份描述（可选）"
}
```

**响应示例**：
```json
{
  "success": true,
  "message": "备份创建成功",
  "data": {
    "filename": "backup_20241217_143022.json",
    "size": 2048576,
    "format": "json",
    "checksum": "d41d8cd98f00b204e9800998ecf8427e",
    "created_at": "2024-12-17T14:30:22Z"
  }
}
```

#### 获取备份列表
```http
GET /api/backup/list
```

**查询参数**：
- `page`: 页码（默认：1）
- `page_size`: 每页数量（默认：10）
- `format`: 过滤格式（json|sql）

**响应示例**：
```json
{
  "success": true,
  "data": {
    "backups": [
      {
        "filename": "backup_20241217_143022.json",
        "size": 2048576,
        "format": "json",
        "checksum": "d41d8cd98f00b204e9800998ecf8427e",
        "created_at": "2024-12-17T14:30:22Z",
        "is_valid": true
      }
    ],
    "total": 15,
    "page": 1,
    "page_size": 10,
    "total_pages": 2
  }
}
```

#### 下载备份文件
```http
GET /api/backup/download/:filename
```

**路径参数**：
- `filename`: 备份文件名

**响应**：文件下载流

#### 删除备份文件
```http
DELETE /api/backup/:filename
```

**路径参数**：
- `filename`: 备份文件名

**响应示例**：
```json
{
  "success": true,
  "message": "备份文件删除成功"
}
```

### 2. 数据还原

#### 还原预览
```http
GET /api/backup/restore/preview/:filename
```

**路径参数**：
- `filename`: 备份文件名

**响应示例**：
```json
{
  "success": true,
  "data": {
    "filename": "backup_20241217_143022.json",
    "format": "json",
    "size": 2048576,
    "created_at": "2024-12-17T14:30:22Z",
    "preview": {
      "rooms_count": 25,
      "bookings_count": 150,
      "users_count": 45,
      "total_records": 220
    }
  }
}
```

#### 执行还原
```http
POST /api/backup/restore
```

**请求参数**：
```json
{
  "filename": "backup_20241217_143022.json",
  "create_backup_before_restore": true,
  "confirm": true
}
```

**响应示例**：
```json
{
  "success": true,
  "message": "数据还原成功",
  "data": {
    "restored_records": 220,
    "backup_before_restore": "backup_20241217_150000.json",
    "duration": 15.5
  }
}
```

### 3. 文件验证

#### 验证备份文件
```http
GET /api/backup/validate/:filename
```

**路径参数**：
- `filename`: 备份文件名

**响应示例**：
```json
{
  "success": true,
  "data": {
    "is_valid": true,
    "file_exists": true,
    "file_size": 2048576,
    "checksum": "d41d8cd98f00b204e9800998ecf8427e",
    "format": "json",
    "created_at": "2024-12-17T14:30:22Z",
    "data_integrity": true,
    "errors": [],
    "warnings": []
  }
}
```

#### 校验和验证
```http
GET /api/backup/checksum/:filename
```

**路径参数**：
- `filename`: 备份文件名

**响应示例**：
```json
{
  "success": true,
  "data": {
    "filename": "backup_20241217_143022.json",
    "checksum": "d41d8cd98f00b204e9800998ecf8427e",
    "is_valid": true,
    "calculated_at": "2024-12-17T15:00:00Z"
  }
}
```

#### 清理损坏文件
```http
POST /api/backup/cleanup
```

**请求参数**：
```json
{
  "dry_run": false
}
```

**响应示例**：
```json
{
  "success": true,
  "message": "清理完成",
  "data": {
    "cleaned_files": [
      "backup_20241215_corrupted.json"
    ],
    "cleaned_count": 1,
    "freed_space": 1024000
  }
}
```

### 4. 操作日志

#### 获取操作日志
```http
GET /api/backup/logs
```

**查询参数**：
- `page`: 页码（默认：1）
- `page_size`: 每页数量（默认：10）
- `operation`: 操作类型过滤（backup|restore|delete|validate）
- `status`: 状态过滤（success|failed|in_progress）
- `start_date`: 开始日期（YYYY-MM-DD）
- `end_date`: 结束日期（YYYY-MM-DD）

**响应示例**：
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": 1,
        "operation": "backup",
        "status": "success",
        "filename": "backup_20241217_143022.json",
        "format": "json",
        "size": 2048576,
        "checksum": "d41d8cd98f00b204e9800998ecf8427e",
        "created_by": "admin",
        "duration": 12.5,
        "created_at": "2024-12-17T14:30:22Z",
        "completed_at": "2024-12-17T14:30:35Z",
        "error_msg": null
      }
    ],
    "total": 50,
    "page": 1,
    "page_size": 10,
    "total_pages": 5
  }
}
```

#### 清理操作日志
```http
DELETE /api/backup/logs
```

**请求参数**：
```json
{
  "older_than_days": 30,
  "keep_failed_logs": true
}
```

**响应示例**：
```json
{
  "success": true,
  "message": "日志清理完成",
  "data": {
    "deleted_count": 25,
    "kept_count": 25
  }
}
```

## 🚨 错误处理

### 标准错误响应格式
```json
{
  "success": false,
  "error": "错误类型",
  "message": "详细错误信息",
  "code": "ERROR_CODE"
}
```

### 常见错误代码

| HTTP状态码 | 错误代码 | 说明 |
|-----------|---------|------|
| 400 | INVALID_REQUEST | 请求参数无效 |
| 401 | UNAUTHORIZED | 未认证 |
| 403 | FORBIDDEN | 权限不足 |
| 404 | NOT_FOUND | 资源不存在 |
| 409 | CONFLICT | 操作冲突 |
| 500 | INTERNAL_ERROR | 服务器内部错误 |

### 具体错误示例

#### 权限不足
```json
{
  "success": false,
  "error": "FORBIDDEN",
  "message": "需要管理员权限",
  "code": "ADMIN_REQUIRED"
}
```

#### 文件不存在
```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "备份文件不存在",
  "code": "BACKUP_FILE_NOT_FOUND"
}
```

#### 备份创建失败
```json
{
  "success": false,
  "error": "INTERNAL_ERROR",
  "message": "备份创建失败：磁盘空间不足",
  "code": "BACKUP_CREATE_FAILED"
}
```

## 📝 使用示例

### JavaScript/TypeScript 示例

```typescript
// 备份API客户端
class BackupAPI {
  private baseURL = '/api/backup';
  
  // 创建备份
  async createBackup(format: 'json' | 'sql'): Promise<BackupResponse> {
    const response = await fetch(`${this.baseURL}/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getToken()}`
      },
      body: JSON.stringify({ format })
    });
    
    return response.json();
  }
  
  // 获取备份列表
  async getBackupList(page = 1, pageSize = 10): Promise<BackupListResponse> {
    const response = await fetch(
      `${this.baseURL}/list?page=${page}&page_size=${pageSize}`,
      {
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        }
      }
    );
    
    return response.json();
  }
  
  // 执行还原
  async restoreBackup(filename: string, createBackup = true): Promise<RestoreResponse> {
    const response = await fetch(`${this.baseURL}/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getToken()}`
      },
      body: JSON.stringify({
        filename,
        create_backup_before_restore: createBackup,
        confirm: true
      })
    });
    
    return response.json();
  }
  
  private getToken(): string {
    // 获取认证token的逻辑
    return localStorage.getItem('admin_token') || '';
  }
}
```

### cURL 示例

```bash
# 创建JSON格式备份
curl -X POST /api/backup/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"format": "json"}'

# 获取备份列表
curl -X GET "/api/backup/list?page=1&page_size=10" \
  -H "Authorization: Bearer <token>"

# 下载备份文件
curl -X GET /api/backup/download/backup_20241217_143022.json \
  -H "Authorization: Bearer <token>" \
  -o backup.json

# 执行数据还原
curl -X POST /api/backup/restore \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "filename": "backup_20241217_143022.json",
    "create_backup_before_restore": true,
    "confirm": true
  }'
```

## 🔄 API 版本控制

当前API版本：**v1**

版本信息包含在响应头中：
```http
X-API-Version: v1
X-Backup-System-Version: 1.0.0
```

## 📊 速率限制

为保护系统性能，API实施以下限制：

- **备份创建**：每小时最多10次
- **数据还原**：每小时最多5次
- **文件下载**：每分钟最多20次
- **其他操作**：每分钟最多100次

超出限制将返回429状态码。

## 🔍 监控和日志

所有API调用都会记录到系统日志中，包括：
- 请求时间和耗时
- 用户身份和IP地址
- 操作结果和错误信息
- 资源使用情况

---

**版本**：v1.0  
**更新时间**：2024年12月17日  
**维护者**：Roomly开发团队