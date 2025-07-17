'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { memberApi, bookingApi } from '@/lib/api';
import { useAppContext } from '@/lib/context/app-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, X, CalendarOff, Loader2, Timer, RefreshCcw } from 'lucide-react';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { Booking } from '@/lib/types';
import { calculateDuration, formatDuration } from '@/lib/utils';
import { useState, useEffect, useCallback } from 'react';

export default function MyBookingsPage() {
  const { currentMember, Confirm } = useAppContext();
  const queryClient = useQueryClient();

  // 三组独立分页状态
  const pageSize = 10;
  // 有效预定
  const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
  const [activePage, setActivePage] = useState(1);
  const [activeTotal, setActiveTotal] = useState(0);
  const [activeLoading, setActiveLoading] = useState(false);
  const [activeHasMore, setActiveHasMore] = useState(true);
  // 已过期预定
  const [expiredBookings, setExpiredBookings] = useState<Booking[]>([]);
  const [expiredPage, setExpiredPage] = useState(1);
  const [expiredTotal, setExpiredTotal] = useState(0);
  const [expiredLoading, setExpiredLoading] = useState(false);
  const [expiredHasMore, setExpiredHasMore] = useState(true);
  // 已取消预定
  const [cancelledBookings, setCancelledBookings] = useState<Booking[]>([]);
  const [cancelledPage, setCancelledPage] = useState(1);
  const [cancelledTotal, setCancelledTotal] = useState(0);
  const [cancelledLoading, setCancelledLoading] = useState(false);
  const [cancelledHasMore, setCancelledHasMore] = useState(true);

  // 统一加载函数，全部走后端分组分页
  const loadBookings = useCallback(async (status: 'active'|'expired'|'cancelled', page: number) => {
    let res = await memberApi.getBookings(currentMember!.id, { page, page_size: pageSize, status });
    return { filtered: res.data, total: res.total };
  }, [currentMember]);

  // 首次加载
  useEffect(() => {
    if (!currentMember?.id) return;
    setActiveLoading(true);
    setExpiredLoading(true);
    setCancelledLoading(true);
    Promise.all([
      loadBookings('active', 1),
      loadBookings('expired', 1),
      loadBookings('cancelled', 1)
    ]).then(([a, e, c]) => {
      setActiveBookings(a.filtered);
      setActiveTotal(a.total);
      setActiveHasMore(a.filtered.length >= 5 && a.filtered.length < a.total);
      setActivePage(2);
      setActiveLoading(false);
      setExpiredBookings(e.filtered);
      setExpiredTotal(e.total);
      setExpiredHasMore(e.filtered.length >= 5 && e.filtered.length < e.total);
      setExpiredPage(2);
      setExpiredLoading(false);
      setCancelledBookings(c.filtered);
      setCancelledTotal(c.total);
      setCancelledHasMore(c.filtered.length >= 5 && c.filtered.length < c.total);
      setCancelledPage(2);
      setCancelledLoading(false);
    });
  }, [currentMember, loadBookings]);

  // 各分组加载更多
  const loadMoreActive = async () => {
    setActiveLoading(true);
    const { filtered, total } = await loadBookings('active', activePage);
    setActiveBookings(prev => [...prev, ...filtered]);
    setActiveHasMore(filtered.length > 0 && (activeBookings.length + filtered.length) < total && (activeBookings.length + filtered.length) >= 5);
    setActivePage(activePage + 1);
    setActiveLoading(false);
  };
  const loadMoreExpired = async () => {
    setExpiredLoading(true);
    const { filtered, total } = await loadBookings('expired', expiredPage);
    setExpiredBookings(prev => [...prev, ...filtered]);
    setExpiredHasMore(filtered.length > 0 && (expiredBookings.length + filtered.length) < total && (expiredBookings.length + filtered.length) >= 5);
    setExpiredPage(expiredPage + 1);
    setExpiredLoading(false);
  };
  const loadMoreCancelled = async () => {
    setCancelledLoading(true);
    const { filtered, total } = await loadBookings('cancelled', cancelledPage);
    setCancelledBookings(prev => [...prev, ...filtered]);
    setCancelledHasMore(filtered.length > 0 && (cancelledBookings.length + filtered.length) < total && (cancelledBookings.length + filtered.length) >= 5);
    setCancelledPage(cancelledPage + 1);
    setCancelledLoading(false);
  };

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

  // 判断预定是否过期
  const isBookingExpired = (booking: Booking) => {
    // booking.date 格式: yyyy-MM-dd, end_time 格式: HH:mm
    const endDateTime = new Date(`${booking.date}T${booking.end_time}:00`);
    // 处理跨午夜的情况（如 end_time 为 00:00，表示24:00）
    if (booking.end_time === '00:00') {
      endDateTime.setDate(endDateTime.getDate() + 1);
      endDateTime.setHours(0, 0, 0, 0);
    }
    return isBefore(endDateTime, new Date());
  };

  // 有效预定：未过期且active
  const activeBookingsList = (bookings?: Booking[]) => (
    bookings?.filter(
      booking => booking.status === 'active' && !isBookingExpired(booking)
    ) || []
  );
  // 已过期预定：active但已过期
  const expiredBookingsList = (bookings?: Booking[]) => (
    bookings?.filter(
      booking => booking.status === 'active' && isBookingExpired(booking)
    ) || []
  );
  const cancelledBookingsList = (bookings?: Booking[]) => (
    bookings?.filter(booking => booking.status === 'cancelled') || []
  );

  if (
    activeLoading && activeBookings.length === 0 &&
    expiredLoading && expiredBookings.length === 0 &&
    cancelledLoading && cancelledBookings.length === 0
  ) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (
    activeBookings.length === 0 &&
    expiredBookings.length === 0 &&
    cancelledBookings.length === 0 &&
    !activeLoading && !expiredLoading && !cancelledLoading
  ) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">暂无预定记录</h2>
        <p className="text-gray-600 dark:text-white">您还没有预定任何会议室，请点击下方按钮进行预定。</p>
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
              {activeBookings.map((booking: Booking) => (
                <div key={booking.id} className="border border-border rounded-lg p-4 bg-card text-card-foreground hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors">
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
                      <div className="text-sm text-muted-foreground">
                        <strong>参会人员:</strong> {booking.booking_users?.length > 0 ? booking.booking_users.map((user) => user.nickname).join(', ') : '-'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <strong>申请理由:</strong> {booking.reason}
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
              {/* 有效预定加载更多 */}
              <div className="flex justify-center mt-4">
                {activeHasMore && (
                  <Button onClick={loadMoreActive} disabled={activeLoading} size="sm">
                    {activeLoading ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
                    {activeLoading ? '加载中...' : '加载更多'}
                  </Button>
                )}
                {!activeHasMore && activeBookings.length >= 5 && (
                  <span className="text-muted-foreground text-sm">已加载全部数据</span>
                )}
              </div>
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
              {expiredBookings.map((booking: Booking) => (
                <div key={booking.id} className="border border-border rounded-lg p-4 bg-card text-card-foreground hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors">
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
                      <div className="text-sm text-muted-foreground">
                        <strong>参会人员:</strong> {booking.booking_users?.length > 0 ? booking.booking_users.map((user) => user.nickname).join(', ') : '-'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <strong>申请理由:</strong> {booking.reason}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        预定时间: {format(parseISO(booking.created_at), 'yyyy-MM-dd HH:mm')}
                      </div>
                    </div>
                    <Badge variant="secondary">已过期</Badge>
                  </div>
                </div>
              ))}
              {/* 已过期预定加载更多 */}
              <div className="flex justify-center mt-4">
                {expiredHasMore && (
                  <Button onClick={loadMoreExpired} disabled={expiredLoading} size="sm">
                    {expiredLoading ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
                    {expiredLoading ? '加载中...' : '加载更多'}
                  </Button>
                )}
                {!expiredHasMore && expiredBookings.length >= 5 && (
                  <span className="text-muted-foreground text-sm">已加载全部数据</span>
                )}
              </div>
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
            <div className="space-y-4">
              {cancelledBookings.map((booking: Booking) => (
                <div key={booking.id} className="border border-border rounded-lg p-4 bg-card text-card-foreground hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors">
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
                      <div className="text-sm text-muted-foreground">
                        <strong>参会人员:</strong> {booking.booking_users?.length > 0 ? booking.booking_users.map((user) => user.nickname).join(', ') : '-'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <strong>申请理由:</strong> {booking.reason}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        预定时间: {format(parseISO(booking.created_at), 'yyyy-MM-dd HH:mm')}
                      </div>
                    </div>
                    <Badge variant="secondary">已取消</Badge>
                  </div>
                </div>
              ))}
              {/* 已取消预定加载更多 */}
              <div className="flex justify-center mt-4">
                {cancelledHasMore && (
                  <Button onClick={loadMoreCancelled} disabled={cancelledLoading} size="sm">
                    {cancelledLoading ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
                    {cancelledLoading ? '加载中...' : '加载更多'}
                  </Button>
                )}
                {!cancelledHasMore && cancelledBookings.length >= 5 && (
                  <span className="text-muted-foreground text-sm">已加载全部数据</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 预定统计 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {activeTotal + expiredTotal + cancelledTotal}
              </div>
              <div className="text-sm text-muted-foreground">总预定数</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {activeTotal}
              </div>
              <div className="text-sm text-muted-foreground">有效预定</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">
                {expiredTotal}
              </div>
              <div className="text-sm text-muted-foreground">已过期</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {cancelledTotal}
              </div>
              <div className="text-sm text-muted-foreground">已取消</div>
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
              <div className="text-sm text-muted-foreground">总时长(小时)</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 