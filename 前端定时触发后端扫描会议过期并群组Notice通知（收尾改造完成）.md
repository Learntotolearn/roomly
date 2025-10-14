# 前端定时触发后端扫描会议过期并群组Notice通知（收尾改造完成）

## Core Features

- 前端轮询改为60秒，后台标签不轮询

- 后端扫描active会议，过期发送Notice“会议已结束”

- 禁用后端定时任务避免状态竞争

- 过期判断与主逻辑一致（Asia/Shanghai+结束时间计算）

- 日志收敛：保留发送前/成功/失败与必要提示

- 清理废弃SendMessageWithToken，统一CreateGroupAndNotify或群内发送

- 取消与新增参会人通知通道对齐（群内文本+Notice/机器人可选）

## Tech Stack

{
  "Web": {
    "arch": "react",
    "component": "shadcn"
  },
  "iOS": "",
  "Android": ""
}

## Design

仅通过 /api/bookings/scan-expired 执行过期判定、发送Notice与更新状态；其他通知接口统一新通道。

## Plan

Note: 

- [ ] is holding
- [/] is doing
- [X] is done

---

[X] 轮询改为60秒

[X] 日志收敛

[X] 清理废弃调用

[X] 修复编译错误

[/] 联调与验证
