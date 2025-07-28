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

// API响应类型
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
} 