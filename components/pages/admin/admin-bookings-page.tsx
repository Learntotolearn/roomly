'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingApi, exportApi } from '@/lib/api';
import type { Booking } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { callExtraStore } from '@dootask/tools';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Calendar as LucideCalendar, 
  Clock, 
  MapPin, 
  User, 
  MoreHorizontal, 
  X, 
  FileText, 
  Download,
  Filter,
  Search,
  Loader2,
  Timer,
  ChevronDownIcon
} from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { format, parseISO, isBefore, isToday } from 'date-fns';
import { calculateDuration, formatDuration } from '@/lib/utils';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAppContext } from '@/lib/context/app-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar } from '@/components/ui/calendar';
import { zhCN } from 'date-fns/locale';

export default function AdminBookingsPage() {
  const { Confirm } = useAppContext();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detail, setDetail] = useState<Booking | null>(null);
  // 分页相关
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  // 临时区间选择，仅在弹窗内用
  const [tempRange, setTempRange] = useState<{ from: Date | undefined; to?: Date | undefined }>({ from: undefined, to: undefined });
  const [openStartCalendar, setOpenStartCalendar] = useState(false);
  const [openEndCalendar, setOpenEndCalendar] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, sortBy, sortOrder]);

  // 获取所有预定记录
  const { data: bookingsRes, isLoading, error, refetch } = useQuery<{ data: Booking[]; total: number }>({
    queryKey: ['bookings', page, pageSize, startDate, endDate, statusFilter],
    queryFn: () => bookingApi.getAll({ page, page_size: pageSize, start_date: startDate, end_date: endDate, status: statusFilter !== 'all' ? statusFilter : undefined }),
  });
  const bookings: Booking[] = bookingsRes?.data || [];
  const total: number = bookingsRes?.total || 0;

  // 取消预定
  const cancelBookingMutation = useMutation({
    mutationFn: bookingApi.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['member-bookings'] });
      refetch(); // 新增：主动刷新当前页
    },
  });

  // 处理取消预定
  const handleCancelBooking = (booking: Booking) => {
    Confirm({
      title: '取消预定',
      message: `确定要取消 ${booking.member?.name || ''} 在 ${booking.room?.name || ''} 的预定吗？`,
      onConfirm: () => {
        cancelBookingMutation.mutate(booking.id);
      },
    });
  };

  // 处理导出
  const handleExport = () => {
    const params = {
      ...(statusFilter !== 'all' && { status: statusFilter }),
      ...(startDate && { start_date: startDate }),
      ...(endDate && { end_date: endDate }),
    };
    
    Confirm({
      title: '导出预定记录',
      message: '确定要导出预定记录吗？',
      onConfirm: () => {
        const url = exportApi.exportBookings(params);
        //window.open(url, '_blank');
        callExtraStore("downUrl", url)
      },
    });
  };

  // 判断预定是否过期
  const isBookingExpired = (booking: Booking) => {
    if (!booking || !booking.date || !booking.end_time) return false;
    const endDateTime = new Date(`${booking.date}T${booking.end_time}:00`);
    if (isNaN(endDateTime.getTime())) return false;
    if (booking.end_time === '00:00') {
      endDateTime.setDate(endDateTime.getDate() + 1);
      endDateTime.setHours(0, 0, 0, 0);
    }
    return booking.status === 'active' && isBefore(endDateTime, new Date());
  };

  // 过滤和排序逻辑
  const filteredAndSortedBookings = useMemo(() => {
    if (!bookings) return [];

    const filtered = bookings.filter(Boolean).filter((booking: Booking) => {
      // 搜索过滤
      const matchesSearch = searchTerm === '' || 
        (booking.room?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (booking.member?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (booking.reason?.toLowerCase() || '').includes(searchTerm.toLowerCase());

      // 状态过滤
      let matchesStatus = false;
      if (statusFilter === 'all') {
        matchesStatus = true;
      } else if (statusFilter === 'active') {
        matchesStatus = booking.status === 'active' && !isBookingExpired(booking);
      } else if (statusFilter === 'expired') {
        matchesStatus = booking.status === 'active' && isBookingExpired(booking);
      } else if (statusFilter === 'cancelled') {
        matchesStatus = booking.status === 'cancelled';
      }

      // 日期过滤
      let matchesDate = true;
      if (startDate && booking.date < startDate) matchesDate = false;
      if (endDate && booking.date > endDate) matchesDate = false;

      return matchesSearch && matchesStatus && matchesDate;
    });

    // 排序
    filtered.sort((a: Booking, b: Booking) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'date':
          aValue = new Date(`${a.date || ''} ${a.start_time || ''}`);
          bValue = new Date(`${b.date || ''} ${b.start_time || ''}`);
          break;
        case 'room':
          aValue = a.room?.name || '';
          bValue = b.room?.name || '';
          break;
        case 'member':
          aValue = a.member?.name || '';
          bValue = b.member?.name || '';
          break;
        case 'created':
          aValue = new Date(a.created_at || '');
          bValue = new Date(b.created_at || '');
          break;
        default:
          aValue = a.id;
          bValue = b.id;
      }

      if (a.status === 'cancelled') return 1;
      if (b.status === 'cancelled') return -1;

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [bookings, searchTerm, statusFilter, sortBy, sortOrder, startDate, endDate]);

  // 统计信息
  const stats = useMemo(() => {
    if (!bookings) return { total: 0, active: 0, expired: 0, cancelled: 0, today: 0 };
    const today = format(new Date(), 'yyyy-MM-dd');
    return {
      total: total,
      active: bookings.filter((b: Booking) => b.status === 'active' && !isBookingExpired(b)).length,
      expired: bookings.filter((b: Booking) => b.status === 'active' && isBookingExpired(b)).length,
      cancelled: bookings.filter((b: Booking) => b.status === 'cancelled').length,
      today: bookings.filter((b: Booking) => b.date === today && b.status === 'active').length,
    };
  }, [bookings, total]);

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">预定管理</h1>
          <p className="text-gray-600 dark:text-white">管理系统中的所有预定记录</p>
        </div>
        
        <Button onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          导出记录
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-gray-600 dark:text-zinc-300">总预定数</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
              <div className="text-sm text-gray-600 dark:text-zinc-300">有效预定</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">{stats.expired}</div>
              <div className="text-sm text-gray-600 dark:text-zinc-300">已过期</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
              <div className="text-sm text-gray-600 dark:text-zinc-300">已取消</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.today}</div>
              <div className="text-sm text-gray-600 dark:text-zinc-300">今日预定</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 过滤和排序 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            筛选和排序
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 2xl:gap-8">
            {/* 搜索 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="search">搜索</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="搜索会议室、会员或理由"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
            </div>
            {/* 选择日期区间（提前到第二列） */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="date-range">选择日期区间</Label>
              <Popover open={openStartCalendar} onOpenChange={(open) => {
                if (open) {
                  setTempRange({
                    from: startDate ? new Date(startDate) : undefined,
                    to: endDate ? new Date(endDate) : undefined,
                  });
                }
                setOpenStartCalendar(open);
              }}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex items-center w-full px-3 font-normal justify-between">
                    {startDate && endDate ? (
                      <span className="truncate flex-shrink min-w-0">
                        {startDate} ~ {endDate}
                      </span>
                    ) : <span className="truncate flex-shrink min-w-0">请选择日期区间</span>}
                    <ChevronDownIcon className="ml-2 flex-shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                  <div className="p-2">
                    <Calendar
                      mode="range"
                      locale={zhCN}
                      weekStartsOn={0}
                      selected={tempRange}
                      onSelect={(range) => {
                        if (range && typeof range === 'object' && 'from' in range) {
                          setTempRange({ from: range.from, to: range.to });
                        } else {
                          setTempRange({ from: undefined, to: undefined });
                        }
                      }}
                      captionLayout="dropdown"
                    />
                    <div className="flex justify-between items-center mt-2 px-2">
                      <span className="text-xs text-gray-400">选择时间</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => { setTempRange({ from: undefined, to: undefined }); }}>清空</Button>
                        <Button size="sm" className="bg-[#65a30d] text-white hover:bg-[#4d7c0f]" onClick={() => {
                          if (tempRange.from) {
                            setStartDate(format(tempRange.from, 'yyyy-MM-dd'));
                            if (tempRange.to) {
                              setEndDate(format(tempRange.to, 'yyyy-MM-dd'));
                            } else {
                              setEndDate(undefined);
                            }
                          } else {
                            setStartDate(undefined);
                            setEndDate(undefined);
                          }
                          setPage(1);
                          setOpenStartCalendar(false);
                        }}>确定</Button>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {/* 状态筛选（移到第三列） */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="status">状态</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有状态</SelectItem>
                  <SelectItem value="active">有效</SelectItem>
                  <SelectItem value="expired">已过期</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* 排序方式 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="sort">排序方式</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择排序方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">预定日期</SelectItem>
                  <SelectItem value="room">会议室</SelectItem>
                  <SelectItem value="member">会员</SelectItem>
                  <SelectItem value="created">创建时间</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* 排序顺序 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="order">排序顺序</Label>
              <Select value={sortOrder} onValueChange={(value: 'asc' | 'desc') => setSortOrder(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择排序顺序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">降序</SelectItem>
                  <SelectItem value="asc">升序</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 预定列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            预定列表 ({filteredAndSortedBookings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>会议室</TableHead>
                <TableHead>会员</TableHead>
                <TableHead>日期</TableHead>
                <TableHead>时间</TableHead>
                <TableHead>时长</TableHead>
                <TableHead>理由</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedBookings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center">
                    <div className="flex items-center justify-center">
                      <p className="text-gray-500 py-4">暂无数据</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {filteredAndSortedBookings.map((booking: Booking) => (
                <TableRow key={booking.id}>
                  <TableCell>{booking.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 mr-1 text-gray-500" />
                      {booking.room?.name || ''}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-1 text-gray-500" />
                      {booking.member?.name || ''}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <LucideCalendar className="w-4 h-4 mr-1 text-gray-500" />
                      {formatDate(booking.date || '')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1 text-gray-500" />
                      {formatTime(booking.start_time || '', booking.end_time || '')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Timer className="w-4 h-4 mr-1 text-gray-500" />
                      {formatDuration(calculateDuration(booking.start_time || '', booking.end_time || ''))}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {booking.reason && booking.reason.length > 8 ? (
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-pointer">
                              {booking.reason.slice(0, 8) + '...'}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {booking.reason}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span>{booking.reason || ''}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      booking.status === 'cancelled'
                        ? 'secondary'
                        : isBookingExpired(booking)
                        ? 'secondary'
                        : 'default'
                    }>
                      {booking.status === 'cancelled'
                        ? '已取消'
                        : isBookingExpired(booking)
                        ? '已过期'
                        : '有效'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(parseISO(booking.created_at || ''), 'yyyy-MM-dd HH:mm')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => {
                            setDetail(booking);
                            setDetailDialogOpen(true);
                          }}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          查看详情
                        </DropdownMenuItem>
                        {booking.status === 'active' && (
                          <DropdownMenuItem 
                            onClick={() => handleCancelBooking(booking)}
                            className="text-red-600"
                          >
                            <X className="mr-2 h-4 w-4" />
                            取消预定
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {/* 分页控件 */}
      <div className="flex justify-between items-center mt-4">
        <div className="text-sm text-gray-500 dark:text-gray-300">
          第 {page} / {Math.max(1, Math.ceil(total / pageSize))} 页，共 {total} 条
        </div>
        <div className="flex gap-2 items-center">
          <span>每页</span>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={pageSize}
            onChange={e => {
              setPage(1);
              setPageSize(Number(e.target.value));
            }}
          >
            {[10, 20, 50, 100].map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span>条</span>
          <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>上一页</Button>
          <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize) || 1, p + 1))} disabled={page >= Math.ceil(total / pageSize)}>下一页</Button>
        </div>
      </div>

      {/* 详情弹窗 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>预定详情</DialogTitle>
            {detail && (
              <div className="space-y-2 text-sm text-gray-700 dark:text-zinc-300 mt-4">
                <div>
                  <strong>会议室：</strong>{detail.room?.name || ''}
                </div>
                <div>
                  <strong>预定人：</strong>{detail.member?.name || ''}
                </div>
                <div>
                  <strong>日期：</strong>{formatDate(detail.date || '')}
                </div>
                <div>
                  <strong>时间：</strong>{formatTime(detail.start_time || '', detail.end_time || '')}
                </div>
                <div>
                  <strong>时长：</strong>{formatDuration(calculateDuration(detail.start_time || '', detail.end_time || ''))}
                </div>
                <div>
                  <strong>状态：</strong>
                  <Badge variant={
                    detail.status === 'cancelled'
                      ? 'secondary'
                      : isBookingExpired(detail)
                      ? 'secondary'
                      : 'default'
                  }>
                    {detail.status === 'cancelled'
                      ? '已取消'
                      : isBookingExpired(detail)
                      ? '已过期'
                      : '有效'}
                  </Badge>
                </div>
                <div>
                  <strong>参会人员:</strong> {detail.booking_users?.length > 0 ? detail.booking_users.map((user) => user.nickname).join(', ') : '-'}
                </div>
                <div>
                  <strong>申请理由：</strong>{detail.reason || ''}
                </div>
                <div>
                  <strong>创建时间：</strong>{format(parseISO(detail.created_at || ''), 'yyyy-MM-dd HH:mm')}
                </div>
              </div>
            )}
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 