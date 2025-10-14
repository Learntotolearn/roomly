import { Member, Room, Booking, BookingRequest, AvailableSlots, BookingUser } from './types';
import { getUserInfo } from '@dootask/tools';

// const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://lan-dootask.keli.vip/apps/roomly/api';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090/api';


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
    const text = await response.text().catch(() => '');
    // 抛出包含状态码与返回文本的错误，便于前端区分 409 冲突等
    throw new Error(`API ${response.status} ${response.statusText}${text ? `: ${text}` : ''}`);
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

// 备份相关API
export { backupApi } from './api/backup';

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
  cancel: async (id: number, cancelReason: string) => {
    let token = '';
    try {
      const userInfo = await getUserInfo();
      token = userInfo?.token || '';
    } catch {
      token = localStorage.getItem('token') || '';
    }
    return apiCall<{ message: string }>(`/bookings/${id}/cancel`, {
      method: 'PUT',
      body: JSON.stringify({ cancel_reason: cancelReason }),
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  },

  // 更新预定参会人员
  updateBookingUsers: async (id: number, bookingUsers: BookingUser[]) => {
    let token = '';
    try {
      const userInfo = await getUserInfo();
      token = userInfo?.token || '';
    } catch {
      token = localStorage.getItem('token') || '';
    }
    
    // 打印请求数据，用于调试
    console.log('Updating booking users:', { id, bookingUsers });
    
    const response = await fetch(`${API_BASE_URL}/bookings/${id}/users`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ booking_users: bookingUsers }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error updating booking users:', errorText);
      throw new Error(`Failed to update booking users: ${response.statusText}`);
    }
    
    return response.json();
  },

  // 获取可用时间段（支持排除某个预定ID，用于修改时间时不把自身标记为占用）
  getAvailableSlots: (roomId: number, date: string, excludeBookingId?: number) => {
    const base = `/bookings/available-slots?room_id=${roomId}&date=${date}`;
    const url = excludeBookingId ? `${base}&exclude_booking_id=${excludeBookingId}` : base;
    return apiCall<AvailableSlots>(url);
  },

  // 修改预定时间
  reschedule: async (id: number, payload: { date: string; time_slots: string[]; change_reason: string }) => {
    let token = '';
    try {
      const userInfo = await getUserInfo();
      token = userInfo?.token || '';
    } catch {
      token = localStorage.getItem('token') || '';
    }
    return apiCall<Booking>(`/bookings/${id}/reschedule`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  },

  // 将会议纪要发送到当前会议的群组（DialogID）
  sendSummaryToGroup: async (bookingId: number, summaryContent?: string) => {
    try {
      const { getUserToken } = await import('@dootask/tools');
      let token = '';
      try {
        token = await getUserToken();
      } catch (e) {
        console.error('[send-summary] getUserToken failed');
      }
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const hasBody = !!(summaryContent && summaryContent.trim());
      if (hasBody) headers['Content-Type'] = 'application/json';

      const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}/summary/send`, {
        method: 'POST',
        headers,
        body: hasBody ? JSON.stringify({ summary_content: summaryContent }) : undefined,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || '发送会议纪要失败');
      }
      return await res.json();
    } catch (err) {
      console.error('sendSummaryToGroup error:', err as any);
      throw err;
    }
  },

  // 保存会议纪要（外部录音服务）：优先按 groupId 更新；否则按 groupName upsert
  saveMeetingSummary: async (
    groupId: number,
    summaryContent: string,
    groupName?: string
  ) => {
    const token = await getRecordSrvToken();
    if (groupId && groupId > 0) {
      return recordingGroupApi.partialUpdate(groupId, { analysis: summaryContent }, token);
    }
    if (groupName && groupName.trim().length > 0) {
      return recordingGroupApi.upsertByName(groupName, { analysis: summaryContent }, token);
    }
    throw new Error('saveMeetingSummary 需要提供有效的 RecordingGroup id 或 name');
  },

  // 移除无效接口：getMeetingSummary（/bookings/{id}/summary）
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

  sendMeetingSummary: async (userIds: number[], summaryContent: string, date?: string, timeSlots?: string[], roomName?: string) => {
    let token = '';
    try {
      const userInfo = await getUserInfo();
      token = userInfo?.token || '';
    } catch {
      token = localStorage.getItem('token') || '';
    }

    // 使用 POST JSON 方式发送会议纪要通知
    const payload: Record<string, unknown> = {
      user_ids: userIds,
      summary_content: summaryContent,
    };
    if (date) payload.date = date;
    if (timeSlots && timeSlots.length > 0) payload.time_slots = timeSlots;
    if (roomName) payload.room_name = roomName;

    return apiCall(
      '/users/summary',
      {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    );
  },
}; 

// 外部录音服务：RecordingGroup CRUD（通过环境变量配置，避免写死）
const RECORDSRV_BASE =
  process.env.NEXT_PUBLIC_RECORDSRV_BASE || 'https://recordsrv-server.keli.vip';
const RECORDSRV_USERNAME =
  process.env.NEXT_PUBLIC_RECORDSRV_USERNAME || 'admin';
const RECORDSRV_PASSWORD =
  process.env.NEXT_PUBLIC_RECORDSRV_PASSWORD || 'admin';

async function getRecordSrvToken(): Promise<string> {
  const res = await fetch(`${RECORDSRV_BASE}/api/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: RECORDSRV_USERNAME, password: RECORDSRV_PASSWORD }),
  });
  if (!res.ok) throw new Error('recordsrv 获取 token 失败');
  const data = await res.json();
  return data.access as string;
}

