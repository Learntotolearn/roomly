import { Member, Room, Booking, BookingRequest, AvailableSlots, MeetingMinutes, MinutesRequest, SpeechToText, SpeechToTextRequest } from './types';
import { getUserInfo } from '@dootask/tools';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8089/api';

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
  // 获取所有会员（支持分页、搜索、角色过滤）
  getAll: (params?: { page?: number; page_size?: number; search?: string; role?: string }) => {
    let url = '/members';
    if (params) {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.append('page', String(params.page));
      if (params.page_size) searchParams.append('page_size', String(params.page_size));
      if (params.search) searchParams.append('search', params.search);
      if (params.role) searchParams.append('role', params.role);
      url += '?' + searchParams.toString();
    }
    return apiCall<{ data: Member[]; total: number }>(url);
  },
  
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
  
  // 获取会员预定（支持分页和分组）
  getBookings: (memberId: number, params?: { page?: number; page_size?: number; status?: string }) => {
    let url = `/members/${memberId}/bookings`;
    if (params) {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.append('page', String(params.page));
      if (params.page_size) searchParams.append('page_size', String(params.page_size));
      if (params.status) searchParams.append('status', params.status);
      url += '?' + searchParams.toString();
    }
    return apiCall<{ data: Booking[]; total: number }>(url);
  },
};

// 会议室相关API
export const roomApi = {
  // 获取所有会议室（支持分页）
  getAll: (params?: { page?: number; page_size?: number }) => {
    let url = '/rooms';
    if (params) {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.append('page', String(params.page));
      if (params.page_size) searchParams.append('page_size', String(params.page_size));
      url += '?' + searchParams.toString();
    }
    return apiCall<{ data: Room[]; total: number }>(url);
  },
  
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
  getAll: (params?: { page?: number; page_size?: number; start_date?: string; end_date?: string; status?: string; sort_by?: string; sort_order?: string }) => {
    let url = '/bookings';
    if (params) {
      const search = new URLSearchParams();
      if (params.page) search.append('page', String(params.page));
      if (params.page_size) search.append('page_size', String(params.page_size));
      if (params.start_date) search.append('start_date', params.start_date);
      if (params.end_date) search.append('end_date', params.end_date);
      if (params.status) search.append('status', params.status);
      if (params.sort_by) search.append('sort_by', params.sort_by);
      if (params.sort_order) search.append('sort_order', params.sort_order);
      url += '?' + search.toString();
    }
    return apiCall<{ data: Booking[]; total: number }>(url);
  },
  
  // 创建预订
  create: async (booking: BookingRequest) => {
    let token = '';
    try {
      const userInfo = await getUserInfo();
      token = userInfo?.token || '';
    } catch {
      token = localStorage.getItem('token') || '';
    }
    return apiCall<Booking>('/bookings', {
      method: 'POST',
      body: JSON.stringify(booking),
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  },
  
  // 取消预订
  cancel: async (id: number) => {
    let token = '';
    try {
      const userInfo = await getUserInfo();
      token = userInfo?.token || '';
    } catch {
      token = localStorage.getItem('token') || '';
    }
    return apiCall<{ message: string }>(`/bookings/${id}/cancel`, {
      method: 'PUT',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  },
  
  // 获取可用时间段
  getAvailableSlots: (roomId: number, date: string) =>
    apiCall<AvailableSlots>(`/bookings/available-slots?room_id=${roomId}&date=${date}`),
  
  // 获取预定的会议纪要
  getMinutes: (bookingId: number) =>
    apiCall<MeetingMinutes[]>(`/bookings/${bookingId}/minutes`),
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

// 会议纪要相关API
export const minutesApi = {
  // 获取所有会议纪要
  getAll: (params?: { booking_id?: number; status?: string; created_by?: number }) => {
    let url = '/minutes';
    if (params) {
      const searchParams = new URLSearchParams();
      if (params.booking_id) searchParams.append('booking_id', String(params.booking_id));
      if (params.status) searchParams.append('status', params.status);
      if (params.created_by) searchParams.append('created_by', String(params.created_by));
      url += '?' + searchParams.toString();
    }
    return apiCall<MeetingMinutes[]>(url);
  },
  
  // 获取单个会议纪要
  get: (id: number) => apiCall<MeetingMinutes>(`/minutes/${id}`),
  
  // 创建会议纪要
  create: (minutes: MinutesRequest) =>
    apiCall<MeetingMinutes>('/minutes', {
      method: 'POST',
      body: JSON.stringify(minutes),
    }),
  
  // 更新会议纪要
  update: (id: number, minutes: MinutesRequest) =>
    apiCall<MeetingMinutes>(`/minutes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(minutes),
    }),
  
  // 删除会议纪要
  delete: (id: number) =>
    apiCall<{ message: string }>(`/minutes/${id}`, {
      method: 'DELETE',
    }),
};

// 语音转文字相关API
export const speechApi = {
  // 处理语音转文字
  processSpeechToText: (request: SpeechToTextRequest) =>
    apiCall<SpeechToText>('/speech/to-text', {
      method: 'POST',
      body: JSON.stringify(request),
    }),
  
  // 获取语音转文字状态
  getStatus: (id: number) => apiCall<SpeechToText>(`/speech/to-text/${id}`),
}; 