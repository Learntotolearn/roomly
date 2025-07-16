import { Member, Room, Booking, BookingRequest, AvailableSlots } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

// 基础API调用函数
async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }

  return response.json();
}

// 会员相关API
export const memberApi = {
  // 获取所有会员（无分页，返回全量数组）
  getAll: () => apiCall<Member[]>('/members'),
  
  // 获取单个会员
  get: (id: number) => apiCall<Member>(`/members/${id}`),

  // 根据dootask_id获取会员
  getForDootaskId: (dootaskId: number) => apiCall<Member>(`/members/${dootaskId}/dootask`),
  
  // 创建会员
  create: (member: Omit<Member, 'id' | 'created_at' | 'updated_at'>) =>
    apiCall<Member>('/members', {
      method: 'POST',
      body: JSON.stringify(member),
    }),
  
  // 更新会员
  update: (id: number, member: Partial<Member>) =>
    apiCall<Member>(`/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(member),
    }),
  
  // 删除会员
  delete: (id: number) =>
    apiCall<{ message: string }>(`/members/${id}`, {
      method: 'DELETE',
    }),
  
  // 设置管理员权限
  setAdminPermission: (id: number, isAdmin: boolean) =>
    apiCall<Member>(`/members/${id}/admin`, {
      method: 'PUT',
      body: JSON.stringify({ is_admin: isAdmin }),
    }),
  
  // 设置会议室管理员权限
  setRoomAdminPermission: (id: number, isRoomAdmin: boolean) =>
    apiCall<Member>(`/members/${id}/room-admin`, {
      method: 'PUT',
      body: JSON.stringify({ is_room_admin: isRoomAdmin }),
    }),
  
  // 获取会员的预订记录
  getBookings: (memberId: number) =>
    apiCall<Booking[]>(`/members/${memberId}/bookings`),
};

// 会议室相关API
export const roomApi = {
  // 获取所有会议室
  getAll: () => apiCall<Room[]>('/rooms'),
  
  // 获取开放的会议室
  getOpen: () => apiCall<Room[]>('/rooms/open'),
  
  // 获取单个会议室
  get: (id: number) => apiCall<Room>(`/rooms/${id}`),
  
  // 创建会议室
  create: (room: Omit<Room, 'id' | 'created_at' | 'updated_at'>) =>
    apiCall<Room>('/rooms', {
      method: 'POST',
      body: JSON.stringify(room),
    }),
  
  // 更新会议室
  update: (id: number, room: Partial<Room>) =>
    apiCall<Room>(`/rooms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(room),
    }),
  
  // 删除会议室
  delete: (id: number) =>
    apiCall<{ message: string }>(`/rooms/${id}`, {
      method: 'DELETE',
    }),
  
  // 切换会议室状态
  toggleStatus: (id: number) =>
    apiCall<Room>(`/rooms/${id}/toggle`, {
      method: 'PUT',
    }),
  
  // 获取会议室的预订记录
  getBookings: (roomId: number) =>
    apiCall<Booking[]>(`/rooms/${roomId}/bookings`),
};

// 预订相关API
export const bookingApi = {
  // 获取所有预订记录
  getAll: () => apiCall<Booking[]>('/bookings'),
  
  // 创建预订
  create: (booking: BookingRequest) =>
    apiCall<Booking>('/bookings', {
      method: 'POST',
      body: JSON.stringify(booking),
    }),
  
  // 取消预订
  cancel: (id: number) =>
    apiCall<{ message: string }>(`/bookings/${id}/cancel`, {
      method: 'PUT',
    }),
  
  // 获取可用时间段
  getAvailableSlots: (roomId: number, date: string) =>
    apiCall<AvailableSlots>(`/bookings/available-slots?room_id=${roomId}&date=${date}`),
};

// 导出相关API
export const exportApi = {
  // 导出预订记录
  exportBookings: (params: {
    start_date?: string;
    end_date?: string;
    room_id?: number;
    member_id?: number;
    status?: string;
  }) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value.toString());
      }
    });
    
    return `${API_BASE_URL}/export/bookings?${queryParams.toString()}`;
  },
  
  // 导出会议室使用统计
  exportRoomUsage: (params: {
    start_date?: string;
    end_date?: string;
  }) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value.toString());
      }
    });
    
    return `${API_BASE_URL}/export/room-usage?${queryParams.toString()}`;
  },
}; 

export const userApi = {
  getBasic: (userIds: number[], token?: string, date?: string, timeSlots?: string[], roomName?: string) => {
    let query = userIds.map(id => `userid[]=${id}`).join('&');
    if (date) query += `&date=${encodeURIComponent(date)}`;
    if (timeSlots && timeSlots.length > 0) {
      query += timeSlots.map(slot => `&time_slots[]=${encodeURIComponent(slot)}`).join('');
    }
    if (roomName) query += `&room_name=${encodeURIComponent(roomName)}`;
    return apiCall(
      '/users/basic?' + query,
      token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : undefined
    );
  },
}; 