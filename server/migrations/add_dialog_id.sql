-- 添加 dialog_id 字段到 bookings 表
-- 用于存储群组ID，以便发送会议结束通知

ALTER TABLE bookings ADD COLUMN dialog_id INTEGER DEFAULT 0;

-- 为现有记录设置默认值
UPDATE bookings SET dialog_id = 0 WHERE dialog_id IS NULL;

-- 添加注释
COMMENT ON COLUMN bookings.dialog_id IS '群组ID，用于发送会议结束通知';
