'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { memberApi } from '@/lib/api';
import { Member } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Users, 
  UserPlus, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Shield, 
  ShieldCheck, 
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';

export default function AdminMembersPage() {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    is_admin: false,
  });

  // 获取所有会员
  const { data: members, isLoading, error } = useQuery({
    queryKey: ['members'],
    queryFn: memberApi.getAll,
  });

  // 创建会员
  const createMemberMutation = useMutation({
    mutationFn: memberApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setIsAddDialogOpen(false);
      setFormData({ name: '', is_admin: false });
    },
  });

  // 更新会员
  const updateMemberMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Member> }) =>
      memberApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setIsEditDialogOpen(false);
      setSelectedMember(null);
      setFormData({ name: '', is_admin: false });
    },
  });

  // 删除会员
  const deleteMemberMutation = useMutation({
    mutationFn: memberApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });

  // 设置管理员权限
  const setAdminPermissionMutation = useMutation({
    mutationFn: ({ id, isAdmin }: { id: number; isAdmin: boolean }) =>
      memberApi.setAdminPermission(id, isAdmin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });

  // 处理添加会员
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim()) {
      createMemberMutation.mutate({
        name: formData.name.trim(),
        is_admin: formData.is_admin,
      });
    }
  };

  // 处理编辑会员
  const handleEditMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMember && formData.name.trim()) {
      updateMemberMutation.mutate({
        id: selectedMember.id,
        data: {
          name: formData.name.trim(),
          is_admin: formData.is_admin,
        },
      });
    }
  };

  // 处理删除会员
  const handleDeleteMember = (member: Member) => {
    if (window.confirm(`确定要删除会员 "${member.name}" 吗？`)) {
      deleteMemberMutation.mutate(member.id);
    }
  };

  // 处理权限切换
  const handleToggleAdmin = (member: Member) => {
    setAdminPermissionMutation.mutate({
      id: member.id,
      isAdmin: !member.is_admin,
    });
  };

  // 打开编辑对话框
  const openEditDialog = (member: Member) => {
    setSelectedMember(member);
    setFormData({
      name: member.name,
      is_admin: member.is_admin,
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
        <h2 className="text-2xl font-bold text-gray-900 mb-4">加载失败</h2>
        <p className="text-gray-600">无法加载会员信息，请检查网络连接</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">会员管理</h1>
          <p className="text-gray-600">管理系统中的所有会员信息</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              添加会员
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>添加新会员</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">姓名</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="请输入会员姓名"
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  id="is_admin"
                  type="checkbox"
                  checked={formData.is_admin}
                  onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked })}
                />
                <Label htmlFor="is_admin">设为管理员</Label>
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
                  disabled={createMemberMutation.isPending}
                >
                  {createMemberMutation.isPending ? '创建中...' : '创建会员'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            会员列表 ({members?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members?.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>{member.id}</TableCell>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>
                    <Badge variant={member.is_admin ? "default" : "secondary"}>
                      {member.is_admin ? "管理员" : "普通用户"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(member.created_at), 'yyyy-MM-dd HH:mm')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(member)}>
                          <Edit className="mr-2 h-4 w-4" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleAdmin(member)}>
                          {member.is_admin ? (
                            <>
                              <Shield className="mr-2 h-4 w-4" />
                              取消管理员
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="mr-2 h-4 w-4" />
                              设为管理员
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteMember(member)}
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

      {/* 编辑会员对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑会员</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditMember} className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-name">姓名</Label>
              <Input
                id="edit-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入会员姓名"
                required
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                id="edit-is_admin"
                type="checkbox"
                checked={formData.is_admin}
                onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked })}
              />
              <Label htmlFor="edit-is_admin">设为管理员</Label>
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
                disabled={updateMemberMutation.isPending}
              >
                {updateMemberMutation.isPending ? '更新中...' : '更新会员'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
} 