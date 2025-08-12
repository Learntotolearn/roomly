'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { memberApi, bookingApi } from '@/lib/api';
import { useAppContext } from '@/lib/context/app-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, MapPin, X, CalendarOff, Loader2, Timer, RefreshCcw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Booking } from '@/lib/types';
import { calculateDuration, formatDuration } from '@/lib/utils';
import { useState, useEffect, useRef, useCallback } from 'react';
import { CancelBookingDialog } from '@/components/ui/cancel-booking-dialog';

// 录音状态接口
interface RecordingState {
  isRecording: boolean;
  audioURL: string | null;
  uploading: boolean;
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

      const clean = data.map(r => ({
        ...r,
        title: (r.title || '').replace(/\s*-\s*$/, '').replace(/\s*Invalid Date\s*$/, ''),
      }));
      const matched = clean.filter(r => (r.title || '').includes(title) || title.includes(r.title || ''));
      const list = matched.length > 0 ? matched : clean;
      list.sort((a, b) => new Date(b.upload_time).getTime() - new Date(a.upload_time).getTime());

      const currentSelectedId = recordingStates[bookingId]?.selectedId ?? null;
      const keep = currentSelectedId !== null && list.some(r => r.id === currentSelectedId);
      const newSelectedId = keep ? currentSelectedId : (list[0]?.id ?? null);
      const newAudioURL = keep ? (list.find(r => r.id === currentSelectedId!)?.audio_file ?? null) : (list[0]?.audio_file ?? null);

      setRecordingStates(prev => ({
        ...prev,
        [bookingId]: {
          ...(prev[bookingId] ?? getRecordingState(bookingId)),
          recordings: list,
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
    const id = parseInt(value, 10);
    const current = getRecordingState(bookingId);
    const found = current.recordings.find(r => r.id === id);
    if (found) {
      updateRecordingState(bookingId, { selectedId: id, audioURL: found.audio_file });
    }
  };

  const uploadRecording = async (blob: Blob, title: string): Promise<Recording | null> => {
    try {
      const token = await loginAndGetToken();
      const formData = new FormData();
      formData.append('user', '1');
      formData.append('title', title);
      formData.append('audio_file', blob, `recording-${Date.now()}.webm`);
      const res = await fetch('https://recordsrv-server.keli.vip/recordings/Recording/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error('上传失败');
      const data = await res.json();
      return data as Recording;
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
        if (created) {
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
          await analyzeRecording(created.id);
          await fetchRecordings(bookingId, title);
        } else {
          updateRecordingState(bookingId, { uploading: false });
        }
        try { stream.getTracks().forEach(t => t.stop()); } catch {}
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
          if (b.end_time === '00:00') { end.setDate(end.getDate() + 1); end.setHours(0,0,0,0); }
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
    const d = new Date(t); if (!isNaN(d.getTime())) return d.toLocaleString();
    const n = (t || '').toString(); const norm = n.includes(' ') ? n.replace(' ', 'T') : n; const d2 = new Date(norm);
    return isNaN(d2.getTime()) ? norm : d2.toLocaleString();
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
                        <div className="text-sm text-muted-foreground"><strong>参会人员:</strong> {booking.booking_users?.length ? booking.booking_users.map(u => u.nickname).join(', ') : '-'}</div>
                        <div className="text-sm text-muted-foreground"><strong>预定理由:</strong> {booking.reason}</div>
                        <div className="text-sm text-muted-foreground"><strong>AI分析:</strong> {selected?.analysis ? selected.analysis : '-'}</div>

                        <div className="text-sm text-muted-foreground">
                          <strong>录音功能: {title}</strong>
                          <div className="space-y-4">
                            <div className="flex gap-4">
                              <Button onClick={() => startRecording(booking.id, title)} disabled={rs.isRecording}>🎤 开始录音</Button>
                              <Button onClick={() => stopRecording(booking.id)} variant="destructive" disabled={!rs.isRecording}>🛑 结束录音</Button>
                              <Button onClick={() => { setOpenRecordingBookingId(booking.id); fetchRecordings(booking.id, title); }} variant="outline" className="flex items-center gap-2"><span>🔍</span> 查询录音</Button>
                            </div>
                            {openRecordingBookingId === booking.id && rs.recordings.length > 0 && rs.selectedId !== null && (
                              <div className="max-w-xs">
                                <Select value={String(rs.selectedId)} onValueChange={v => handleSelectValueChange(booking.id, v)}>
                                  <SelectTrigger className="w-full"><SelectValue placeholder="选择录音" /></SelectTrigger>
                                  <SelectContent>
                                    {rs.recordings.map(r => (<SelectItem key={r.id} value={String(r.id)}>{r.title} - {formatUploadTime(r.upload_time)}</SelectItem>))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            {openRecordingBookingId === booking.id && rs.audioURL && (
                              <div className="pt-4"><p className="text-sm text-muted-foreground">录音回放：</p><audio controls src={rs.audioURL} /></div>
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
                      <div className="text-sm text-muted-foreground"><strong>参会人员:</strong> {booking.booking_users?.length ? booking.booking_users.map(u => u.nickname).join(', ') : '-'}</div>
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
                {cancelledBookings.slice(0, cancelledShowCount).map((booking: Booking) => (
                  <div key={booking.id} className="border border-border rounded-lg p-4 bg-card text-card-foreground hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
                          <div className="flex items-center"><MapPin className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" /><span className="font-medium text-gray-600 dark:text-zinc-300">{booking.room?.name}</span></div>
                          <div className="flex items-center"><Calendar className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" /><span className="text-gray-600 dark:text-zinc-300">{formatDate(booking.date)}</span></div>
                          <div className="flex items-center"><Clock className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" /><span className="text-gray-600 dark:text-zinc-300">{formatTime(booking.start_time, booking.end_time)}</span></div>
                          <div className="flex items-center"><Timer className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" /><span className="text-gray-600 dark:text-zinc-300">{formatDuration(calculateDuration(booking.start_time, booking.end_time))}</span></div>
                        </div>
                        <div className="text-sm text-muted-foreground"><strong>参会人员:</strong> {booking.booking_users?.length ? booking.booking_users.map(u => u.nickname).join(', ') : '-'}</div>
                        <div className="text-sm text-muted-foreground"><strong>预定理由:</strong> {booking.reason}</div>
                        {booking.cancel_reason && (<div className="text-sm text-muted-foreground"><strong>取消理由:</strong> {booking.cancel_reason}</div>)}
                        <div className="text-xs text-muted-foreground">预定时间: {format(parseISO(booking.created_at), 'yyyy-MM-dd HH:mm')}</div>
                      </div>
                      <Badge variant="secondary">已取消</Badge>
                    </div>
                  </div>
                ))}
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