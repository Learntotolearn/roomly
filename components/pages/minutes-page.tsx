'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { minutesApi, bookingApi } from '@/lib/api';
import type { MeetingMinutes, Booking } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  FileText, 
  Plus, 
  Edit, 
  Trash2, 
  MoreHorizontal, 
  Search,
  Filter,
  Loader2,
  Calendar,
  User,
  MapPin,
  Clock
} from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAppContext } from '@/lib/context/app-context';
import { format, parseISO } from 'date-fns';

export default function MinutesPage() {
  const { Confirm } = useAppContext();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bookingFilter, setBookingFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMinutes, setEditingMinutes] = useState<MeetingMinutes | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    summary: '',
    key_points: '',
    action_items: '',
    status: 'draft',
    booking_id: 0
  });

  // 获取所有会议纪要
  const { data: minutes, isLoading, error } = useQuery({
    queryKey: ['minutes', statusFilter, bookingFilter],
    queryFn: () => minutesApi.getAll({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      booking_id: bookingFilter !== 'all' ? parseInt(bookingFilter) : undefined,
    }),
  });

  // 获取所有预定记录（用于筛选）
  const { data: bookings } = useQuery({
    queryKey: ['bookings', 'all'],
    queryFn: () => bookingApi.getAll({ page_size: 1000 }),
  });

  // 创建会议纪要
  const createMinutesMutation = useMutation({
    mutationFn: minutesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minutes'] });
      setDialogOpen(false);
      resetForm();
    },
  });

  // 更新会议纪要
  const updateMinutesMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => minutesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minutes'] });
      setDialogOpen(false);
      resetForm();
    },
  });

  // 删除会议纪要
  const deleteMinutesMutation = useMutation({
    mutationFn: minutesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minutes'] });
    },
  });

  // 重置表单
  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      summary: '',
      key_points: '',
      action_items: '',
      status: 'draft',
      booking_id: 0
    });
    setEditingMinutes(null);
  };

  // 打开创建对话框
  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  // 打开编辑对话框
  const openEditDialog = (minutes: MeetingMinutes) => {
    setEditingMinutes(minutes);
    setFormData({
      title: minutes.title,
      content: minutes.content,
      summary: minutes.summary,
      key_points: minutes.key_points,
      action_items: minutes.action_items,
      status: minutes.status,
      booking_id: minutes.booking_id
    });
    setDialogOpen(true);
  };

  // 处理表单提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingMinutes) {
      updateMinutesMutation.mutate({ id: editingMinutes.id, data: formData });
    } else {
      createMinutesMutation.mutate(formData);
    }
  };

  // 处理删除
  const handleDelete = (minutes: MeetingMinutes) => {
    Confirm({
      title: '删除会议纪要',
      message: `确定要删除会议纪要"${minutes.title}"吗？`,
      onConfirm: () => {
        deleteMinutesMutation.mutate(minutes.id);
      },
    });
  };

  // 过滤会议纪要
  const filteredMinutes = useMemo(() => {
    if (!minutes || !Array.isArray(minutes)) return [];
    
    return minutes.filter(minute => {
      const matchesSearch = searchTerm === '' || 
        minute.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (minute.content && minute.content.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return matchesSearch;
    });
  }, [minutes, searchTerm]);

  // 获取状态显示文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return '草稿';
      case 'published': return '已发布';
      case 'archived': return '已归档';
      default: return status;
    }
  };

  // 获取状态颜色
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'published': return 'default';
      case 'archived': return 'secondary';
      default: return 'secondary';
    }
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
        <p className="text-gray-600 dark:text-white">无法加载会议纪要，请检查网络连接</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">会议纪要管理</h1>
          <p className="text-gray-600 dark:text-white">管理和查看所有会议纪要</p>
        </div>
        
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          新建纪要
        </Button>
      </div>

      {/* 筛选和搜索 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            筛选和搜索
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 搜索 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="search">搜索</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="搜索标题或内容"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* 状态筛选 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="status">状态</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有状态</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="published">已发布</SelectItem>
                  <SelectItem value="archived">已归档</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* 预定筛选 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="booking">预定</Label>
              <Select value={bookingFilter} onValueChange={setBookingFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="选择预定" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有预定</SelectItem>
                  {bookings?.data?.map((booking: Booking) => (
                    <SelectItem key={booking.id} value={booking.id.toString()}>
                      {booking.room?.name} - {booking.date}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 会议纪要列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            会议纪要列表 ({filteredMinutes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>预定信息</TableHead>
                <TableHead>创建者</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMinutes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    <div className="flex items-center justify-center">
                      <p className="text-gray-500 py-4">暂无会议纪要</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {filteredMinutes.map((minutes) => (
                <TableRow key={minutes.id}>
                  <TableCell>
                    <div className="font-medium">{minutes.title}</div>
                    {minutes.content && (
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {minutes.content}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center text-sm">
                        <MapPin className="w-3 h-3 mr-1" />
                        {minutes.booking?.room?.name}
                      </div>
                      <div className="flex items-center text-sm">
                        <Calendar className="w-3 h-3 mr-1" />
                        {minutes.booking?.date}
                      </div>
                      <div className="flex items-center text-sm">
                        <Clock className="w-3 h-3 mr-1" />
                        {minutes.booking?.start_time} - {minutes.booking?.end_time}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-1 text-gray-500" />
                      {minutes.creator?.name || '未知'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(minutes.status)}>
                      {getStatusText(minutes.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(parseISO(minutes.created_at), 'yyyy-MM-dd HH:mm')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(minutes)}>
                          <Edit className="mr-2 h-4 w-4" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(minutes)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 创建/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMinutes ? '编辑会议纪要' : '新建会议纪要'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 预定选择 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="booking_id">选择预定</Label>
              <Select 
                value={formData.booking_id.toString()} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, booking_id: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择预定" />
                </SelectTrigger>
                <SelectContent>
                  {bookings?.data?.map((booking: Booking) => (
                    <SelectItem key={booking.id} value={booking.id.toString()}>
                      {booking.room?.name} - {booking.date} {booking.start_time}-{booking.end_time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 标题 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">标题</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="请输入会议纪要标题"
                required
              />
            </div>

            {/* 内容 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="content">内容</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="请输入会议纪要内容"
                rows={6}
              />
            </div>

            {/* 摘要 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="summary">摘要</Label>
              <Textarea
                id="summary"
                value={formData.summary}
                onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
                placeholder="请输入会议摘要"
                rows={3}
              />
            </div>

            {/* 关键点 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="key_points">关键点</Label>
              <Textarea
                id="key_points"
                value={formData.key_points}
                onChange={(e) => setFormData(prev => ({ ...prev, key_points: e.target.value }))}
                placeholder="请输入会议关键点"
                rows={3}
              />
            </div>

            {/* 行动项 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="action_items">行动项</Label>
              <Textarea
                id="action_items"
                value={formData.action_items}
                onChange={(e) => setFormData(prev => ({ ...prev, action_items: e.target.value }))}
                placeholder="请输入行动项"
                rows={3}
              />
            </div>

            {/* 状态 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="status">状态</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="published">已发布</SelectItem>
                  <SelectItem value="archived">已归档</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </form>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMinutesMutation.isPending || updateMinutesMutation.isPending}
            >
              {createMinutesMutation.isPending || updateMinutesMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 