'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { memberApi, bookingApi } from '@/lib/api';
import { useAppContext } from '@/lib/context/app-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, X, CalendarOff, Loader2, Timer, RefreshCcw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Booking } from '@/lib/types';
import { useState, useEffect, useCallback } from 'react';
import { CancelBookingDialog } from '@/components/ui/cancel-booking-dialog';
import { calculateDuration, formatDuration } from '@/lib/utils';

export default function MyBookingsPage() {
  const { currentMember } = useAppContext();
  const queryClient = useQueryClient();

  // 取消预定弹窗状态
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelBookingId, setCancelBookingId] = useState<number | null>(null);

  // 三组独立分页状态
  // 有效预定
  const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
  const [activeLoading, setActiveLoading] = useState(false);
  // 已过期预定
  const [expiredBookings, setExpiredBookings] = useState<Booking[]>([]);
  const [expiredLoading, setExpiredLoading] = useState(false);
  // 已取消预定
  const [cancelledBookings, setCancelledBookings] = useState<Booking[]>([]);
  const [cancelledLoading, setCancelledLoading] = useState(false);

  // 每组显示数量
  const [activeShowCount, setActiveShowCount] = useState(10);
  const [expiredShowCount, setExpiredShowCount] = useState(10);
  const [cancelledShowCount, setCancelledShowCount] = useState(10);

  // 统一加载函数，只请求全部数据
  const loadBookings = useCallback(async () => {
    // 拉取全部数据，page_size 设大一点
    const res = await memberApi.getBookings(currentMember!.id, { page: 1, page_size: 1000 });
    return { filtered: res.data };
  }, [currentMember]);

  // 统一刷新函数
  const reloadAllBookings = useCallback(async () => {
    setActiveLoading(true);
    setExpiredLoading(true);
    setCancelledLoading(true);

    try {
      const { filtered } = await loadBookings();
      
      // 分类数据
      const now = new Date();
      const active: Booking[] = [];
      const expired: Booking[] = [];
      const cancelled: Booking[] = [];

      filtered.forEach((booking: Booking) => {
        if (booking.status === 'cancelled') {
          cancelled.push(booking);
        } else if (booking.status === 'active') {
          // 判断是否过期
          const endDateTime = new Date(`${booking.date}T${booking.end_time}:00`);
          if (booking.end_time === '00:00') {
            endDateTime.setDate(endDateTime.getDate() + 1);
            endDateTime.setHours(0, 0, 0, 0);
          }
          if (endDateTime < now) {
            expired.push(booking);
          } else {
            active.push(booking);
          }
        }
      });

      setActiveBookings(active);
      setExpiredBookings(expired);
      setCancelledBookings(cancelled);
    } catch (error) {
      console.error('加载预定数据失败:', error);
    } finally {
      setActiveLoading(false);
      setExpiredLoading(false);
      setCancelledLoading(false);
    }
  }, [loadBookings]);

  // 初始加载
  useEffect(() => {
    if (currentMember) {
      reloadAllBookings();
    }
  }, [currentMember, reloadAllBookings]);

  // 取消预定的mutation
  const cancelBookingMutation = useMutation({
    mutationFn: ({ bookingId, cancelReason }: { bookingId: number; cancelReason: string }) => 
      bookingApi.cancel(bookingId, cancelReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      // 新增：取消成功后刷新三组数据
      reloadAllBookings();
      setCancelDialogOpen(false);
      setCancelBookingId(null);
    },
    onError: (error: Error) => {
      console.error('取消预定失败:', error);
      // 可以在这里添加错误提示，比如使用 toast 通知
    },
  });

  // 处理取消预定
  const handleCancelBooking = (bookingId: number) => {
    setCancelBookingId(bookingId);
    setCancelDialogOpen(true);
  };

  // 处理确认取消
  const handleConfirmCancel = (cancelReason: string) => {
    if (cancelBookingId) {
      cancelBookingMutation.mutate({ bookingId: cancelBookingId, cancelReason });
    }
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

  if (!currentMember) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" />
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
              <p className="text-muted-foreground">暂无有效预定</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeBookings.slice(0, activeShowCount).map((booking: Booking) => (
                <div key={booking.id} className="border border-border rounded-lg p-4 bg-card text-card-foreground hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
                        <div className="flex items-center -mr-1">
                          <Badge variant="default">有效</Badge>
                        </div>
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" />
                          <span className="font-medium">{booking.room?.name}</span>
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
                      <div className="text-sm text-muted-foreground">
                        <strong>参会人员:</strong> {booking.booking_users?.length > 0 ? booking.booking_users.map((user) => user.nickname).join(', ') : '-'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <strong>预定理由:</strong> {booking.reason}
                      </div>
                      <div className="text-xs text-muted-foreground">
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
              {activeBookings.length > activeShowCount && (
                <div className="flex justify-center mt-4">
                  <Button onClick={() => setActiveShowCount(c => c + 10)} disabled={activeLoading}>
                    <RefreshCcw className={`w-4 h-4 mr-2${activeLoading ? ' animate-spin' : ''}`} />
                    加载更多
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 已过期预定 */}
      {expiredBookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CalendarOff className="w-5 h-5 mr-2" />
              已过期预定 ({expiredBookings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {expiredBookings.slice(0, expiredShowCount).map((booking: Booking) => (
                <div key={booking.id} className="border border-border rounded-lg p-4 bg-card text-card-foreground hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" />
                          <span className="font-medium text-gray-600 dark:text-zinc-300">{booking.room?.name}</span>
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
                      <div className="text-sm text-muted-foreground">
                        <strong>参会人员:</strong> {booking.booking_users?.length > 0 ? booking.booking_users.map((user) => user.nickname).join(', ') : '-'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <strong>预定理由:</strong> {booking.reason}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        预定时间: {format(parseISO(booking.created_at), 'yyyy-MM-dd HH:mm')}
                      </div>
                    </div>
                    <Badge variant="secondary">已过期</Badge>
                  </div>
                </div>
              ))}
              {expiredBookings.length > expiredShowCount && (
                <div className="flex justify-center mt-4">
                  <Button onClick={() => setExpiredShowCount(c => c + 10)} disabled={expiredLoading}>
                    <RefreshCcw className={`w-4 h-4 mr-2${expiredLoading ? ' animate-spin' : ''}`} />
                    加载更多
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
            {cancelledBookings.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">暂无已取消预定</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cancelledBookings.slice(0, cancelledShowCount).map((booking: Booking) => (
                  <div key={booking.id} className="border border-border rounded-lg p-4 bg-card text-card-foreground hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-1 text-gray-500 dark:text-zinc-300" />
                            <span className="font-medium text-gray-600 dark:text-zinc-300">{booking.room?.name}</span>
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
                        <div className="text-sm text-muted-foreground">
                          <strong>参会人员:</strong> {booking.booking_users?.length > 0 ? booking.booking_users.map((user) => user.nickname).join(', ') : '-'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <strong>预定理由:</strong> {booking.reason}
                        </div>
                        {booking.cancel_reason && (
                          <div className="text-sm text-muted-foreground">
                            <strong>取消理由:</strong> {booking.cancel_reason}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          预定时间: {format(parseISO(booking.created_at), 'yyyy-MM-dd HH:mm')}
                        </div>
                      </div>
                      <Badge variant="secondary">已取消</Badge>
                    </div>
                  </div>
                ))}
                {cancelledBookings.length > cancelledShowCount && (
                  <div className="flex justify-center mt-4">
                    <Button onClick={() => setCancelledShowCount(c => c + 10)} disabled={cancelledLoading}>
                      <RefreshCcw className={`w-4 h-4 mr-2${cancelledLoading ? ' animate-spin' : ''}`} />
                      加载更多
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 预定统计 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {activeBookings.length + expiredBookings.length + cancelledBookings.length}
              </div>
              <div className="text-sm text-muted-foreground">总预定数</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{activeBookings.length}</div>
              <div className="text-sm text-muted-foreground">有效预定</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">{expiredBookings.length}</div>
              <div className="text-sm text-muted-foreground">已过期</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{cancelledBookings.length}</div>
              <div className="text-sm text-muted-foreground">已取消</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {activeBookings.reduce((total, booking) => total + calculateDuration(booking.start_time, booking.end_time), 0)}
              </div>
              <div className="text-sm text-muted-foreground">总时长(小时)</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 取消预定弹窗 */}
      <CancelBookingDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        onConfirm={handleConfirmCancel}
        loading={cancelBookingMutation.isPending}
      />
    </div>
  );
}