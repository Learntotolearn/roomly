'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { memberApi, bookingApi, userApi, recordingGroupApi } from '@/lib/api';
import { useAppContext } from '@/lib/context/app-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Calendar, Clock, MapPin, X, CalendarOff, Loader2, Timer, RefreshCcw, Edit, UserPlus } from 'lucide-react';
import { MicrophoneIcon, StopIcon, SearchIcon, AiIcon, PlaneIcon } from '@/components/ui/icons';
import { AudioPlayer } from '@/components/ui/audio-player';
import { format, parseISO } from 'date-fns';
import { Booking, BookingUser } from '@/lib/types';
import { calculateDuration, formatDuration } from '@/lib/utils';
import { useState, useEffect, useRef, useCallback } from 'react';
import { CancelBookingDialog } from '@/components/ui/cancel-booking-dialog';
import { EditParticipantsDialog } from '@/components/ui/edit-participants-dialog';
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
  const ENABLE_SUMMARY_API ='true';
  const RECORDSRV_BASE = process.env.NEXT_PUBLIC_RECORDSRV_BASE || 'https://recordsrv-server.keli.vip';
  const RECORDSRV_USERNAME = process.env.NEXT_PUBLIC_RECORDSRV_USERNAME || 'admin';
  const RECORDSRV_PASSWORD = process.env.NEXT_PUBLIC_RECORDSRV_PASSWORD || 'admin';

  // 强制刷新计数器
  const [refreshCounter, setRefreshCounter] = useState(0);
  // 只展开当前录音卡片
  const [openRecordingBookingId, setOpenRecordingBookingId] = useState<number | null>(null);

  // 取消预定弹窗
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelBookingId, setCancelBookingId] = useState<number | null>(null);
  
  // 编辑参会人员弹窗
  const [editParticipantsDialogOpen, setEditParticipantsDialogOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [isUpdatingParticipants, setIsUpdatingParticipants] = useState(false);
  
  // 会议纪要弹窗
  const [meetingSummaryDialogOpen, setMeetingSummaryDialogOpen] = useState(false);
  const [currentBooking, setCurrentBooking] = useState<Booking | null>(null);
  const [meetingSummary, setMeetingSummary] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  
  // 编辑分析弹窗
  const [editAnalysisDialogOpen, setEditAnalysisDialogOpen] = useState(false);
  const [editingRecording, setEditingRecording] = useState<Recording | null>(null);
  const [editingAnalysis, setEditingAnalysis] = useState('');
  const [isUpdatingAnalysis, setIsUpdatingAnalysis] = useState(false);

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
    const res = await fetch(`${RECORDSRV_BASE}/api/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: RECORDSRV_USERNAME, password: RECORDSRV_PASSWORD }),
    });
    const data = await res.json();
    return data.access;
  };

  const fetchRecordings = async (bookingId: number, title: string) => {
    try {
      const token = await loginAndGetToken();
      const res = await fetch(`${RECORDSRV_BASE}/recordings/Recording/?title=${encodeURIComponent(title)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('获取录音信息失败');
      const data: Recording[] = await res.json();

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
      
      
      const res = await fetch(`${RECORDSRV_BASE}/recordings/Recording/`, {
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
      await fetch(`${RECORDSRV_BASE}/recordings/Recording/${id}/analyze/`, {
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
      const url = `${RECORDSRV_BASE}/recordings/RecordingGroup/?name=${encodeURIComponent(title)}`;
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

      // 设置分析状态为开始
      updateRecordingState(targetBooking.id, { analyzing: true });

      try {
        const token = await loginAndGetToken();

        // 向指定接口发送分析请求（按标题）
        await fetch(`${RECORDSRV_BASE}/recordings/analyze_recording/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title }),
        });


        // 等待一段时间让分析完成，然后刷新录音列表
        setTimeout(async () => {
          try {
            await fetchRecordings(targetBooking.id, title);
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
      
      // 获取参会人员ID列表
      const userIds = targetBooking.booking_users?.map(u => u.userid) || [];
      
      if (userIds.length === 0) {
        toast.error('没有找到参会人员，无法发送会议纪要通知');
        return;
      }
      
      // 生成会议纪要通知内容（智能选择：若AI已是完整纪要，则直接发送AI内容）
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
      const cleanThink = (txt: string) => txt
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/```[\s\S]*?```/g, '')
        .trim();
      const cleanedAi = aiSummary ? cleanThink(aiSummary) : '';
      const looksLikeFullMinutes = /(^#\s*会议纪要)|(^\*\*会议信息\*\*)/m.test(cleanedAi);

      // 只发送“会议纪要”主体内容
      const summaryContent = (cleanedAi && looksLikeFullMinutes)
        ? cleanedAi
        : [
            '# 会议纪要',
            '',
            '**会议信息**',
            `- 会议室：${targetBooking.room?.name || ''}`,
            `- 会议时间：${dateStr}`,
            `- 参会人员：${attendeeNames}`,
            `- 会议发起人：${initiator}${initiator ? ` (${initiatorRole})` : ''}`,
            `- 预定理由：${targetBooking.reason || ''}`,
            '',
            '**会议纪要内容**',
            (cleanedAi && cleanedAi.length > 0) ? cleanedAi : '暂无会议纪要内容',
          ].join('\n');
      
      // 组装时间段（不再传给通知接口，避免服务端加头部模板）
      const timeSlots = [targetBooking.start_time, targetBooking.end_time];
      
      // 显示发送中提示
      toast.info(`正在发送会议纪要通知给 ${userIds.length} 位参会人员...`);
      
      // 发送会议纪要通知（使用新的 POST 接口）
      // 仅发送正文，去掉 date/timeSlots/roomName 以避免服务端自动加“会议纪要通知”头部
      const result = await userApi.sendMeetingSummary(
        userIds,
        summaryContent
      );
      
      
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
      const active: Booking[] = []; const expired: Booking[] = []; const cancelled: Booking[] = [];
      
      // 完全依赖后端返回的status字段，不再做前端过期判断
      filtered.forEach((b: Booking) => {
        if (b.status === 'cancelled') {
          cancelled.push(b);
        } else if (b.status === 'expired') {
          expired.push(b);
        } else if (b.status === 'active') {
          active.push(b);
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

  // 更新参会人员的mutation
  const updateParticipantsMutation = useMutation({
    mutationFn: ({ bookingId, bookingUsers }: { bookingId: number; bookingUsers: BookingUser[] }) => 
      bookingApi.updateBookingUsers(bookingId, bookingUsers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-bookings'] });
      reloadAllBookings();
      setEditParticipantsDialogOpen(false);
      setEditingBooking(null);
      setIsUpdatingParticipants(false); // 重要：确保重置更新状态
      toast.success('参会人员已更新');
    },
    onError: (error: Error) => {
      console.error('更新参会人员失败:', error);
      setIsUpdatingParticipants(false); // 重要：确保重置更新状态
      toast.error('更新参会人员失败，请稍后重试');
    },
    onSettled: () => {
      // 无论成功还是失败，都确保重置更新状态
      setIsUpdatingParticipants(false);
    }
  });

  const handleCancelBooking = (bookingId: number) => { setCancelBookingId(bookingId); setCancelDialogOpen(true); };
  const handleConfirmCancel = (cancelReason: string) => { if (cancelBookingId) cancelBookingMutation.mutate({ bookingId: cancelBookingId, cancelReason }); };

  // 打开编辑参会人员对话框
  const handleEditParticipants = (booking: Booking) => {
    setEditingBooking(booking);
    setEditParticipantsDialogOpen(true);
  };

  // 保存参会人员更新
  const handleSaveParticipants = (participants: BookingUser[]) => {
    if (!editingBooking) return;
    
    setIsUpdatingParticipants(true);
    updateParticipantsMutation.mutate({
      bookingId: editingBooking.id,
      bookingUsers: participants
    });
  };

  // 检查录音分析状态
  const checkRecordingAnalysisStatus = async (booking: Booking): Promise<boolean> => {
    try {
      const title = `${formatDate(booking.date)}-${booking.start_time}-${booking.end_time}`;
      const token = await loginAndGetToken();
      const list = await recordingGroupApi.getByName(title, token);
      const groupItem = Array.isArray(list) && list.length > 0 ? list[0] : null;
      
      if (groupItem && groupItem.status === 'completed') {
        return true;
      }
      
      // 如果没有找到分组，检查单个录音的分析状态
      const rs = getRecordingState(booking.id);
      const selected = rs.selectedId ? rs.recordings.find(r => r.id === rs.selectedId) : null;
      
      if (selected && selected.analysis) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('检查录音分析状态失败:', error);
      return false;
    }
  };

  // 会议纪要相关函数
  const handleOpenMeetingSummaryWithCheck = async (booking: Booking) => {
    const isCompleted = await checkRecordingAnalysisStatus(booking);
    if (isCompleted) {
      handleOpenMeetingSummary(booking);
    } else {
      toast.error('录音分析尚未完成，请等待分析完成后再查看会议纪要');
    }
  };

  const handleOpenMeetingSummary = async (booking: Booking) => {
    setCurrentBooking(booking);
    setMeetingSummary('');
    setMeetingSummaryDialogOpen(true);
    
    // 加载录音分组内容（不再调用 bookings/{id}/summary 接口）
    if (ENABLE_SUMMARY_API) {
      try {
        // 1) 同步绑定 RecordingGroup 的 Id（按标题查询）并预填 analysis
        const title = `${formatDate(booking.date)}-${booking.start_time}-${booking.end_time}`;
        const token = await loginAndGetToken();
        const list = await recordingGroupApi.getByName(title, token);
        const groupItem = Array.isArray(list) && list.length > 0 ? list[0] : null;
        if (groupItem) {
          const groupId = groupItem.id ?? groupItem.Id;
          const rawMap = (typeof window !== 'undefined') ? localStorage.getItem('recordingGroupIdMap') : null;
          const idMap: Record<string, number> = rawMap ? JSON.parse(rawMap) : {};
          idMap[String(booking.id)] = Number(groupId);
          if (typeof window !== 'undefined') localStorage.setItem('recordingGroupIdMap', JSON.stringify(idMap));
          // 预填外部 analysis
          if (groupItem.analysis) setMeetingSummary(String(groupItem.analysis));
        }

        // 2) 若仍为空，则自动生成模板（无需手动点击“生成模板”）
        setTimeout(() => {
          setMeetingSummary(ms => {
            if (!ms || ms.trim().length === 0) {
              // 仅当内容仍为空时才自动生成
              handleGenerateSummary();
            }
            return ms;
          });
        }, 0);
      } catch (error) {
      }
    }
  };

  // 修改录音分析内容
  const handleEditAnalysis = (recording: Recording) => {
    setEditingRecording(recording);
    setEditingAnalysis(recording.analysis || '');
    setEditAnalysisDialogOpen(true);
  };

  // 保存分析内容
  const handleSaveAnalysis = async () => {
    if (!editingRecording) return;
    
    setIsUpdatingAnalysis(true);
    try {
      toast.success('录音分析内容已更新');
      setEditAnalysisDialogOpen(false);
      
      // 刷新录音列表以显示更新后的内容
      const title = `${formatDate(currentBooking?.date || '')}-${currentBooking?.start_time || ''}-${currentBooking?.end_time || ''}`;
      if (currentBooking) {
        await fetchRecordings(currentBooking.id, title);
      }
      
    } catch (error) {
      console.error('更新录音分析失败:', error);
      toast.error('更新录音分析失败，请稍后重试');
    } finally {
      setIsUpdatingAnalysis(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!currentBooking) return;
    
    setIsGeneratingSummary(true);
    try {
      const title = `${formatDate(currentBooking.date)}-${currentBooking.start_time}-${currentBooking.end_time}`;
      
      // 获取AI分析结果
      const aiAnalysis = await fetchGroupAnalysisByTitle(title);
      
      // 构建会议纪要内容
      const attendeeNames = (currentBooking.booking_users?.map(u => u.nickname).join('、')) || '';
      const dateStr = `${formatDate(currentBooking.date)} ${currentBooking.start_time}-${currentBooking.end_time}`;
      
      let summaryContent = `# 会议纪要\n\n`;
      summaryContent += `**会议信息**\n`;
      summaryContent += `- 会议室：${currentBooking.room?.name || ''}\n`;
      summaryContent += `- 会议时间：${dateStr}\n`;
      summaryContent += `- 参会人员：${attendeeNames}\n`;
      summaryContent += `- 会议发起xxx人：${currentBooking.member?.name || ''}\n`;
      summaryContent += `- 预定理由：${currentBooking.reason}\n\n`;
      
      if (aiAnalysis) {
        summaryContent += `**AI分析摘要**\n${aiAnalysis}\n\n`;
      }
      
      summaryContent += `**会议要点**\n`;
      summaryContent += `1. \n`;
      summaryContent += `2. \n`;
      summaryContent += `3. \n\n`;
      
      summaryContent += `**后续行动**\n`;
      summaryContent += `- [ ] \n`;
      summaryContent += `- [ ] \n\n`;
      
      summaryContent += `**备注**\n`;
      summaryContent += `\n`;
      
      setMeetingSummary(summaryContent);
      toast.success('会议纪要模板已生成');
    } catch (error) {
      console.error('生成会议纪要失败:', error);
      toast.error('生成会议纪要失败，请稍后重试');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleSaveSummary = async () => {
    if (!currentBooking) {
      toast.error('未选中预定，无法保存');
      return;
    }
    if (!meetingSummary.trim()) {
      toast.error('请先输入会议纪要内容');
      return;
    }
    
    try {
      if (ENABLE_SUMMARY_API) {
        // 保存到录音分组：优先使用已知 Id；否则按标题 upsert
        const title = `${formatDate(currentBooking.date)}-${currentBooking.start_time}-${currentBooking.end_time}`;
        const token = await loginAndGetToken();

        // 读取并维护本地绑定关系（booking.id -> RecordingGroup.Id）
        const rawMap = (typeof window !== 'undefined') ? localStorage.getItem('recordingGroupIdMap') : null;
        const idMap: Record<string, number> = rawMap ? JSON.parse(rawMap) : {};
        const boundId = idMap[String(currentBooking.id)];

        let res: any;
        if (boundId) {
          // 仅部分更新，避免触发文件字段校验
          res = await recordingGroupApi.partialUpdate(boundId, { analysis: meetingSummary }, token);
        } else {
          // 按名称 upsert（PATCH 或 CREATE），仅传 analysis 字段
          res = await recordingGroupApi.upsertByName(title, { analysis: meetingSummary }, token);
        }

        const savedId = (res && (res.id ?? res.Id)) ?? null;
        if (savedId) {
          idMap[String(currentBooking.id)] = Number(savedId);
          if (typeof window !== 'undefined') localStorage.setItem('recordingGroupIdMap', JSON.stringify(idMap));
        }

        toast.success(savedId ? `会议纪要已保存（ID: ${savedId}）` : '会议纪要已保存');
      } else {
        // 未开启后端保存时，仅本地提示成功
        toast.info('未开启后端保存，已生成本地内容');
      }
      setMeetingSummaryDialogOpen(false);
    } catch (error) {
      console.error('保存会议纪要失败:', error);
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`保存会议纪要失败：${msg}`);
    }
  };

  const formatDate = (s: string) => { try { return format(new Date(s), 'yyyy年MM月dd日'); } catch { return s; } };
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
                          <div>
                            <strong>参会人员:</strong> {booking.booking_users?.length ? booking.booking_users.map(u => u.nickname).join(', ') : '-'}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground"><strong>预定理由:</strong> {booking.reason}</div>
                        <div className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <strong>语音识别:</strong> 
                            <span>{selected?.analysis ? selected.analysis : '-'}</span>
                            {selected && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditAnalysis(selected)}
                                className="h-6 px-2 text-xs"
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                编辑
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="text-sm text-muted-foreground">
                          <strong>录音功能: {title}</strong>
                          <div className="space-y-4">
                            <TooltipProvider>
                              <div className="flex flex-wrap gap-3 sm:gap-4" style={{ maxWidth: '100%' }}>
                                <div className="flex flex-row gap-3 sm:gap-4 mb-2 flex-wrap">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        onClick={() => startRecording(booking.id, title)}
                                        className={`cursor-pointer p-2.5 sm:p-2 rounded-md transition-all hover:scale-105 hover:shadow-sm ${rs.isRecording ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                                      >
                                        <MicrophoneIcon size={22} className="sm:w-5 sm:h-5 text-blue-600" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>开始录音</TooltipContent>
                                  </Tooltip>

                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        onClick={() => stopRecording(booking.id)}
                                        className={`cursor-pointer p-2.5 sm:p-2 rounded-md transition-all hover:scale-105 hover:shadow-sm ${!rs.isRecording ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-100'}`}
                                      >
                                        <StopIcon size={22} className="sm:w-5 sm:h-5 text-red-600" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>结束录音</TooltipContent>
                                  </Tooltip>

                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        onClick={() => { setOpenRecordingBookingId(booking.id); fetchRecordings(booking.id, title); }}
                                        className="cursor-pointer p-2.5 sm:p-2 rounded-md transition-all hover:scale-105 hover:shadow-sm hover:bg-gray-100"
                                      >
                                        <SearchIcon size={22} className="sm:w-5 sm:h-5 text-gray-600" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>查询录音</TooltipContent>
                                  </Tooltip>
                                </div>

                                <div className="flex gap-3 sm:gap-4 flex-wrap">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        onClick={() => !rs.analyzing && handleAiAnalyze(booking)}
                                        className={`relative cursor-pointer p-2.5 sm:p-2 rounded-md transition-all hover:scale-105 hover:shadow-sm ${rs.analyzing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                                      >
                                        <AiIcon size={22} className={`sm:w-5 sm:h-5 ${rs.analyzing ? 'text-gray-400' : 'text-purple-600'}`} />
                                        {rs.analyzing && <Loader2 className="w-3 h-3 animate-spin absolute -top-1 -right-1" />}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>{rs.analyzing ? '分析中...' : 'AI分析'}</TooltipContent>
                                  </Tooltip>

                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        onClick={() => handleOpenMeetingSummary(booking)}
                                        className="cursor-pointer p-2.5 sm:p-2 rounded-md transition-all hover:scale-105 hover:shadow-sm hover:bg-gray-100"
                                      >
                                        <svg className="w-5.5 h-5.5 sm:w-5 sm:h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>会议纪要</TooltipContent>
                                  </Tooltip>

                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        onClick={() => handlePlaneAction(booking)}
                                        className="cursor-pointer p-2.5 sm:p-2 rounded-md transition-all hover:scale-105 hover:shadow-sm hover:bg-gray-100"
                                      >
                                        <PlaneIcon size={22} className="sm:w-5 sm:h-5 text-teal-600" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>发送会议纪要</TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>
                            </TooltipProvider>
                            {openRecordingBookingId === booking.id && (
                              <div className="max-w-48 md:max-w-48 max-w-36">
                                <Select
                                  value={rs.selectedId !== null ? String(rs.selectedId) : ""}
                                  onValueChange={v => handleSelectValueChange(booking.id, v)}
                                  disabled={rs.recordings.length === 0}
                                >
                                  <SelectTrigger className="w-28 md:w-32 text-xs">
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
                                  className="w-full max-w-full sm:max-w-xs md:max-w-md"
                                />
                              </div>
                            )}
                            {openRecordingBookingId === booking.id && rs.uploading && (
                              <div className="pt-2"><p className="text-sm text-muted-foreground">正在上传录音...</p></div>
                            )}
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground">预定时间: {(() => {
                          try {
                            // 关键修复：数据库中的UTC时间实际上就是北京时间，只是格式问题
                            // 服务器在北京时间16:48创建，但保存为UTC格式16:48Z
                            // 我们需要将这个UTC时间直接当作北京时间显示
                            const utcMatch = booking.created_at.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
                            if (utcMatch) {
                              const [, year, month, day, hour, minute] = utcMatch;
                              return `${year}-${month}-${day} ${hour}:${minute}`;
                            }
                            
                            // 备用方案
                            return booking.created_at.replace(/T/, ' ').replace(/\.\d+Z?$/, '').substring(0, 16);
                          } catch (error) {
                            console.error('时间格式化错误:', error);
                            return booking.created_at;
                          }
                        })()}</div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:space-x-2 ml-4">
                        <Badge 
                          variant="outline" 
                          className="cursor-pointer hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center whitespace-nowrap"
                          onClick={() => handleEditParticipants(booking)}
                        >
                          <UserPlus className="cursor-pointer hover:bg-red-50 hover:text-red-600 transition-colors" />

                        </Badge>
                        <Badge 
                          variant="outline" 
                          className="cursor-pointer hover:bg-red-50 hover:text-red-600 transition-colors"
                          onClick={() => handleCancelBooking(booking.id)}
                        >
                          取消
                        </Badge>
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
                        <div>
                          <strong>参会人员:</strong> {booking.booking_users?.length ? booking.booking_users.map(u => u.nickname).join(', ') : '-'}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground"><strong>预定理由:</strong> {booking.reason}</div>
                      <div className="text-xs text-muted-foreground">预定时间: {(() => {
                        try {
                          // 关键修复：数据库中的UTC时间实际上就是北京时间，只是格式问题
                          const utcMatch = booking.created_at.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
                          if (utcMatch) {
                            const [, year, month, day, hour, minute] = utcMatch;
                            return `${year}-${month}-${day} ${hour}:${minute}`;
                          }
                          
                          // 备用方案
                          return booking.created_at.replace(/T/, ' ').replace(/\.\d+Z?$/, '').substring(0, 16);
                        } catch (error) {
                          console.error('时间格式化错误:', error);
                          return booking.created_at;
                        }
                      })()}</div>
                    </div>
                    {/* 操作区：已过期也允许编辑会议纪要 */}
                    <div className="flex items-center space-x-2 ml-4">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              onClick={() => handleOpenMeetingSummary(booking)}
                              className="cursor-pointer p-2 rounded-md transition-all hover:scale-105 hover:shadow-sm hover:bg-gray-100"
                            >
                              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>会议纪要</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
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
                          <div>
                            <strong>参会人员:</strong> {booking.booking_users?.length ? booking.booking_users.map(u => u.nickname).join(', ') : '-'}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground"><strong>预定理由:</strong> {booking.reason}</div>
                        {booking.cancel_reason && (<div className="text-sm text-muted-foreground"><strong>取消理由:</strong> {booking.cancel_reason}</div>)}
                        <div className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <strong>AI分析:</strong> 
                            <span>{selected?.analysis ? selected.analysis : '-'}</span>
                            {selected && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditAnalysis(selected)}
                                className="h-6 px-2 text-xs"
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                编辑
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-sm text-muted-foreground">
                          <strong>录音功能: {title}</strong>
                          <div className="space-y-4">
                            <TooltipProvider>
                              <div className="flex flex-wrap gap-3 sm:gap-4" style={{ maxWidth: '100%' }}>
                                <div className="flex flex-row gap-3 sm:gap-4 mb-2 flex-wrap">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        onClick={() => startRecording(booking.id, title)}
                                        className={`cursor-pointer p-2.5 sm:p-2 rounded-md transition-all hover:scale-105 hover:shadow-sm ${rs.isRecording ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                                      >
                                        <MicrophoneIcon size={22} className="sm:w-5 sm:h-5 text-blue-600" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>开始录音</TooltipContent>
                                  </Tooltip>

                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        onClick={() => stopRecording(booking.id)}
                                        className={`cursor-pointer p-2.5 sm:p-2 rounded-md transition-all hover:scale-105 hover:shadow-sm ${!rs.isRecording ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-100'}`}
                                      >
                                        <StopIcon size={22} className="sm:w-5 sm:h-5 text-red-600" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>结束录音</TooltipContent>
                                  </Tooltip>

                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        onClick={() => { setOpenRecordingBookingId(booking.id); fetchRecordings(booking.id, title); }}
                                        className="cursor-pointer p-2.5 sm:p-2 rounded-md transition-all hover:scale-105 hover:shadow-sm hover:bg-gray-100"
                                      >
                                        <SearchIcon size={22} className="sm:w-5 sm:h-5 text-gray-600" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>查询录音</TooltipContent>
                                  </Tooltip>
                                </div>

                                <div className="flex gap-3 sm:gap-4 flex-wrap">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        onClick={() => !rs.analyzing && handleAiAnalyze(booking)}
                                        className={`relative cursor-pointer p-2.5 sm:p-2 rounded-md transition-all hover:scale-105 hover:shadow-sm ${rs.analyzing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                                      >
                                        <AiIcon size={22} className={`sm:w-5 sm:h-5 ${rs.analyzing ? 'text-gray-400' : 'text-purple-600'}`} />
                                        {rs.analyzing && <Loader2 className="w-3 h-3 animate-spin absolute -top-1 -right-1" />}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>{rs.analyzing ? '分析中...' : 'AI分析'}</TooltipContent>
                                  </Tooltip>

                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        onClick={() => handleOpenMeetingSummary(booking)}
                                        className="cursor-pointer p-2.5 sm:p-2 rounded-md transition-all hover:scale-105 hover:shadow-sm hover:bg-gray-100"
                                      >
                                        <svg className="w-5.5 h-5.5 sm:w-5 sm:h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>会议纪要</TooltipContent>
                                  </Tooltip>

                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        onClick={() => handlePlaneAction(booking)}
                                        className="cursor-pointer p-2.5 sm:p-2 rounded-md transition-all hover:scale-105 hover:shadow-sm hover:bg-gray-100"
                                      >
                                        <PlaneIcon size={22} className="sm:w-5 sm:h-5 text-teal-600" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>发送会议纪要</TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>
                            </TooltipProvider>
                            {openRecordingBookingId === booking.id && (
                              <div className="max-w-36 md:max-w-48">
                                <Select
                                  value={rs.selectedId !== null ? String(rs.selectedId) : undefined}
                                  onValueChange={v => handleSelectValueChange(booking.id, v)}
                                  disabled={rs.recordings.length === 0}
                                >
                                  <SelectTrigger className="w-28 md:w-32 text-xs">
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
                                  className="w-full max-w-full sm:max-w-xs md:max-w-md"
                                />
                              </div>
                            )}
                            {openRecordingBookingId === booking.id && rs.uploading && (
                              <div className="pt-2"><p className="text-sm text-muted-foreground">正在上传录音...</p></div>
                            )}
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground">预定时间: {(() => {
                          try {
                            // 关键修复：数据库中的UTC时间实际上就是北京时间，只是格式问题
                            const utcMatch = booking.created_at.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
                            if (utcMatch) {
                              const [, year, month, day, hour, minute] = utcMatch;
                              return `${year}-${month}-${day} ${hour}:${minute}`;
                            }
                            
                            // 备用方案
                            return booking.created_at.replace(/T/, ' ').replace(/\.\d+Z?$/, '').substring(0, 16);
                          } catch (error) {
                            console.error('时间格式化错误:', error);
                            return booking.created_at;
                          }
                        })()}</div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:space-x-2">
                        <Badge variant="secondary">已取消</Badge>
                      </div>
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

      {/* 会议纪要对话框 */}
      {meetingSummaryDialogOpen && currentBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl h-3/4 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">会议纪要 - {currentBooking.room?.name}</h2>
              <button
                onClick={() => setMeetingSummaryDialogOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex flex-wrap gap-4 mb-4">
              <Button
                onClick={handleGenerateSummary}
                disabled={isGeneratingSummary}
                className="flex items-center gap-2"
              >
                {isGeneratingSummary ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
                {isGeneratingSummary ? '生成中...' : '生成模板'}
              </Button>
              
              <Button
                onClick={handleSaveSummary}
                variant="outline"
                className="flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                保存
              </Button>
            </div>
            
            <div className="flex-1">
              <textarea
                value={meetingSummary}
                onChange={(e) => setMeetingSummary(e.target.value)}
                placeholder="请输入会议纪要内容..."
                className="w-full h-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                style={{ fontFamily: 'monospace' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 编辑分析对话框 */}
      {editAnalysisDialogOpen && editingRecording && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-3/4 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">编辑录音记录分析</h2>
              <button
                onClick={() => setEditAnalysisDialogOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                录音标题: {editingRecording.title}
              </p>
            </div>
            
            <div className="flex-1 mb-4">
              <textarea
                value={editingAnalysis}
                onChange={(e) => setEditingAnalysis(e.target.value)}
                placeholder="请输入录音分析内容..."
                className="w-full h-full min-h-48 p-4 border border-gray-300 dark:border-gray-600 rounded-lg resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                style={{ fontFamily: 'monospace' }}
              />
            </div>
            
            <div className="flex flex-wrap gap-4 justify-end">
              <Button
                variant="outline"
                onClick={() => setEditAnalysisDialogOpen(false)}
              >
                取消
              </Button>
              <Button
                onClick={handleSaveAnalysis}
                disabled={isUpdatingAnalysis}
                className="flex items-center gap-2"
              >
                {isUpdatingAnalysis ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {isUpdatingAnalysis ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑参会人员对话框 */}
      {editingBooking && (
        <EditParticipantsDialog
          booking={editingBooking}
          participants={editingBooking.booking_users || []}
          isOpen={editParticipantsDialogOpen}
          isUpdating={isUpdatingParticipants}
          onClose={() => setEditParticipantsDialogOpen(false)}
          onSave={handleSaveParticipants}
        />
      )}
    </div>
  );
} 
