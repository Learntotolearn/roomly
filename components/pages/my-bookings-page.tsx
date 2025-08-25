'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { memberApi, bookingApi, userApi } from '@/lib/api';
import { useAppContext } from '@/lib/context/app-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Calendar, Clock, MapPin, X, CalendarOff, Loader2, Timer, RefreshCcw } from 'lucide-react';
import { MicrophoneIcon, StopIcon, SearchIcon, AiIcon, PlaneIcon } from '@/components/ui/icons';
import { AudioPlayer } from '@/components/ui/audio-player';
import { format, parseISO } from 'date-fns';
import { Booking } from '@/lib/types';
import { calculateDuration, formatDuration } from '@/lib/utils';
import { useState, useEffect, useRef, useCallback } from 'react';
import { CancelBookingDialog } from '@/components/ui/cancel-booking-dialog';
import { requestAPI } from "@dootask/tools"
import { toast } from "sonner";

// 录音状态接口
interface RecordingState {
  isRecording: boolean;
  audioURL: string | null;
  uploading: boolean;
  analyzing: boolean; // 新增：分析状态
  recordId: number | null;
  recordings: Recording[];
  selectedId: number | null;
}

// 录音数据接口
interface Recording {
  id: number;
  title: string;
  upload_time: string;
  audio_file: string;
  analysis?: string | null;
  created_at?: string;
  duration?: number | null;
}

