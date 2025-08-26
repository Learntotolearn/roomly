'use client';

import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '@/lib/context/app-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  FileText, 
  Calendar, 
  Clock, 
  MapPin, 
  Users,
  Edit,
  Eye,
  Trash2,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useState } from 'react';
import { bookingApi } from '@/lib/api';
import { Booking } from '@/lib/types';
import { toast } from 'sonner';

function MeetingSummariesContent() {
  const { currentMember } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');

  // 获取所有预定记录（包含会议纪要）
  const { data: bookingsData, isLoading, refetch } = useQuery({
    queryKey: ['all-bookings-with-summaries'],
    queryFn: async () => {
      const response = await bookingApi.getAll({ page: 1, page_size: 1000 });
      return response.data;
    },
    enabled: !!currentMember,
  });

  // 过滤有会议纪要的预定
  const summariesWithContent = bookingsData?.filter((booking: Booking) => 
    booking.summary_content && booking.summary_content.trim() !== ''
  ) || [];

  // 应用搜索和过滤
  const filteredSummaries = summariesWithContent.filter((booking: Booking) => {
    const matchesSearch = searchTerm === '' || 
      booking.room?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.member?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    const matchesRoom = roomFilter === 'all' || booking.room?.name === roomFilter;
    
    return matchesSearch && matchesStatus && matchesRoom;
  });

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'yyyy年MM月dd日');
    } catch {
      return dateStr;
    }
  };

  const formatTime = (start: string, end: string) => {
    return end === '00:00' ? `${start} - 24:00` : `${start} - ${end}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">有效</Badge>;
      case 'expired':
        return <Badge variant="secondary">已过期</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">已取消</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleViewSummary = (booking: Booking) => {
    toast.info('查看会议纪要功能开发中...');
  };

  const handleEditSummary = (booking: Booking) => {
    toast.info('编辑会议纪要功能开发中...');
  };

  const handleDeleteSummary = async (booking: Booking) => {
    if (!confirm('确定要删除这个会议纪要吗？')) return;
    
    try {
      await bookingApi.saveMeetingSummary(booking.id, '');
      toast.success('会议纪要已删除');
      refetch();
    } catch (error) {
      console.error('删除会议纪要失败:', error);
      toast.error('删除会议纪要失败，请稍后重试');
    }
  };

  // 获取唯一的会议室列表用于过滤
  const uniqueRooms = Array.from(new Set(
    summariesWithContent.map((booking: Booking) => booking.room?.name).filter(Boolean)
  ));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">会议纪要</h1>
        <p className="text-gray-600 dark:text-white">查看和管理所有会议纪要</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              会议纪要列表 ({filteredSummaries.length})
            </span>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              刷新
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="搜索会议室、会议主题或发起人..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="active">有效</SelectItem>
                  <SelectItem value="expired">已过期</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                </SelectContent>
              </Select>
              <Select value={roomFilter} onValueChange={setRoomFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="会议室" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部会议室</SelectItem>
                  {uniqueRooms.map((roomName) => (
                    <SelectItem key={roomName} value={roomName}>
                      {roomName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 会议纪要列表 */}
          {filteredSummaries.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                {summariesWithContent.length === 0 
                  ? '暂无会议纪要，请先在"我的预定"中创建会议纪要' 
                  : '没有找到匹配的会议纪要'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSummaries.map((booking: Booking) => (
                <div key={booking.id} className="border border-border rounded-lg p-4 bg-card text-card-foreground hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
                        <div className="flex items-center -mr-1">
                          {getStatusBadge(booking.status)}
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
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        <div className="inline-flex items-center px-1 -mx-1 rounded cursor-pointer hover:bg-gray-100">
                          <strong>参会人员:</strong> {booking.booking_users?.length ? booking.booking_users.map(u => u.nickname).join(', ') : '-'}
                        </div>
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        <strong>会议主题:</strong> {booking.reason}
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        <strong>会议纪要预览:</strong>
                        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md max-h-20 overflow-hidden">
                          {booking.summary_content?.substring(0, 200)}...
                        </div>
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        预定时间: {format(parseISO(booking.created_at), 'yyyy-MM-dd HH:mm')}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewSummary(booking)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        查看
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditSummary(booking)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        编辑
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteSummary(booking)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        删除
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import MainLayout from '@/components/layout/main-layout';

export default function MeetingSummariesPage() {
  return (
    <MainLayout>
      <MeetingSummariesContent />
    </MainLayout>
  );
}
