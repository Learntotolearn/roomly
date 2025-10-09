'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CalendarIcon, Clock } from 'lucide-react';
import { bookingApi } from '@/lib/api';
import { Booking } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { EnhancedTimeSlots } from '@/components/ui/enhanced-time-slots';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

interface TimeSlotItem {
  start: string;       // 开始时间，如 "09:00"
  end: string;         // 结束时间，如 "09:30"
  is_booked: boolean;  // 是否已被占用（不可选）
}

interface AvailableSlots {
  date: string;
  time_slots: TimeSlotItem[];
}

interface Props {
  booking: Booking;
  isOpen: boolean;
  isUpdating: boolean;
  onClose: () => void;
  onConfirm: (date: string, timeSlots: string[]) => Promise<void> | void;
}

function getEndTime(start: string): string {
  const [h, m] = start.split(':').map(Number);
  let hour = h;
  let minute = m + 30;
  if (minute >= 60) {
    minute -= 60;
    hour += 1;
    if (hour >= 24) hour = 0;
  }
  // 若为 00:00（跨日），展示为 24:00
  if (hour === 0 && minute === 0) return '24:00';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function generateAllStarts(): string[] {
  const list: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      list.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return list;
}

function isConsecutive(slots: string[]): boolean {
  if (slots.length <= 1) return true;
  for (let i = 0; i < slots.length - 1; i++) {
    if (getEndTime(slots[i]) !== slots[i + 1]) return false;
  }
  return true;
}

function sortSlots(slots: string[]): string[] {
  return [...slots].sort((a, b) => {
    const [ah, am] = a.split(':').map(Number);
    const [bh, bm] = b.split(':').map(Number);
    return ah * 60 + am - (bh * 60 + bm);
  });
}

export default function RescheduleBookingDialog(props: Props) {
  const { booking, isOpen, isUpdating, onClose, onConfirm } = props;
  const [date, setDate] = useState<string>(booking?.date || format(new Date(), 'yyyy-MM-dd'));
  const [available, setAvailable] = useState<AvailableSlots | null>(null);
  const [selected, setSelected] = useState<string[]>([]); // 仅保存开始时间数组

  // 当前预定原始覆盖的 30 分钟开始刻（用于在修改时放开自身原时段的选择）
  const originalStarts = useMemo(() => {
    if (!booking) return [] as string[];
    const out: string[] = [];
    let cur = booking.start_time;
    // 生成到 end_time 前的所有开始刻（与初始化 selected 相同，但不随交互改变）
    while (cur !== booking.end_time && cur !== '24:00') {
      out.push(cur);
      const next = getEndTime(cur);
      if (next === '24:00') break;
      cur = next;
    }
    return out;
  }, [booking]);

  // 初始选中为当前预定的实际段（按 30min 刻生成）
  useEffect(() => {
    if (!booking) return;
    setDate(booking.date);
    const starts: string[] = [];
    let cur = booking.start_time;
    while (cur !== booking.end_time && cur !== '24:00') {
      starts.push(cur);
      const next = getEndTime(cur);
      // "24:00" 不是标准开始刻，停止
      if (next === '24:00') break;
      cur = next;
    }
    setSelected(starts);
  }, [booking]);

  // 拉取可用时间段（与创建预定一致）
  const fetchSlots = useCallback(async () => {
    if (!booking?.room?.id || !date) return;
    try {
      const res = await bookingApi.getAvailableSlots(booking.room.id, date) as unknown as AvailableSlots;
      // 如果后端返回为 models.AvailableSlots（字段为 Date/TimeSlots），做兼容映射
      const mapped: AvailableSlots = {
        date: (res as any).date ?? (res as any).Date ?? date,
        time_slots: ((res as any).time_slots ?? (res as any).TimeSlots ?? []).map((s: any) => ({
          start: s.start ?? s.Start,
          end: s.end ?? s.End,
          // 严格保留后端语义：统一输出 is_booked
          is_booked: Boolean(s.is_booked ?? s.IsBooked ?? s.isBooked),
        })),
      };
      setAvailable(mapped);
    } catch (e) {
      console.error('获取可用时间段失败:', e);
      setAvailable({
        date,
        time_slots: [],
      });
    }
  }, [booking?.room?.id, date]);

  useEffect(() => { if (isOpen) fetchSlots(); }, [isOpen, fetchSlots]);
  useEffect(() => { fetchSlots(); }, [date, fetchSlots]);

  const allStarts = useMemo(() => generateAllStarts(), []);
  const slotMap = useMemo(() => {
    const map = new Map<string, TimeSlotItem>();
    const src = available?.time_slots ?? allStarts.map(s => ({ start: s, end: getEndTime(s), is_booked: false } as TimeSlotItem));
    src.forEach((s: any) => map.set(s.start, s as TimeSlotItem));
    return map;
  }, [available, allStarts]);

  const orderedSelected = useMemo(() => sortSlots(selected), [selected]);
  const selectedStart = orderedSelected[0] || '';
  const selectedEnd = orderedSelected.length > 0 ? getEndTime(orderedSelected[orderedSelected.length - 1]) : '';

  // 点击逻辑：与创建预定一致
  const handleClickStart = (start: string) => {
    const item = slotMap.get(start);
    if (!item || (item as any).is_booked) return; // 不可选

    if (orderedSelected.length === 0) {
      setSelected([start]);
      return;
    }

    const head = orderedSelected[0];
    const tail = orderedSelected[orderedSelected.length - 1];

    // 向后扩展：点击尾部的下一格
    if (getEndTime(tail) === start) {
      setSelected([...orderedSelected, start]);
      return;
    }
    // 向前扩展：点击头部的上一格
    const prevOfHead = (() => {
      const idx = allStarts.indexOf(head);
      if (idx > 0) return allStarts[idx - 1];
      return '';
    })();
    if (prevOfHead && prevOfHead === start) {
      setSelected([start, ...orderedSelected]);
      return;
    }

    // 如果点击的是当前已选中的任一格，重置为从该格重新起选
    if (orderedSelected.includes(start)) {
      setSelected([start]);
      return;
    }

    // 其他非相邻情况：重置为仅该格
    setSelected([start]);
  };

  const canSave = orderedSelected.length > 0 && isConsecutive(orderedSelected);

  const onSave = async () => {
    if (!canSave) return;
    try {
      await onConfirm(date, orderedSelected);
    } catch (e: any) {
      const msg = String(e?.message || e || '');
      // 识别 409/Conflict，友好提示并刷新可用时段
      if (msg.includes('409') || /Conflict/i.test(msg)) {
        console.warn('[RescheduleDialog] 与其他预定冲突，已刷新可用时段');
        // 尝试刷新可用时段，避免继续选到冲突时段
        await fetchSlots();
        // 简单提示（如项目有 toast，可替换为 toast.error）
        alert('所选时间段与其他预定冲突，请重新选择。');
        return;
      }
      // 其他错误交由外层处理
      throw e;
    }
  };

  // UI
  if (!isOpen) return null;

  // 简易日期选择器（保持与项目风格一致，使用原生输入以降低依赖）
  const renderDatePicker = (
    <div className="space-y-3">
      <div className="flex items-center text-sm text-muted-foreground">
        <CalendarIcon className="w-4 h-4 mr-2" />
        当前日期：{format(new Date(date), 'yyyy年MM月dd日', { locale: zhCN })}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-start">
            <CalendarIcon className="w-4 h-4 mr-2" />
            {format(new Date(date), 'yyyy/MM/dd', { locale: zhCN })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-2 w-auto">
          <Calendar
            mode="single"
            selected={new Date(date)}
            onSelect={(d: Date | undefined) => {
              if (!d) return;
              const iso = format(d, 'yyyy-MM-dd');
              setDate(iso);
              setSelected([]);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );

  // 与创建页一致的时间段展示格式
  const formatTimeSlot = (start: string) => {
    const [hours, minutes] = start.split(':').map(Number);
    const endHours = hours + Math.floor((minutes + 30) / 60);
    const endMinutes = (minutes + 30) % 60;
    const end = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    return `${start} - ${end}`;
  };

  // 与创建页一致的选择逻辑（保证连续）
  const handleTimeSlotToggle = (timeSlot: string) => {
    setSelected(prev => {
      if (prev.includes(timeSlot)) {
        const next = prev.filter(slot => slot !== timeSlot).sort();
        return next;
      } else {
        const next = [...prev, timeSlot].sort();
        return isConsecutive(next) ? next : prev; // 非连续则保持原选中，不弹错
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card text-card-foreground rounded-lg p-6 w-full max-w-3xl mx-4 sm:mx-0">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">修改预定时间</h2>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/20"
            aria-label="关闭"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18"></path>
              <path d="M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {renderDatePicker}

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">选择连续时间段</div>
            <div className="border rounded-2xl overflow-hidden">
              <div className="max-h-72 overflow-auto p-3">
                <EnhancedTimeSlots
                  slots={(available?.time_slots || [])
                    .map(slot => {
                      // 按服务端字段展示：已预定置灰，可用显示在“可选时间段”分区
                      const start = (slot as any).start;
                      const end = (slot as any).end;
                      // 基于服务端占用标记，并对“当前预定原时段”进行前端放开（允许选择自身原时段）
                      let is_booked = Boolean((slot as any).is_booked ?? (slot as any).IsBooked ?? (slot as any).isBooked);
                      if (booking && date === booking.date && start && originalStarts.includes(start)) {
                        is_booked = false;
                      }

                      // 计算是否为过去时间（仅当天计算）
                      const today = format(new Date(), 'yyyy-MM-dd');
                      const isToday = date === today;
                      let isPastTime = false;
                      if (isToday && start) {
                        const now = new Date();
                        const [slotHours, slotMinutes] = String(start).split(':').map(Number);
                        let endHours = slotHours;
                        let endMinutes = slotMinutes + 30;
                        if (endMinutes >= 60) { endMinutes -= 60; endHours += 1; }
                        isPastTime = now.getHours() > endHours || (now.getHours() === endHours && now.getMinutes() >= endMinutes);
                      }
                      return { start, end, is_booked, isPastTime } as any;
                    })}
                  selectedTimeSlots={orderedSelected}
                  onTimeSlotToggle={handleTimeSlotToggle}
                  formatTimeSlot={formatTimeSlot}
                />
              </div>
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              已选时段：{selectedStart && selectedEnd ? `${selectedStart} - ${selectedEnd}` : '-'}
            </div>
            {!canSave && (
              <div className="mt-2 text-xs text-muted-foreground">
                请选择连续的 30 分钟时间段
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={onSave} disabled={!canSave || isUpdating}>保存</Button>
        </div>
      </div>
    </div>
  );
}