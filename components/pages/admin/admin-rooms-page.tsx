'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomApi } from '@/lib/api';
import { Room } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
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
  MapPin, 
  Plus, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff,
  Users,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { useAppContext } from '@/lib/context/app-context';

export default function AdminRoomsPage() {
  const { Confirm } = useAppContext();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    capacity: 6,
    is_open: true,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 获取所有会议室（分页）
  const { data: roomsRes, isLoading, error } = useQuery<{ data: Room[]; total: number }>({
    queryKey: ['rooms', page, pageSize],
    queryFn: () => roomApi.getAll({ page, page_size: pageSize }),
  });
  const rooms: Room[] = roomsRes?.data || [];
  const total: number = roomsRes?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  // 创建会议室
  const createRoomMutation = useMutation({
    mutationFn: roomApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setIsAddDialogOpen(false);
      setFormData({ name: '', description: '', capacity: 6, is_open: true });
    },
  });

  // 更新会议室
  const updateRoomMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Room> }) =>
      roomApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setIsEditDialogOpen(false);
      setSelectedRoom(null);
      setFormData({ name: '', description: '', capacity: 6, is_open: true });
    },
  });

  // 删除会议室
  const deleteRoomMutation = useMutation({
    mutationFn: roomApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });

  // 切换会议室状态
  const toggleRoomStatusMutation = useMutation({
    mutationFn: roomApi.toggleStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });

  // 处理添加会议室
  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim()) {
      createRoomMutation.mutate({
        name: formData.name.trim(),
        description: formData.description.trim(),
        capacity: formData.capacity,
        is_open: formData.is_open,
      });
    }
  };

  // 处理编辑会议室
  const handleEditRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRoom && formData.name.trim()) {
      updateRoomMutation.mutate({
        id: selectedRoom.id,
        data: {
          name: formData.name.trim(),
          description: formData.description.trim(),
          capacity: formData.capacity,
          is_open: formData.is_open,
        },
      });
    }
  };

  // 处理删除会议室
  const handleDeleteRoom = (room: Room) => {
    Confirm({
      title: '删除会议室',
      message: `确定要删除会议室 "${room.name}" 吗？`,
      onConfirm: () => {
        deleteRoomMutation.mutate(room.id);
      },
    });
  };

  // 处理状态切换
  const handleToggleStatus = (room: Room) => {
    toggleRoomStatusMutation.mutate(room.id);
  };

  // 打开编辑对话框
  const openEditDialog = (room: Room) => {
    setSelectedRoom(room);
    setFormData({
      name: room.name,
      description: room.description || '',
      capacity: room.capacity,
      is_open: room.is_open,
    });
    setIsEditDialogOpen(true);
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
        <p className="text-gray-600 dark:text-white">无法加载会议室信息，请检查网络连接</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">会议室管理</h1>
          <p className="text-gray-600 dark:text-white">管理系统中的所有会议室</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              添加会议室
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>添加新会议室</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddRoom} className="space-y-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">会议室名称</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="请输入会议室名称"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="description">描述</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="请输入会议室描述（可选）"
                  rows={3}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="capacity">容纳人数</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 6 })}
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_open"
                  checked={formData.is_open}
                  onCheckedChange={(checked: boolean) => setFormData({ ...formData, is_open: checked })}
                />
                <Label htmlFor="is_open">开放状态</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  取消
                </Button>
                <Button 
                  type="submit"
                  disabled={createRoomMutation.isPending}
                >
                  {createRoomMutation.isPending ? '创建中...' : '创建会议室'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MapPin className="w-5 h-5 mr-2" />
            会议室列表 ({total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>容纳人数</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    <div className="flex items-center justify-center">
                      <p className="text-gray-500 py-4">暂无数据</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {rooms.map((room) => (
                <TableRow key={room.id}>
                  <TableCell>{room.id}</TableCell>
                  <TableCell className="font-medium">{room.name}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {room.description || '无描述'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-1" />
                      {room.capacity}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={room.is_open ? "default" : "secondary"}>
                      {room.is_open ? "开放" : "关闭"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(room.created_at), 'yyyy-MM-dd HH:mm')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(room)}>
                          <Edit className="mr-2 h-4 w-4" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleStatus(room)}>
                          {room.is_open ? (
                            <>
                              <EyeOff className="mr-2 h-4 w-4" />
                              关闭
                            </>
                          ) : (
                            <>
                              <Eye className="mr-2 h-4 w-4" />
                              开放
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteRoom(room)}
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
      {/* 分页控件移到卡片外部 */}
      <div className="flex justify-between items-center mt-4">
        <div className="text-sm text-gray-500 dark:text-gray-300">
          第 {page} / {Math.max(1, totalPages)} 页，共 {total} 条
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
          <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages || 1, p + 1))} disabled={page >= totalPages}>下一页</Button>
        </div>
      </div>

      {/* 编辑会议室对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑会议室</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditRoom} className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-name">会议室名称</Label>
              <Input
                id="edit-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入会议室名称"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-description">描述</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="请输入会议室描述（可选）"
                rows={3}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-capacity">容纳人数</Label>
              <Input
                id="edit-capacity"
                type="number"
                min="1"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 6 })}
                required
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-is_open"
                checked={formData.is_open}
                onCheckedChange={(checked: boolean) => setFormData({ ...formData, is_open: checked })}
              />
              <Label htmlFor="edit-is_open">开放状态</Label>
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsEditDialogOpen(false)}
              >
                取消
              </Button>
              <Button 
                type="submit"
                disabled={updateRoomMutation.isPending}
              >
                {updateRoomMutation.isPending ? '更新中...' : '更新会议室'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
} 