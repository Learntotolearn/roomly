# 将会议纪要发送到当前会议群组(DialogID)

## Core Features

- 后端 POST /api/bookings/:id/summary/send 已提供

- 前端 my-bookings 接入调用

- 发送内容优先使用编辑框文本，若为空则生成完整模板（含要点/行动/备注）

## Tech Stack

{
  "Web": {
    "arch": "react",
    "component": "shadcn"
  }
}

## Design

避免发送“暂无会议纪要内容”，保证群消息始终包含完整模板或编辑内容。

## Plan

Note: 

- [ ] is holding
- [/] is doing
- [X] is done

---

[X] 确认方案

[X] 后端新增接口与路由

[X] 前端API封装与按钮接入

[X] 联调与验证