export default function MyBookingsPage() {
  const { currentMember } = useAppContext();
  const queryClient = useQueryClient();

  // 强制刷新计数器
  const [refreshCounter, setRefreshCounter] = useState(0);
  // 只展开当前录音卡片
  const [openRecordingBookingId, setOpenRecordingBookingId] = useState<number | null>(null);

  // 取消预定弹窗
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelBookingId, setCancelBookingId] = useState<number | null>(null);

  // 列表状态
  const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
  const [expiredBookings, setExpiredBookings] = useState<Booking[]>([]);
  const [cancelledBookings, setCancelledBookings] = useState<Booking[]>([]);
  const [activeLoading, setActiveLoading] = useState(false);
  const [expiredLoading, setExpiredLoading] = useState(false);
  const [cancelledLoading, setCancelledLoading] = useState(false);
  const [activeShowCount, setActiveShowCount] = useState(10);
  const [expiredShowCount, setExpiredShowCount] = useState(10);
  const [cancelledShowCount, setCancelledShowCount] = useState(10);

  // 录音状态
  const [recordingStates, setRecordingStates] = useState<Record<number, RecordingState>>({});
  const mediaRecordersRef = useRef<Record<number, MediaRecorder | null>>({});

  const getRecordingState = (bookingId: number): RecordingState => {
    if (!recordingStates[bookingId]) {
      const defState: RecordingState = {
        isRecording: false,
        audioURL: null,
        uploading: false,
        analyzing: false,
        recordId: null,
        recordings: [],
        selectedId: null,
      };
      setRecordingStates(prev => ({ ...prev, [bookingId]: defState }));
      return { ...defState };
    }
    return { ...recordingStates[bookingId] };
  };

  const updateRecordingState = (bookingId: number, updates: Partial<RecordingState>) => {
    setRecordingStates(prev => ({
      ...prev,
      [bookingId]: { ...(prev[bookingId] ?? getRecordingState(bookingId)), ...updates },
    }));
  };

  const loginAndGetToken = async () => {
    const res = await fetch('https://recordsrv-server.keli.vip/api/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin' }),
    });
    const data = await res.json();
    return data.access;
  };

  const fetchRecordings = async (bookingId: number, title: string) => {
    try {
      const token = await loginAndGetToken();
      const res = await fetch(`https://recordsrv-server.keli.vip/recordings/Recording/?title=${encodeURIComponent(title)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('获取录音信息失败');
      const data: Recording[] = await res.json();

      console.log('获取到的原始录音数据:', data);

      const clean = data.map(r => {
        // 使用类型断言处理服务器返回的数据格式
        const serverData = r as any;
        return {
          ...r,
          id: serverData.id || serverData.Id, // 兼容大小写
          title: (serverData.title || '').replace(/\s*-\s*$/, '').replace(/\s*Invalid Date\s*$/, ''),
          duration: serverData.duration || null, // 允许 duration 为 null
        };
      });
      const matched = clean.filter(r => (r.title || '').includes(title) || title.includes(r.title || ''));
      const list = matched.length > 0 ? matched : clean;
      
      // 去重：根据 ID 去重，保留最新的
      const uniqueMap = new Map<number, Recording>();
      list.forEach(r => {
        if (!uniqueMap.has(r.id) || new Date(r.upload_time) > new Date(uniqueMap.get(r.id)!.upload_time)) {
          uniqueMap.set(r.id, r);
        }
      });
      const uniqueList = Array.from(uniqueMap.values());
      
      // 按上传时间排序
      uniqueList.sort((a, b) => new Date(b.upload_time).getTime() - new Date(a.upload_time).getTime());

      console.log('处理后的录音列表:', uniqueList.map(r => ({ id: r.id, title: r.title, upload_time: r.upload_time })));

      const currentSelectedId = recordingStates[bookingId]?.selectedId ?? null;
      const keep = currentSelectedId !== null && uniqueList.some(r => r.id === currentSelectedId);
      const newSelectedId = keep ? currentSelectedId : (uniqueList[0]?.id ?? null);
      const newAudioURL = keep ? (uniqueList.find(r => r.id === currentSelectedId!)?.audio_file ?? null) : (uniqueList[0]?.audio_file ?? null);

      setRecordingStates(prev => ({
        ...prev,
        [bookingId]: {
          ...(prev[bookingId] ?? getRecordingState(bookingId)),
          recordings: uniqueList,
          selectedId: newSelectedId,
          audioURL: newAudioURL,
        },
      }));
      setRefreshCounter(v => v + 1);
    } catch (e) {
      console.error('获取录音列表失败:', e);
    }
  };

  const handleSelectValueChange = (bookingId: number, value: string) => {
    // 处理无效的 value
    if (!value || value === 'undefined' || value === '__none__') {
      console.log('选择录音: 无效值，重置选择');
      updateRecordingState(bookingId, { selectedId: null, audioURL: null });
      return;
    }
    
    const id = parseInt(value, 10);
    if (isNaN(id)) {
      console.error('选择录音: 无效的ID', { bookingId, value, id });
      return;
    }
    
    const current = getRecordingState(bookingId);
    const found = current.recordings.find(r => r.id === id);
    if (found) {
      console.log('选择录音:', { bookingId, selectedId: id, audioURL: found.audio_file });
      updateRecordingState(bookingId, { selectedId: id, audioURL: found.audio_file });
    } else {
      console.error('未找到录音:', { bookingId, value, id, recordings: current.recordings });
    }
  };

  const uploadRecording = async (blob: Blob, title: string): Promise<Recording | null> => {
    try {
      const token = await loginAndGetToken();
      const formData = new FormData();
      formData.append('user', '1');
      formData.append('title', title);
      formData.append('audio_file', blob, `recording-${Date.now()}.webm`);
      
      console.log('开始上传录音:', { title, blobSize: blob.size });
      
      const res = await fetch('https://recordsrv-server.keli.vip/recordings/Recording/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('上传录音失败 - HTTP错误:', { status: res.status, statusText: res.statusText, error: errorText });
        throw new Error(`上传失败: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log('录音上传响应:', data);
      
      // 验证响应数据是否包含必要的字段（兼容大小写）
      const serverData = data as any;
      const recordingId = serverData.id || serverData.Id;
      if (!data || !recordingId) {
        console.error('录音上传响应缺少必要字段:', data);
        return null;
      }
      
      // 标准化数据格式
      const normalizedData = {
        ...data,
        id: recordingId, // 统一使用小写 id
        duration: serverData.duration || null, // 允许 duration 为 null
      };
      
      return normalizedData as Recording;
    } catch (e) {
      console.error('上传录音失败:', e);
      return null;
    }
  };

  const analyzeRecording = async (id: number) => {
    try {
      const token = await loginAndGetToken();
      await fetch(`https://recordsrv-server.keli.vip/recordings/Recording/${id}/analyze/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (e) {
      console.error('分析失败:', e);
    }
  };

  // 根据会议标题拉取录音分组分析结果
  const fetchGroupAnalysisByTitle = async (title: string): Promise<string | null> => {
    try {
      const token = await loginAndGetToken();
      const url = `https://recordsrv-server.keli.vip/recordings/RecordingGroup/?name=${encodeURIComponent(title)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const first = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (!first) return null;
      if (first.status === 'completed' && first.analysis) return String(first.analysis);
      return null;
    } catch (e) {
      console.error('获取录音分组分析失败:', e);
      return null;
    }
  };

  const handleAiAnalyze = async (targetBooking: Booking) => {
    try {
      const title = `${formatDate(targetBooking.date)}-${targetBooking.start_time}-${targetBooking.end_time}`;
      console.log('AI分析 -> 触发标题:', title);

      // 设置分析状态为开始
      updateRecordingState(targetBooking.id, { analyzing: true });

      try {
        const token = await loginAndGetToken();

        // 向指定接口发送分析请求（按标题）
        await fetch('https://recordsrv-server.keli.vip/recordings/analyze_recording/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title }),
        });

        console.log('录音分析请求已发送 (按标题)');

        // 等待一段时间让分析完成，然后刷新录音列表
        setTimeout(async () => {
          try {
            await fetchRecordings(targetBooking.id, title);
            console.log('录音分析结果已更新');
          } catch (fetchError) {
            console.error('获取分析结果失败:', fetchError);
          } finally {
            updateRecordingState(targetBooking.id, { analyzing: false });
          }
        }, 3000);

      } catch (analyzeError) {
        console.error('录音分析请求失败:', analyzeError);
        toast.error('录音分析请求失败，请检查网络连接或稍后重试！');
        updateRecordingState(targetBooking.id, { analyzing: false });
      }

    } catch (error) {
      console.error('AI分析失败:', error);
      toast.error('AI分析失败，请检查网络连接或稍后重试！');
      updateRecordingState(targetBooking.id, { analyzing: false });
    }
  };

  const handlePlaneAction = async (targetBooking: Booking) => {
    try {
      console.log('发送会议纪要 -> 参会人员:', targetBooking.booking_users);
      console.log('发送会议纪要 -> 参会人员昵称:', targetBooking.booking_users?.map(u => u.nickname) ?? []);
      
      // 获取参会人员ID列表
      const userIds = targetBooking.booking_users?.map(u => u.userid) || [];
      
      if (userIds.length === 0) {
        toast.error('没有找到参会人员，无法发送会议纪要通知');
        return;
      }
      
      // 生成会议纪要通知内容（固定模版 + 可选AI摘要）
      const rs = getRecordingState(targetBooking.id);
      const selected = rs.selectedId ? rs.recordings.find(r => r.id === rs.selectedId) : null;
      const title = `${formatDate(targetBooking.date)}-${targetBooking.start_time}-${targetBooking.end_time}`;
      
      // 优先从分组接口读取已完成的分析
      let aiSummary = await fetchGroupAnalysisByTitle(title);
      if (!aiSummary) aiSummary = selected?.analysis?.trim() || '';
      
      const attendeeNames = (targetBooking.booking_users?.map(u => u.nickname).join('、')) || '';
      const initiator = targetBooking.member?.name || '';
      const initiatorRole = targetBooking.member?.is_admin ? '管理员' : '成员';
      const dateStr = `${formatDate(targetBooking.date)} ${targetBooking.start_time}-${targetBooking.end_time}`;
      const summaryBlock = aiSummary && aiSummary.length > 0 ? aiSummary : '暂无会议纪要内容';
      
      // 构建会议纪要内容
      const summaryContent = [
        '📋 会议纪要通知',
        '会议纪要已生成，请查看',
        `会议室：${targetBooking.room?.name || ''}`,
        `会议时间：${dateStr}`,
        `参会人员：${attendeeNames}`,
        `会议发起人：${initiator}${initiator ? ` (${initiatorRole})` : ''}`,
        '会议纪要内容',
        summaryBlock,
        '',
        '请及时查看会议纪要内容，如有疑问请联系会议发起人。',
      ].join('\n');
      
      // 组装时间段
      const timeSlots = [targetBooking.start_time, targetBooking.end_time];
      
      // 显示发送中提示
      toast.info(`正在发送会议纪要通知给 ${userIds.length} 位参会人员...`);
      
      // 发送会议纪要通知（使用新的 POST 接口）
      const result = await userApi.sendMeetingSummary(
        userIds,
        summaryContent,
        targetBooking.date,
        timeSlots,
        targetBooking.room?.name
      );
      
      console.log('会议纪要通知发送成功:', result);
      
      // 成功提示
      toast.success(`✅ 会议纪要通知已成功发送给 ${userIds.length} 位参会人员！`);
      
    } catch (error) {
      console.error('发送会议纪要通知失败:', error);
      toast.error(`❌ 发送会议纪要通知失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const startRecording = async (bookingId: number, title: string) => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = ev => { if (ev.data.size > 0) chunks.push(ev.data); };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        updateRecordingState(bookingId, { audioURL: url, isRecording: false, uploading: true });
        const created = await uploadRecording(blob, title);
        if (created && created.id) {
          console.log('录音上传成功:', { id: created.id, title: created.title });
          setRecordingStates(prev => {
            const cur = prev[bookingId] ?? getRecordingState(bookingId);
            return {
              ...prev,
              [bookingId]: {
                ...cur,
                recordId: created.id,
                uploading: false,
                recordings: [created, ...cur.recordings],
                selectedId: created.id,
                audioURL: created.audio_file,
              },
            };
          });
          // 确保有有效的 ID 才进行分析
          await analyzeRecording(created.id);
          await fetchRecordings(bookingId, title);
        } else {
          console.error('录音上传失败或返回无效数据:', created);
          updateRecordingState(bookingId, { uploading: false });
        }
        try { stream.getTracks().forEach(t => t.stop()); } catch { }
        mediaRecordersRef.current[bookingId] = null;
      };
      mediaRecorder.start();
      updateRecordingState(bookingId, { isRecording: true });
      mediaRecordersRef.current[bookingId] = mediaRecorder;
    } catch (e) {
      console.error('录音失败:', e);
      updateRecordingState(bookingId, { isRecording: false });
    }
  };

  const stopRecording = (bookingId: number) => {
    const rec = mediaRecordersRef.current[bookingId];
    if (rec && rec.state === 'recording') { try { rec.stop(); } catch (e) { console.error(e); } }
    else { updateRecordingState(bookingId, { isRecording: false }); }
  };

  const loadBookings = useCallback(async () => {
    const res = await memberApi.getBookings(currentMember!.id, { page: 1, page_size: 1000 });
    return { filtered: res.data };
  }, [currentMember]);

  const reloadAllBookings = useCallback(async () => {
    setActiveLoading(true); setExpiredLoading(true); setCancelledLoading(true);
    try {
      const { filtered } = await loadBookings();
      const now = new Date();
      const active: Booking[] = []; const expired: Booking[] = []; const cancelled: Booking[] = [];
      filtered.forEach((b: Booking) => {
        if (b.status === 'cancelled') cancelled.push(b);
        else if (b.status === 'active') {
          const end = new Date(`${b.date}T${b.end_time}:00`);
          if (b.end_time === '00:00') { end.setDate(end.getDate() + 1); end.setHours(0, 0, 0, 0); }
          (end < now) ? expired.push(b) : active.push(b);
        }
      });
      setActiveBookings(active); setExpiredBookings(expired); setCancelledBookings(cancelled);
    } catch (e) { console.error('加载预定数据失败:', e); }
    finally { setActiveLoading(false); setExpiredLoading(false); setCancelledLoading(false); }
  }, [loadBookings]);

  useEffect(() => { if (currentMember) reloadAllBookings(); }, [currentMember, reloadAllBookings]);

  const cancelBookingMutation = useMutation({
    mutationFn: ({ bookingId, cancelReason }: { bookingId: number; cancelReason: string }) => bookingApi.cancel(bookingId, cancelReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      reloadAllBookings();
      setCancelDialogOpen(false); setCancelBookingId(null);
    },
    onError: (error: Error) => { console.error('取消预定失败:', error); },
  });

  const handleCancelBooking = (bookingId: number) => { setCancelBookingId(bookingId); setCancelDialogOpen(true); };
  const handleConfirmCancel = (cancelReason: string) => { if (cancelBookingId) cancelBookingMutation.mutate({ bookingId: cancelBookingId, cancelReason }); };

  const formatDate = (s: string) => { try { return format(parseISO(s), 'yyyy年MM月dd日'); } catch { return s; } };
  const formatTime = (start: string, end: string) => (end === '00:00' ? `${start} - 24:00` : `${start} - ${end}`);
  const formatUploadTime = (t?: string | null) => {
    if (!t) return '-';
    const d = new Date(t); 
    if (!isNaN(d.getTime())) {
      // 显示更简洁的时间格式：MM-DD HH:mm
      return `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    const n = (t || '').toString(); 
    const norm = n.includes(' ') ? n.replace(' ', 'T') : n; 
    const d2 = new Date(norm);
    if (!isNaN(d2.getTime())) {
      return `${(d2.getMonth() + 1).toString().padStart(2, '0')}-${d2.getDate().toString().padStart(2, '0')} ${d2.getHours().toString().padStart(2, '0')}:${d2.getMinutes().toString().padStart(2, '0')}`;
    }
    return norm;
  };

  if (activeLoading && expiredLoading && cancelledLoading) {
    return (<div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin" /></div>);
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">我的预定</h1>
        <p className="text-gray-600 dark:text-white">查看和管理您的会议室预定记录</p>
      </div>

      {/* 有效预定 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Calendar className="w-5 h-5 mr-2" />有效预定 ({activeBookings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {activeBookings.length === 0 ? (
            <div className="text-center py-8"><p className="text-muted-foreground">暂无有效预定</p></div>
          ) : (
            <div className="space-y-4">
              {activeBookings.slice(0, activeShowCount).map((booking: Booking) => {
                const rs = getRecordingState(booking.id);
                const title = `${formatDate(booking.date)}-${booking.start_time}-${booking.end_time}`;
                const selected = rs.selectedId ? rs.recordings.find(r => r.id === rs.selectedId) : null;
                return (
                  <div key={`${booking.id}-${refreshCounter}`} className="border border-border rounded-lg p-4 bg-card text-card-foreground hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
                          <div className="flex items-center -mr-1"><Badge variant="default">有效</Badge></div>
                          <div className="flex items-center"><MapPin className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" /><span className="font-medium">{booking.room?.name}</span></div>
                          <div className="flex items-center"><Calendar className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" /><span>{formatDate(booking.date)}</span></div>
                          <div className="flex items-center"><Clock className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" /><span>{formatTime(booking.start_time, booking.end_time)}</span></div>
                          <div className="flex items-center"><Timer className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" /><span>{formatDuration(calculateDuration(booking.start_time, booking.end_time))}</span></div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <div
                            className="inline-flex items-center px-1 -mx-1 rounded cursor-pointer hover:bg-gray-100"
                            onClick={() => {
                              console.log('参会人员点击 有效预定', booking.id);
                              console.log('参会人员:', booking.booking_users);
                              console.log('参会人员昵称:', booking.booking_users?.map(u => u.nickname) ?? []);
                            }}
                          >
                            <strong>参会人员:</strong> {booking.booking_users?.length ? booking.booking_users.map(u => u.nickname).join(', ') : '-'}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground"><strong>预定理由:</strong> {booking.reason}</div>
                        <div className="text-sm text-muted-foreground"><strong>AI分析:</strong> {selected?.analysis ? selected.analysis : '-'}</div>

                        <div className="text-sm text-muted-foreground">
                          <strong>录音功能: {title}</strong>
                          <div className="space-y-4">
                            <TooltipProvider>
                              <div className="flex gap-4">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      onClick={() => startRecording(booking.id, title)}
                                      className={`cursor-pointer p-2 rounded-md transition-all hover:scale-105 hover:shadow-sm ${rs.isRecording ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                                    >
                                      <MicrophoneIcon size={20} className="text-blue-600" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>开始录音</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      onClick={() => stopRecording(booking.id)}
                                      className={`cursor-pointer p-2 rounded-md transition-all hover:scale-105 hover:shadow-sm ${!rs.isRecording ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-100'}`}
                                    >
                                      <StopIcon size={20} className="text-red-600" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>结束录音</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      onClick={() => { setOpenRecordingBookingId(booking.id); fetchRecordings(booking.id, title); }}
                                      className="cursor-pointer p-2 rounded-md transition-all hover:scale-105 hover:shadow-sm hover:bg-gray-100"
                                    >
                                      <SearchIcon size={20} className="text-gray-600" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>查询录音</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      onClick={() => !rs.analyzing && handleAiAnalyze(booking)}
                                      className={`relative cursor-pointer p-2 rounded-md transition-all hover:scale-105 hover:shadow-sm ${rs.analyzing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                                    >
                                      <AiIcon size={20} className={`${rs.analyzing ? 'text-gray-400' : 'text-purple-600'}`} />
                                      {rs.analyzing && <Loader2 className="w-3 h-3 animate-spin absolute -top-1 -right-1" />}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>{rs.analyzing ? '分析中...' : 'AI分析'}</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      onClick={() => handlePlaneAction(booking)}
                                      className="cursor-pointer p-2 rounded-md transition-all hover:scale-105 hover:shadow-sm hover:bg-gray-100"
                                    >
                                      <PlaneIcon size={20} className="text-teal-600" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>发送会议纪要</TooltipContent>
                                </Tooltip>
                              </div>
                            </TooltipProvider>
                            {openRecordingBookingId === booking.id && (
                              <div className="max-w-48">
                                <Select
                                  value={rs.selectedId !== null ? String(rs.selectedId) : ""}
                                  onValueChange={v => handleSelectValueChange(booking.id, v)}
                                  disabled={rs.recordings.length === 0}
                                >
                                  <SelectTrigger className="w-32 text-xs">
                                    <SelectValue placeholder={rs.recordings.length === 0 ? "暂无录音" : "选择录音"} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {rs.recordings.length === 0 ? (
                                      <SelectItem value="__none__" disabled className="text-xs">暂无录音</SelectItem>
                                    ) : (
                                      rs.recordings.map((r, index) => {
                                        // 生成更友好的显示名称
                                        const uploadTime = formatUploadTime(r.upload_time);
                                        const timeStr = uploadTime !== '-' ? uploadTime : '';
                                        const duration = r.duration ? `(${Math.round(r.duration)}秒)` : '';
                                        const displayName = `录音${index + 1} ${timeStr} ${duration}`.trim();
                                        
                                        return (
                                          <SelectItem key={r.id} value={String(r.id)} className="text-xs">
                                            {displayName}
                                          </SelectItem>
                                        );
                                      })
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            {openRecordingBookingId === booking.id && rs.audioURL && (
                              <div className="pt-4">
                                <AudioPlayer
                                  src={rs.audioURL}
                                  title="录音回放"
                                  className="w-full"
                                />
                              </div>
                            )}
                            {openRecordingBookingId === booking.id && rs.uploading && (
                              <div className="pt-2"><p className="text-sm text-muted-foreground">正在上传录音...</p></div>
                            )}
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground">预定时间: {format(parseISO(booking.created_at), 'yyyy-MM-dd HH:mm')}</div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <Button variant="outline" size="sm" onClick={() => handleCancelBooking(booking.id)} disabled={cancelBookingMutation.isPending}><X className="w-4 h-4 mr-1" />取消</Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {activeBookings.length > activeShowCount && (
                <div className="flex justify-center mt-4"><Button onClick={() => setActiveShowCount(c => c + 10)} disabled={activeLoading}><RefreshCcw className={`w-4 h-4 mr-2${activeLoading ? ' animate-spin' : ''}`} />加载更多</Button></div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 已过期预定 */}
      {expiredBookings.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center"><CalendarOff className="w-5 h-5 mr-2" />已过期预定 ({expiredBookings.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {expiredBookings.slice(0, expiredShowCount).map((booking: Booking) => (
                <div key={booking.id} className="border border-border rounded-lg p-4 bg-card text-card-foreground hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
                        <div className="flex items-center"><MapPin className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" /><span className="font-medium text-gray-600 dark:text-zinc-300">{booking.room?.name}</span></div>
                        <div className="flex items-center"><Calendar className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" /><span className="text-gray-600 dark:text-zinc-300">{formatDate(booking.date)}</span></div>
                        <div className="flex items-center"><Clock className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" /><span className="text-gray-600 dark:text-zinc-300">{formatTime(booking.start_time, booking.end_time)}</span></div>
                        <div className="flex items-center"><Timer className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" /><span className="text-gray-600 dark:text-zinc-300">{formatDuration(calculateDuration(booking.start_time, booking.end_time))}</span></div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <div
                          className="inline-flex items-center px-1 -mx-1 rounded cursor-pointer hover:bg-gray-100"
                          onClick={() => {
                            console.log('参会人员点击 已过期', booking.id);
                            console.log('参会人员:', booking.booking_users);
                            console.log('参会人员昵称:', booking.booking_users?.map(u => u.nickname) ?? []);
                          }}
                        >
                          <strong>参会人员:</strong> {booking.booking_users?.length ? booking.booking_users.map(u => u.nickname).join(', ') : '-'}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground"><strong>预定理由:</strong> {booking.reason}</div>
                      <div className="text-xs text-muted-foreground">预定时间: {format(parseISO(booking.created_at), 'yyyy-MM-dd HH:mm')}</div>
                    </div>
                    <Badge variant="secondary">已过期</Badge>
                  </div>
                </div>
              ))}
              {expiredBookings.length > expiredShowCount && (
                <div className="flex justify-center mt-4"><Button onClick={() => setExpiredShowCount(c => c + 10)} disabled={expiredLoading}><RefreshCcw className={`w-4 h-4 mr-2${expiredLoading ? ' animate-spin' : ''}`} />加载更多</Button></div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 已取消预定 */}
      {cancelledBookings.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center"><CalendarOff className="w-5 h-5 mr-2" />已取消预定 ({cancelledBookings.length})</CardTitle></CardHeader>
          <CardContent>
            {cancelledBookings.length === 0 ? (
              <div className="text-center py-8"><p className="text-muted-foreground">暂无已取消预定</p></div>
            ) : (
              <div className="space-y-4">
                {cancelledBookings.slice(0, cancelledShowCount).map((booking: Booking) => {
                  const rs = getRecordingState(booking.id);
                  const title = `${formatDate(booking.date)}-${booking.start_time}-${booking.end_time}`;
                  const selected = rs.selectedId ? rs.recordings.find(r => r.id === rs.selectedId) : null;
                  return (
                    <div key={booking.id} className="border border-border rounded-lg p-4 bg-card text-card-foreground hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
                          <div className="flex items-center"><MapPin className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" /><span className="font-medium text-gray-600 dark:text-zinc-300">{booking.room?.name}</span></div>
                          <div className="flex items-center"><Calendar className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" /><span className="text-gray-600 dark:text-zinc-300">{formatDate(booking.date)}</span></div>
                          <div className="flex items-center"><Clock className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" /><span className="text-gray-600 dark:text-zinc-300">{formatTime(booking.start_time, booking.end_time)}</span></div>
                          <div className="flex items-center"><Timer className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" /><span className="text-gray-600 dark:text-zinc-300">{formatDuration(calculateDuration(booking.start_time, booking.end_time))}</span></div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <div
                            className="inline-flex items-center px-1 -mx-1 rounded cursor-pointer hover:bg-gray-100"
                            onClick={() => {
                              console.log('参会人员点击 已取消', booking.id);
                              console.log('参会人员:', booking.booking_users);
                              console.log('参会人员昵称:', booking.booking_users?.map(u => u.nickname) ?? []);
                            }}
                          >
                            <strong>参会人员:</strong> {booking.booking_users?.length ? booking.booking_users.map(u => u.nickname).join(', ') : '-'}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground"><strong>预定理由:</strong> {booking.reason}</div>
                        {booking.cancel_reason && (<div className="text-sm text-muted-foreground"><strong>取消理由:</strong> {booking.cancel_reason}</div>)}
                        <div className="text-sm text-muted-foreground"><strong>AI分析:</strong> {selected?.analysis ? selected.analysis : '-'}</div>
                        
                        <div className="text-sm text-muted-foreground">
                          <strong>录音功能: {title}</strong>
                          <div className="space-y-4">
                            <TooltipProvider>
                              <div className="flex gap-4">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      onClick={() => startRecording(booking.id, title)}
                                      className={`cursor-pointer p-2 rounded-md transition-all hover:scale-105 hover:shadow-sm ${rs.isRecording ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                                    >
                                      <MicrophoneIcon size={20} className="text-blue-600" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>开始录音</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      onClick={() => stopRecording(booking.id)}
                                      className={`cursor-pointer p-2 rounded-md transition-all hover:scale-105 hover:shadow-sm ${!rs.isRecording ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-100'}`}
                                    >
                                      <StopIcon size={20} className="text-red-600" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>结束录音</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      onClick={() => { setOpenRecordingBookingId(booking.id); fetchRecordings(booking.id, title); }}
                                      className="cursor-pointer p-2 rounded-md transition-all hover:scale-105 hover:shadow-sm hover:bg-gray-100"
                                    >
                                      <SearchIcon size={20} className="text-gray-600" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>查询录音</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      onClick={() => !rs.analyzing && handleAiAnalyze(booking)}
                                      className={`relative cursor-pointer p-2 rounded-md transition-all hover:scale-105 hover:shadow-sm ${rs.analyzing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                                    >
                                      <AiIcon size={20} className={`${rs.analyzing ? 'text-gray-400' : 'text-purple-600'}`} />
                                      {rs.analyzing && <Loader2 className="w-3 h-3 animate-spin absolute -top-1 -right-1" />}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>{rs.analyzing ? '分析中...' : 'AI分析'}</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      onClick={() => handlePlaneAction(booking)}
                                      className="cursor-pointer p-2 rounded-md transition-all hover:scale-105 hover:shadow-sm hover:bg-gray-100"
                                    >
                                      <PlaneIcon size={20} className="text-teal-600" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>发送会议纪要</TooltipContent>
                                </Tooltip>
                              </div>
                            </TooltipProvider>
                            {openRecordingBookingId === booking.id && (
                              <div className="max-w-48">
                                <Select
                                  value={rs.selectedId !== null ? String(rs.selectedId) : undefined}
                                  onValueChange={v => handleSelectValueChange(booking.id, v)}
                                  disabled={rs.recordings.length === 0}
                                >
                                  <SelectTrigger className="w-32 text-xs">
                                    <SelectValue placeholder={rs.recordings.length === 0 ? "暂无录音" : "选择录音"} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {rs.recordings.length === 0 ? (
                                      <SelectItem value="__none__" disabled className="text-xs">暂无录音</SelectItem>
                                    ) : (
                                      rs.recordings.map(r => (
                                        <SelectItem key={r.id} value={String(r.id)} className="text-xs">{r.title} - {formatUploadTime(r.upload_time)}</SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            {openRecordingBookingId === booking.id && rs.audioURL && (
                              <div className="pt-4">
                                <AudioPlayer
                                  src={rs.audioURL}
                                  title="录音回放"
                                  className="w-full"
                                />
                              </div>
                            )}
                            {openRecordingBookingId === booking.id && rs.uploading && (
                              <div className="pt-2"><p className="text-sm text-muted-foreground">正在上传录音...</p></div>
                            )}
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground">预定时间: {format(parseISO(booking.created_at), 'yyyy-MM-dd HH:mm')}</div>
                      </div>
                      <Badge variant="secondary">已取消</Badge>
                    </div>
                  </div>
                );
              })}
                {cancelledBookings.length > cancelledShowCount && (
                  <div className="flex justify-center mt-4"><Button onClick={() => setCancelledShowCount(c => c + 10)} disabled={cancelledLoading}><RefreshCcw className={`w-4 h-4 mr-2${cancelledLoading ? ' animate-spin' : ''}`} />加载更多</Button></div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 预定统计 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card><CardContent className="p-4"><div className="text-center"><div className="text-2xl font-bold text-blue-600">{activeBookings.length + expiredBookings.length + cancelledBookings.length}</div><div className="text-sm text-muted-foreground">总预定数</div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-center"><div className="text-2xl font-bold text-green-600">{activeBookings.length}</div><div className="text-sm text-muted-foreground">有效预定</div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-center"><div className="text-2xl font-bold text-orange-500">{expiredBookings.length}</div><div className="text-sm text-muted-foreground">已过期</div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-center"><div className="text-2xl font-bold text-red-600">{cancelledBookings.length}</div><div className="text-sm text-muted-foreground">已取消</div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-center"><div className="text-2xl font-bold text-purple-600">{activeBookings.reduce((t, b) => t + calculateDuration(b.start_time, b.end_time), 0)}</div><div className="text-sm text-muted-foreground">总时长(小时)</div></div></CardContent></Card>
      </div>

      {/* 取消预定弹窗 */}
      <CancelBookingDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen} onConfirm={handleConfirmCancel} loading={cancelBookingMutation.isPending} />
    </div>
  );
} 