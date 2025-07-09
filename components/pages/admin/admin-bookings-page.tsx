'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingApi, exportApi } from '@/lib/api';
import { Booking } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Calendar, 
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
  Timer
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { calculateDuration, formatDuration } from '@/lib/utils';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAppContext } from '@/lib/context/app-context';

export default function AdminBookingsPage() {
  const { Confirm } = useAppContext();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detail, setDetail] = useState<Booking | null>(null);

  // 获取所有预定记录
  const { data: bookings, isLoading, error } = useQuery({
    queryKey: ['bookings'],
    queryFn: bookingApi.getAll,
  });

  // 取消预定
  const cancelBookingMutation = useMutation({
    mutationFn: bookingApi.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['member-bookings'] });
    },
  });

  // 处理取消预定
  const handleCancelBooking = (booking: Booking) => {
    Confirm({
      title: '取消预定',
      message: `确定要取消 ${booking.member.name} 在 ${booking.room.name} 的预定吗？`,
      onConfirm: () => {
        cancelBookingMutation.mutate(booking.id);
      },
    });
  };

  // 处理导出
  const handleExport = () => {
    const params = {
      ...(statusFilter !== 'all' && { status: statusFilter }),
    };
    
    Confirm({
      title: '导出预定记录',
      message: '确定要导出预定记录吗？',
      onConfirm: () => {
        const url = exportApi.exportBookings(params);
        window.open(url, '_blank');
      },
    });
  };

  // 过滤和排序逻辑
  const filteredAndSortedBookings = useMemo(() => {
    if (!bookings) return [];

    const filtered = bookings.filter(booking => {
      // 搜索过滤
      const matchesSearch = searchTerm === '' || 
        booking.room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.reason.toLowerCase().includes(searchTerm.toLowerCase());

      // 状态过滤
      const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    // 排序
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'date':
          aValue = new Date(`${a.date} ${a.start_time}`);
          bValue = new Date(`${b.date} ${b.start_time}`);
          break;
        case 'room':
          aValue = a.room.name;
          bValue = b.room.name;
          break;
        case 'member':
          aValue = a.member.name;
          bValue = b.member.name;
          break;
        case 'created':
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
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
  }, [bookings, searchTerm, statusFilter, sortBy, sortOrder]);

  // 统计信息
  const stats = useMemo(() => {
    if (!bookings) return { total: 0, active: 0, cancelled: 0, today: 0 };

    const today = format(new Date(), 'yyyy-MM-dd');
    
    return {
      total: bookings.length,
      active: bookings.filter(b => b.status === 'active').length,
      cancelled: bookings.filter(b => b.status === 'cancelled').length,
      today: bookings.filter(b => b.date === today && b.status === 'active').length,
    };
  }, [bookings]);

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 2xl:gap-8">
            <div className="flex flex-col gap-2">
              <Label htmlFor="search">搜索</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="搜索会议室、会员或理由"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="status">状态</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有状态</SelectItem>
                  <SelectItem value="active">有效</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              {filteredAndSortedBookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell>{booking.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 mr-1 text-gray-500" />
                      {booking.room.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-1 text-gray-500" />
                      {booking.member.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1 text-gray-500" />
                      {formatDate(booking.date)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1 text-gray-500" />
                      {formatTime(booking.start_time, booking.end_time)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Timer className="w-4 h-4 mr-1 text-gray-500" />
                      {formatDuration(calculateDuration(booking.start_time, booking.end_time))}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {booking.reason}
                  </TableCell>
                  <TableCell>
                    <Badge variant={booking.status === 'active' ? "default" : "secondary"}>
                      {booking.status === 'active' ? '有效' : '已取消'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(parseISO(booking.created_at), 'yyyy-MM-dd HH:mm')}
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

      {/* 详情弹窗 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>预定详情</DialogTitle>
            {detail && (
              <div className="space-y-2 text-sm text-gray-700 mt-4">
                <div>
                  <strong>会议室：</strong>{detail.room.name}
                </div>
                <div>
                  <strong>预定人：</strong>{detail.member.name}
                </div>
                <div>
                  <strong>日期：</strong>{formatDate(detail.date)}
                </div>
                <div>
                  <strong>时间：</strong>{formatTime(detail.start_time, detail.end_time)}
                </div>
                <div>
                  <strong>时长：</strong>{formatDuration(calculateDuration(detail.start_time, detail.end_time))}
                </div>
                <div>
                  <strong>状态：</strong>
                  <Badge variant={detail.status === 'active' ? "default" : "secondary"}>
                    {detail.status === 'active' ? '有效' : '已取消'}
                  </Badge>
                </div>
                <div>
                  <strong>申请理由：</strong>{detail.reason}
                </div>
                <div>
                  <strong>创建时间：</strong>{format(parseISO(detail.created_at), 'yyyy-MM-dd HH:mm')}
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