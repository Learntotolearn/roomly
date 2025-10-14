# 前端定时触发后端扫描会议过期并群组Notice通知（轮询问题排查）

## Core Features

- 确认 ScanExpiredTicker 是否挂载在布局

- 检查 enabled 与 refetchIntervalInBackground 设置导致不轮询

- 必要时恢复 enabled=true、refetchIntervalInBackground=true（60秒）

## Tech Stack

{
  "Web": {
    "arch": "react",
    "component": "shadcn"
  }
}

## Design

确保扫描器稳定轮询，无论页面前后台均能按需触发。

## Plan

Note: 

- [ ] is holding
- [/] is doing
- [X] is done

---

[X] 轮询改为60秒

[/] 联调与验证

[/] 轮询问题排查