export interface RecordingGroupPayload {
  name: string;
  audio_file?: string;
  status?: string;
  analysis?: string;
  group?: number[];
}

export const recordingGroupApi = {
  // 查询（按名称）
  async getByName(name: string, token?: string) {
    token = token || (await getRecordSrvToken());
    const url = `${RECORDSRV_BASE}/recordings/RecordingGroup/?name=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('查询 RecordingGroup 失败');
    return res.json();
  },

  // 获取单条（按ID）
  async get(id: number, token?: string) {
    token = token || (await getRecordSrvToken());
    const res = await fetch(`${RECORDSRV_BASE}/recordings/RecordingGroup/${id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('获取 RecordingGroup 失败');
    return res.json();
  },

  // 新增
  async create(payload: RecordingGroupPayload, token?: string) {
    token = token || (await getRecordSrvToken());
    const res = await fetch(`${RECORDSRV_BASE}/recordings/RecordingGroup/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('创建 RecordingGroup 失败');
    return res.json();
  },

  // 全量修改（PUT）
  async update(id: number, payload: Partial<RecordingGroupPayload>, token?: string) {
    token = token || (await getRecordSrvToken());
    const res = await fetch(`${RECORDSRV_BASE}/recordings/RecordingGroup/${id}/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('更新 RecordingGroup 失败');
    return res.json();
  },

 

  // 局部修改（仅修改传入字段，保留其余不变）
  async partialUpdate(id: number, payload: Partial<RecordingGroupPayload>, token?: string) {
    token = token || (await getRecordSrvToken());
    const res = await fetch(`${RECORDSRV_BASE}/recordings/RecordingGroup/${id}/`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`部分更新 RecordingGroup 失败: ${res.status} ${res.statusText} ${errText}`);
    }
    return res.json();
  },

  // 删除
  async delete(id: number, token?: string) {
    token = token || (await getRecordSrvToken());
    const res = await fetch(`${RECORDSRV_BASE}/recordings/RecordingGroup/${id}/`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('删除 RecordingGroup 失败');
    return { success: true } as const;
  },
  
  // 通过 name upsert：存在则 PATCH，不存在则 CREATE
  async upsertByName(name: string, payload: Partial<RecordingGroupPayload>, token?: string) {
    token = token || (await getRecordSrvToken());
    const list = await this.getByName(name, token);
    const first = Array.isArray(list) && list.length > 0 ? list[0] : null;
    if (first) {
      const id = first.id ?? first.Id;
      return this.partialUpdate(id, payload, token);
    }
    return this.create({ name, ...payload }, token);
  },
};