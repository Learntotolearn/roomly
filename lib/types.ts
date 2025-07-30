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
  status: 'active' | 'cancelled' | 'expired';
  created_at: string;
  updated_at: string;
  room: Room;
  member: Member;
  booking_users: BookingUser[];
  minutes?: MeetingMinutes[];
}

export interface BookingUser {
  userid: number;
  nickname: string;
}

// 会议纪要类型
export interface MeetingMinutes {
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
  booking?: Booking;
  creator?: Member;
  updater?: Member;
}

// 语音转文字类型
export interface SpeechToText {
  id: number;
  booking_id: number;
  audio_file: string;
  text: string;
  status: 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  booking?: Booking;
}

export interface TimeSlot {
  start: string;
  end: string;
  is_booked: boolean;
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

// 会议纪要请求类型
export interface MinutesRequest {
  booking_id: number;
  title: string;
  content?: string;
  summary?: string;
  key_points?: string;
  action_items?: string;
  status?: string;
}

// 语音转文字请求类型
export interface SpeechToTextRequest {
  booking_id: number;
  audio_file: string;
}

// API响应类型
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
} 