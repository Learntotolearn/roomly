'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingApi, roomApi } from '@/lib/api';
import { useAppContext } from '@/lib/context/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from "@/components/ui/calendar";

import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Clock, Users, MapPin, AlertCircle, Loader2, CalendarCheck2, ChevronDownIcon, UserPlus, User } from 'lucide-react';
import { addDays, format, isBefore, isToday, startOfDay } from 'date-fns';
import { TimeSlot, BookingRequest } from '@/lib/types';
import { formatDuration } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { zhCN } from 'date-fns/locale';
import { getUserInfo, requestAPI, selectUsers } from '@dootask/tools';

export default function BookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { currentMember } = useAppContext();
  const [openCalendar, setOpenCalendar] = useState(false);
  
  // 从URL参数初始化选中的会议室ID
  const initialRoomId = searchParams.get('room') ? parseInt(searchParams.get('room')!) : null;
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(initialRoomId);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [participantLoading, setParticipantLoading] = useState(false);
  const [participantUserIds, setParticipantUserIds] = useState<number[]>([]);
  const [participantUsers, setParticipantUsers] = useState<{userid: number, nickname: string}[]>([]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  // 从URL参数获取房间ID（保留以防URL参数变化）
  useEffect(() => {
    const roomId = searchParams.get('room');
    if (roomId && parseInt(roomId) !== selectedRoomId) {
      setSelectedRoomId(parseInt(roomId));
    }
  }, [searchParams, selectedRoomId]);

  // 自动选择当前日期
  useEffect(() => {
    if (selectedRoomId && !selectedDate) {
      setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
    }
  }, [selectedRoomId, selectedDate]);

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
    // 预约成功后，后端会自动异步发送会议通知，前端无需再单独请求消息推送接口。
    onSuccess: async () => {
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
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedRoomId || !selectedDate || selectedTimeSlots.length === 0 || !reason.trim()) {
      setError('请填写所有必要信息');
      return;
    }

    if (!currentMember) {
      setError('用户信息不存在');
      return;
    }

    const userInfo = await getUserInfo();
    if (!participantUsers.find((user) => user.userid === userInfo.userid)) {
      // 如果当前用户不在参会人员中，则添加到参会人员中
      participantUsers.push({
        userid: userInfo.userid,
        nickname: userInfo.nickname,
      });
    }

    const bookingData: BookingRequest = {
      room_id: selectedRoomId,
      member_id: currentMember.id,
      date: selectedDate,
      time_slots: selectedTimeSlots,
      reason: reason.trim(),
      booking_users: participantUsers,
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

  // 处理时间段，区分过去时间和已预定时间
  const processTimeSlots = (slots: TimeSlot[]) => {
    if (!selectedDate) return slots;
    
    const today = format(new Date(), 'yyyy-MM-dd');
    const isToday = selectedDate === today;
    
    if (!isToday) {
      return slots.map(slot => ({ ...slot, isPastTime: false }));
    }
    
    // 如果是今天，标记当前时间之前的时间段
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    
    return slots.map(slot => {
      const [slotHours, slotMinutes] = slot.start.split(':').map(Number);
      const isPastTime = slotHours < currentHours || 
        (slotHours === currentHours && slotMinutes < currentMinutes);
      
      return {
        ...slot,
        isPastTime
      };
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">预定会议室</h1>
        <p className="text-gray-600 dark:text-white">请选择会议室、日期和时间段进行预定</p>
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
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
                <div className="flex items-center text-sm text-blue-800 dark:text-blue-200">
                  <Users className="w-4 h-4 mr-2" />
                  可容纳 {selectedRoom.capacity} 人
                </div>
                {selectedRoom.description && (
                  <p className="mt-2 text-sm text-blue-700 dark:text-blue-300">{selectedRoom.description}</p>
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
                <CalendarIcon className="w-5 h-5 mr-2" />
                选择日期
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Popover open={openCalendar} onOpenChange={setOpenCalendar}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    id="date"
                    className="min-w-48 flex justify-between items-center font-normal"
                  >
                    {selectedDate ? (
                      <>
                        {selectedDate}
                        <span className="ml-2 text-gray-500">
                          {format(new Date(selectedDate), 'EEEE', { locale: zhCN })}
                          {isToday(new Date(selectedDate)) && '，今天'}
                        </span>
                      </>
                    ) : "请选择日期"}
                    <ChevronDownIcon />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                  <Calendar
                    mode="single"
                    locale={zhCN}
                    weekStartsOn={0}
                    selected={selectedDate ? new Date(selectedDate) : undefined}
                    captionLayout="label"
                    disabled={(date) => {
                      // 禁用今天之前的日期和30天之后的日期
                      const today = startOfDay(new Date());
                      const maxDate = addDays(today, 30);
                      return isBefore(date, today) || isBefore(maxDate, date);
                    }}
                    onSelect={(date: Date | undefined) => {
                      if (date) {
                        setSelectedDate(format(date, 'yyyy-MM-dd'))
                        setOpenCalendar(false)
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
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
                  {processTimeSlots(availableSlots?.time_slots || []).map((slot: TimeSlot & { isPastTime?: boolean }) => {
                    const isDisabled = slot.is_booked || slot.isPastTime;
                    const getButtonClass = () => {
                      if (slot.is_booked) {
                        return 'opacity-60 cursor-not-allowed bg-red-50 text-red-400 border-red-200';
                      }
                      if (slot.isPastTime) {
                        return 'opacity-40 cursor-not-allowed bg-gray-50 text-gray-400';
                      }
                      return '';
                    };
                    
                    return (
                      <Button
                        key={slot.start}
                        type="button"
                        variant={selectedTimeSlots.includes(slot.start) ? "default" : "outline"}
                        className={`justify-start ${getButtonClass()}`}
                        onClick={() => !isDisabled && handleTimeSlotToggle(slot.start)}
                        disabled={isDisabled}
                      >
                        <div className="truncate w-full">
                          {formatTimeSlot(slot.start)}
                          {slot.is_booked && <span className="ml-1 text-xs">(已预定)</span>}
                        </div>
                      </Button>
                    );
                  })}
                </div>
              )}
              
              {selectedTimeSlots.length > 0 && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg dark:bg-green-900">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    已选择时间段: {formatTimeSlot(selectedTimeSlots[0])} 
                    {selectedTimeSlots.length > 1 && ` - ${formatTimeSlot(selectedTimeSlots[selectedTimeSlots.length - 1]).split(' - ')[1]}`}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    总时长: {formatDuration(selectedTimeSlots.length * 0.5)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 参会人员 */}
        {selectedTimeSlots.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="w-5 h-5 mr-2" />
                参会人员
              </CardTitle>
              <CardDescription>
                选择参会人员后，系统会自动发送通知给参会人员。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" type="button" onClick={() => {
                selectUsers({
                  value: participantUserIds,
                  multipleMax: selectedRoom?.capacity || 0,
                  title: '选择参会人员',
                  placeholder: '请选择参会人员',
                }).then((users) => {
                  setParticipantUserIds(users); // 只存ID
                  setParticipantLoading(true);
                  requestAPI({
                    url: 'users/basic',
                    data: {userid: users},
                  }).then(({data}) => {
                    setParticipantUsers(data.map((user: {userid: number, nickname: string}) => ({userid: user.userid, nickname: user.nickname})));
                  }).finally(() => {
                    setParticipantLoading(false);
                  });
                });
              }}>
                <UserPlus className="w-4 h-4 mr-2" />
                添加参会人员
              </Button>
              {(participantLoading || participantUsers.length > 0) && (
                <div className="flex items-center flex-wrap gap-2 mt-4">
                  {participantUsers.map((user) => user.nickname).join(', ')}
                  {participantLoading && <Loader2 className="w-4 h-4 animate-spin" />}
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
            {createBookingMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                预定中...
              </>
            ) : (
              <>
                <CalendarCheck2 className="w-4 h-4 mr-2" />
                确认预定
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
} 