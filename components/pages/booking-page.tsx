'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomApi, bookingApi } from '@/lib/api';
import { useAppContext } from '@/lib/context/app-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users, MapPin, AlertCircle, Loader2 } from 'lucide-react';
import { format, addDays, isToday } from 'date-fns';
import { TimeSlot, BookingRequest } from '@/lib/types';

export default function BookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { currentMember } = useAppContext();
  
  // 从URL参数初始化选中的会议室ID
  const initialRoomId = searchParams.get('room') ? parseInt(searchParams.get('room')!) : null;
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(initialRoomId);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  // 从URL参数获取房间ID（保留以防URL参数变化）
  useEffect(() => {
    const roomId = searchParams.get('room');
    if (roomId && parseInt(roomId) !== selectedRoomId) {
      setSelectedRoomId(parseInt(roomId));
    }
  }, [searchParams, selectedRoomId]);

  // 获取会议室列表
  const { data: rooms } = useQuery({
    queryKey: ['rooms', 'open'],
    queryFn: roomApi.getOpen,
  });

  // 获取选中会议室的详细信息
  const { data: selectedRoom } = useQuery({
    queryKey: ['room', selectedRoomId],
    queryFn: () => roomApi.get(selectedRoomId!),
    enabled: !!selectedRoomId,
  });

  // 获取可用时间段
  const { data: availableSlots, isLoading: slotsLoading } = useQuery({
    queryKey: ['available-slots', selectedRoomId, selectedDate],
    queryFn: () => bookingApi.getAvailableSlots(selectedRoomId!, selectedDate),
    enabled: !!selectedRoomId && !!selectedDate,
  });

  // 创建预定的mutation
  const createBookingMutation = useMutation({
    mutationFn: (bookingData: BookingRequest) => bookingApi.create(bookingData),
    onSuccess: () => {
      // 失效相关的查询缓存
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['member-bookings'] });
      if (currentMember) {
        queryClient.invalidateQueries({ queryKey: ['member-bookings', currentMember.id] });
      }
      router.push('/my-bookings');
    },
    onError: (error: Error) => {
      setError(error.message || '预定失败');
    },
  });

  // 生成未来30天的日期选项
  const generateDateOptions = () => {
    const options = [];
    for (let i = 0; i <= 30; i++) {
      const date = addDays(new Date(), i);
      options.push({
        value: format(date, 'yyyy-MM-dd'),
        label: format(date, 'yyyy年MM月dd日') + (isToday(date) ? ' (今天)' : ''),
      });
    }
    return options;
  };

  // 处理时间段选择
  const handleTimeSlotToggle = (timeSlot: string) => {
    setSelectedTimeSlots(prev => {
      if (prev.includes(timeSlot)) {
        return prev.filter(slot => slot !== timeSlot);
      } else {
        const newSlots = [...prev, timeSlot].sort();
        // 检查是否连续
        if (areConsecutive(newSlots)) {
          return newSlots;
        } else {
          setError('选择的时间段必须连续');
          return prev;
        }
      }
    });
    setError('');
  };

  // 检查时间段是否连续
  const areConsecutive = (slots: string[]) => {
    if (slots.length <= 1) return true;
    
    const sorted = slots.sort();
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      
      // 计算当前时间段的结束时间
      const [hours, minutes] = current.split(':').map(Number);
      const endTime = `${String(hours + Math.floor((minutes + 30) / 60)).padStart(2, '0')}:${String((minutes + 30) % 60).padStart(2, '0')}`;
      
      if (endTime !== next) {
        return false;
      }
    }
    return true;
  };

  // 提交预定
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedRoomId || !selectedDate || selectedTimeSlots.length === 0 || !reason.trim()) {
      setError('请填写所有必要信息');
      return;
    }

    if (!currentMember) {
      setError('用户信息不存在');
      return;
    }

    const bookingData: BookingRequest = {
      room_id: selectedRoomId,
      member_id: currentMember.id,
      date: selectedDate,
      time_slots: selectedTimeSlots,
      reason: reason.trim(),
    };

    createBookingMutation.mutate(bookingData);
  };

  // 格式化时间段显示
  const formatTimeSlot = (start: string) => {
    const [hours, minutes] = start.split(':').map(Number);
    const endHours = hours + Math.floor((minutes + 30) / 60);
    const endMinutes = (minutes + 30) % 60;
    const end = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    return `${start} - ${end}`;
  };

  // 过滤掉当前时间之前的时间段，但保留已预定时间段用于显示
  const processTimeSlots = (slots: TimeSlot[]) => {
    if (!selectedDate) return slots;
    
    const today = format(new Date(), 'yyyy-MM-dd');
    const isToday = selectedDate === today;
    
    if (!isToday) {
      return slots;
    }
    
    // 如果是今天，标记当前时间之前的时间段为不可选
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    
    return slots.map(slot => {
      const [slotHours, slotMinutes] = slot.start.split(':').map(Number);
      const isPastTime = slotHours < currentHours || 
        (slotHours === currentHours && slotMinutes < currentMinutes);
      
      return {
        ...slot,
        is_booked: slot.is_booked || isPastTime // 过去的时间也标记为不可预定
      };
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">预定会议室</h1>
        <p className="text-gray-600">请选择会议室、日期和时间段进行预定</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 会议室选择 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MapPin className="w-5 h-5 mr-2" />
              选择会议室
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select 
              value={selectedRoomId?.toString() || ''} 
              onValueChange={(value) => setSelectedRoomId(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="请选择会议室" />
              </SelectTrigger>
              <SelectContent>
                {rooms?.map((room) => (
                  <SelectItem key={room.id} value={room.id.toString()}>
                    <div className="flex items-center justify-between w-full">
                      <span>{room.name}</span>
                      <Badge variant="secondary" className="ml-2">
                        {room.capacity}人
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedRoom && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center text-sm text-blue-800">
                  <Users className="w-4 h-4 mr-2" />
                  可容纳 {selectedRoom.capacity} 人
                </div>
                {selectedRoom.description && (
                  <p className="mt-2 text-sm text-blue-700">{selectedRoom.description}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 日期选择 */}
        {selectedRoomId && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                选择日期
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedDate} onValueChange={setSelectedDate}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择日期" />
                </SelectTrigger>
                <SelectContent>
                  {generateDateOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* 时间段选择 */}
        {selectedRoomId && selectedDate && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                选择时间段
              </CardTitle>
            </CardHeader>
            <CardContent>
              {slotsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {processTimeSlots(availableSlots?.time_slots || []).map((slot: TimeSlot) => (
                    <Button
                      key={slot.start}
                      type="button"
                      variant={selectedTimeSlots.includes(slot.start) ? "default" : "outline"}
                      className={`justify-start ${slot.is_booked ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400' : ''}`}
                      onClick={() => !slot.is_booked && handleTimeSlotToggle(slot.start)}
                      disabled={slot.is_booked}
                    >
                      {formatTimeSlot(slot.start)}
                      {slot.is_booked && <span className="ml-1 text-xs">(已预定)</span>}
                    </Button>
                  ))}
                </div>
              )}
              
              {selectedTimeSlots.length > 0 && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg">
                  <p className="text-sm font-medium text-green-800">
                    已选择时间段: {formatTimeSlot(selectedTimeSlots[0])} 
                    {selectedTimeSlots.length > 1 && ` - ${formatTimeSlot(selectedTimeSlots[selectedTimeSlots.length - 1]).split(' - ')[1]}`}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    总时长: {selectedTimeSlots.length * 0.5} 小时
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 申请理由 */}
        {selectedTimeSlots.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>申请理由</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="请输入预定理由..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-[100px]"
              />
            </CardContent>
          </Card>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="flex items-center p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* 提交按钮 */}
        <div className="flex justify-center">
          <Button
            type="submit"
            size="lg"
            disabled={!selectedRoomId || !selectedDate || selectedTimeSlots.length === 0 || !reason.trim() || createBookingMutation.isPending}
          >
            {createBookingMutation.isPending ? '预定中...' : '确认预定'}
          </Button>
        </div>
      </form>
    </div>
  );
} 