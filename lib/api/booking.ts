import { getUserToken } from '@dootask/tools';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export const bookingApi = {
  async getAvailableSlots(roomId: number, date: string) {
    const url = new URL(`${API_BASE}/bookings/available-slots`, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    url.searchParams.set('room_id', String(roomId));
    url.searchParams.set('date', date);
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error('获取可用时间段失败');
    }
    return response.json();
  },

  async create(bookingData: any) {
    const response = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingData),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || '预定失败');
    }
    return response.json();
  },

  async scanExpired() {
    const headers: Record<string, string> = {}

    // 1) 优先使用 @dootask/tools 获取令牌
    let token = ''
    try {
      token = await getUserToken()
    } catch (e) {
      console.error('[scan-expired] getUserToken failed')
    }

    // 2) 兜底：localStorage 属性与 Cookie
    if (typeof window !== 'undefined') {
      if (!token || token.length === 0) {
        const lsItem = window.localStorage.getItem('appstore_user_token') || ''
        const lsProp = (window.localStorage as any).appstore_user_token ? String((window.localStorage as any).appstore_user_token) : ''
        let ck = ''
        const m = document.cookie.match(/(?:^|;\s*)appstore_user_token=([^;]+)/)
        if (m && m[1]) {
          ck = decodeURIComponent(m[1])
        }
        token = lsItem || lsProp || ck || ''
      }
    }

    // 3) 清洗令牌：去空白与首尾引号，避免出现 Bearer "xxx"
    token = token.trim().replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, '')
    const masked = token.length > 12 ? `${token.slice(0,6)}...${token.slice(-6)}` : (token || '(none)')
    console.log('[scan-expired] Authorization token:', masked, 'len=', token.length)

    if (token && token.length > 0) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${API_BASE}/bookings/scan-expired`, {
      method: 'GET',
      cache: 'no-store',
      headers,
    });
    if (!response.ok) {
      throw new Error('扫描过期会议失败');
    }
    return response.json();
  },

  async sendSummaryToGroup(bookingId: number, summaryContent?: string) {
    // 读取用户令牌
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

    const res = await fetch(`${API_BASE}/bookings/${bookingId}/summary/send`, {
      method: 'POST',
      headers,
      body: hasBody ? JSON.stringify({ summary_content: summaryContent }) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || '发送会议纪要失败');
    }
    return res.json();
  },
};