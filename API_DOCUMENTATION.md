# Roomly API 文档

## 会议纪要通知API

### 发送会议纪要通知

**接口地址：** `GET /api/users/summary`

**功能描述：** 向指定用户发送会议纪要通知

**请求参数：**

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| userid[] | array | 是 | 用户ID数组 |
| summary_content | string | 是 | 会议纪要内容 |
| date | string | 否 | 会议日期 (YYYY-MM-DD) |
| time_slots[] | array | 否 | 时间段数组 |
| room_name | string | 否 | 会议室名称 |

**请求头：**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**请求示例：**
```bash
curl -X GET "http://localhost:8080/api/users/summary?userid[]=1&userid[]=2&summary_content=会议纪要内容&date=2024-01-15&time_slots[]=09:00&time_slots[]=10:00&room_name=会议室A" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json"
```

**响应示例：**
```json
{
  "status": "ok"
}
```

**错误响应：**
```json
{
  "error": "用户ID不能为空"
}
```

## 前端集成

### 发送会议纪要通知

在前端代码中，可以使用以下方式发送会议纪要通知：

```typescript
import { userApi } from '@/lib/api';

// 发送会议纪要通知
const sendMeetingSummary = async () => {
  try {
    const userIds = [1, 2, 3]; // 参会人员ID
    const summaryContent = "会议纪要内容...";
    const date = "2024-01-15";
    const timeSlots = ["09:00", "10:00"];
    const roomName = "会议室A";
    
    const result = await userApi.sendMeetingSummary(
      userIds,
      summaryContent,
      date,
      timeSlots,
      roomName
    );
    
    console.log('发送成功:', result);
  } catch (error) {
    console.error('发送失败:', error);
  }
};
```

## 消息格式

发送的会议纪要通知消息格式如下：

```markdown
## 📋  会议纪要通知
### **会议纪要已生成，请查看**

- **会议室**：会议室A
- **会议时间**：2024-01-15 09:00-10:00
- **参会人员**：张三、李四、王五
- **会议发起人**：张三 (产品经理)

### **会议纪要内容**
会议纪要的具体内容...

> 请及时查看会议纪要内容，如有疑问请联系会议发起人。
```

## 注意事项

1. 用户ID必须是有效的DooTask用户ID
2. 会议纪要内容支持Markdown格式
3. 通知会异步发送，不会阻塞主流程
4. 需要有效的DooTask token才能发送通知
5. 系统会自动去重用户ID，避免重复发送
