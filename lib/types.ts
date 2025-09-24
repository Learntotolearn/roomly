// 基础类型定义
export interface Member {
  id: number;
  name: string;
  dootask_id: number;
  is_admin: boolean;
  is_room_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: number;
  name: string;
  description: string;
  capacity: number;
  is_open: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: number;
  room_id: number;
  member_id: number;
  date: string;
  start_time: string;
  end_time: string;
  reason: string;
  cancel_reason?: string; // 取消理由
  status: 'active' | 'cancelled' | 'expired';
  summary_content?: string; // 会议纪要内容
  created_at: string;
  updated_at: string;
  room: Room;
  member: Member;
  booking_users: BookingUser[];
}

export interface BookingUser {
  userid: number;
  nickname: string;
}

export interface TimeSlot {
  start: string;
  end: string;
  is_booked: boolean;
}

// 备份相关类型
export interface BackupInfo {
  id: string;
  filename: string;
  file_path: string;
  format: 'sql' | 'json';
  size: number;
  created_at: string;
  created_by: string;
  is_valid: boolean;
  description?: string;
}

export interface BackupData {
  version: string;
  created_at: string;
  created_by: string;
  description: string;
  members: Member[];
  rooms: Room[];
  bookings: Booking[];
  booking_users: BookingUser[];
}

export interface RestoreRequest {
  filename: string;
  description?: string;
}



export interface AvailableSlots {
  date: string;
  time_slots: TimeSlot[];
}

export interface BookingRequest {
  room_id: number;
  member_id: number;
  date: string;
  time_slots: string[];
  reason: string;
  booking_users: BookingUser[];
}

// 录音相关类型
export interface Recording {
  id: number;
  title: string;
  audio_file: string;
  duration: number | null;
  upload_time: string;
  created_at: string;
  analysis?: string;
}

// API响应类型
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
} 