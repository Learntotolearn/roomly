'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { memberApi, bookingApi } from '@/lib/api';
import { useAppContext } from '@/lib/context/app-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, X, CalendarOff, Loader2, Timer } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Booking } from '@/lib/types';
import { calculateDuration, formatDuration } from '@/lib/utils';

export default function MyBookingsPage() {
  const { currentMember, Confirm } = useAppContext();
  const queryClient = useQueryClient();

  // 获取我的预定记录
  const { data: bookings, isLoading, error } = useQuery({
    queryKey: ['member-bookings', currentMember?.id],
    queryFn: () => memberApi.getBookings(currentMember!.id),
    enabled: !!currentMember?.id,
  });

  // 取消预定的mutation
  const cancelBookingMutation = useMutation({
    mutationFn: (bookingId: number) => bookingApi.cancel(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
    },
  });

  // 处理取消预定
  const handleCancelBooking = (bookingId: number) => {
    Confirm({
      title: '取消预定',
      message: '确定要取消这个预定吗？',
      onConfirm: () => {
        cancelBookingMutation.mutate(bookingId);
      },
    });
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'yyyy年MM月dd日');
    } catch {
      return dateString;
    }
  };

  // 格式化时间
  const formatTime = (startTime: string, endTime: string) => {
    if (endTime === '00:00') {
      endTime = '24:00';
    }
    return `${startTime} - ${endTime}`;
  };

  // 按状态分组预定
  const activeBookings = (bookings?.filter(booking => booking.status === 'active') || []).sort(
    (a, b) => {
      const aDate = new Date(`${a.date} ${a.start_time}`);
      const bDate = new Date(`${b.date} ${b.start_time}`);
      return aDate.getTime() - bDate.getTime();
    }
  );
  const cancelledBookings = (bookings?.filter(booking => booking.status === 'cancelled') || []).sort(
    (a, b) => {
      const aDate = new Date(`${a.date} ${a.start_time}`);
      const bDate = new Date(`${b.date} ${b.start_time}`);
      return aDate.getTime() - bDate.getTime();
    }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">加载失败</h2>
        <p className="text-gray-600 dark:text-white">无法加载预定记录，请检查网络连接</p>
      </div>
    );
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
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            有效预定 ({activeBookings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeBookings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-zinc-300">暂无有效预定</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeBookings.map((booking: Booking) => (
                <div key={booking.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-zinc-800">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
                        <div className="flex items-center -mr-1">
                          <Badge variant="default">有效</Badge>
                        </div>
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" />
                          <span className="font-medium">{booking.room.name}</span>
                        </div>
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" />
                          <span>{formatDate(booking.date)}</span>
                        </div>
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" />
                          <span>{formatTime(booking.start_time, booking.end_time)}</span>
                        </div>
                        <div className="flex items-center">
                          <Timer className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" />
                          <span>{formatDuration(calculateDuration(booking.start_time, booking.end_time))}</span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-zinc-300">
                        <strong>申请理由:</strong> {booking.reason}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-zinc-300">
                        预定时间: {format(parseISO(booking.created_at), 'yyyy-MM-dd HH:mm')}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelBooking(booking.id)}
                        disabled={cancelBookingMutation.isPending}
                      >
                        <X className="w-4 h-4 mr-1" />
                        取消
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 已取消预定 */}
      {cancelledBookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CalendarOff className="w-5 h-5 mr-2" />
              已取消预定 ({cancelledBookings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {cancelledBookings.map((booking: Booking) => (
                <div key={booking.id} className="border rounded-lg p-4 bg-gray-50 dark:bg-zinc-800">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" />
                          <span className="font-medium text-gray-600 dark:text-zinc-300">{booking.room.name}</span>
                        </div>
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" />
                          <span className="text-gray-600 dark:text-zinc-300">{formatDate(booking.date)}</span>
                        </div>
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" />
                          <span className="text-gray-600 dark:text-zinc-300">{formatTime(booking.start_time, booking.end_time)}</span>
                        </div>
                        <div className="flex items-center">
                          <Timer className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" />
                          <span className="text-gray-600 dark:text-zinc-300">{formatDuration(calculateDuration(booking.start_time, booking.end_time))}</span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-zinc-300">
                        <strong>申请理由:</strong> {booking.reason}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-zinc-300">
                        预定时间: {format(parseISO(booking.created_at), 'yyyy-MM-dd HH:mm')}
                      </div>
                    </div>
                    <Badge variant="secondary">已取消</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 预定统计 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {bookings?.length || 0}
              </div>
              <div className="text-sm text-gray-600 dark:text-zinc-300">总预定数</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {activeBookings.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-zinc-300">有效预定</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {cancelledBookings.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-zinc-300">已取消</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {activeBookings.reduce((total, booking) => {
                  return total + calculateDuration(booking.start_time, booking.end_time);
                }, 0)}
              </div>
              <div className="text-sm text-gray-600 dark:text-zinc-300">总时长(小时)</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 