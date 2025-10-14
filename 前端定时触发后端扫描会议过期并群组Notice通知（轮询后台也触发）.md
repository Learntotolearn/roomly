# 前端定时触发后端扫描会议过期并群组Notice通知（轮询后台也触发）

## Core Features

- 轮询改为后台也触发（refetchIntervalInBackground=true）

- enabled 固定为 true，确保始终轮询

- 轮询间隔保持 60 秒

## Tech Stack

{
  "Web": {
    "arch": "react",
    "component": "shadcn"
  }
}

## Design

确保无论页面是否在前台，轮询都稳定触发 /api/bookings/scan-expired。

## Plan

Note: 

- [ ] is holding
- [/] is doing
- [X] is done

---

[X] 轮询改为后台也触发

[X] 联调与验证
