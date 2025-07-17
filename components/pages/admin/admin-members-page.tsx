'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { memberApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Users, 
  Loader2,
  RefreshCcw,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation } from '@tanstack/react-query';
import { useAppContext } from '@/lib/context/app-context';
import type { Member } from '@/lib/types';

// 防抖hook
function useDebounce<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function AdminMembersPage() {
  const queryClient = useQueryClient();
  const { Alert } = useAppContext();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  // 新增：防抖search
  const debouncedSearch = useDebounce(search, 500);
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 后端分页、搜索、角色过滤
  const { data: membersRes, isLoading, error } = useQuery<{ data: Member[]; total: number }>({
    queryKey: ['members', page, pageSize, debouncedSearch, roleFilter],
    queryFn: () => memberApi.getAll({ page, page_size: pageSize, search: debouncedSearch, role: roleFilter }),
  });
  const members: Member[] = membersRes?.data || [];
  const total: number = membersRes?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  // 设置/取消会议室管理员
  const setRoomAdminMutation = useMutation({
    mutationFn: async ({ id, isRoomAdmin }: { id: number; isRoomAdmin: boolean }) => {
      const res = await memberApi.setRoomAdminPermission(id, isRoomAdmin);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      Alert('操作成功');
    },
    onError: (error) => {
      Alert('操作失败');
      console.error('设置会议室管理员失败', error);
    },
  });

  // 翻页
  const handlePrev = () => setPage((p) => Math.max(1, p - 1));
  const handleNext = () => setPage((p) => Math.min(totalPages, p + 1));

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
        <p className="text-gray-600 dark:text-white">无法加载会员信息，请检查网络连接</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">会员管理</h1>
          <p className="text-gray-600 dark:text-white">管理系统中的所有会员信息</p>
        </div>
        <Button disabled={isRefreshing} onClick={async () => {
            setIsRefreshing(true);
            await queryClient.invalidateQueries({ queryKey: ['members'] });
            await new Promise(resolve => setTimeout(resolve, 300));
            setIsRefreshing(false);
          }}>
          {isRefreshing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCcw className="w-4 h-4 mr-2" />
          )}
          刷新
        </Button>
      </div>
      {/* 筛选卡片和刷新按钮 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="w-5 h-5 mr-2" />
                筛选
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 2xl:gap-8">
                <div className="flex flex-col gap-2">
                  <label htmlFor="search">搜索</label>
                  <Input
                    id="search"
                    placeholder="搜索姓名或ID"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="role">角色</label>
                  <Select value={roleFilter} onValueChange={v => { setRoleFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="筛选角色" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="admin">系统管理员</SelectItem>
                      <SelectItem value="room_admin">会议室管理员</SelectItem>
                      <SelectItem value="user">普通用户</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            会员列表 ({total})
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
              {members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    <div className="flex items-center justify-center">
                      <p className="text-gray-500 py-4">暂无数据</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>{member.id}</TableCell>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>
                    {member.is_admin && <Badge>系统管理员</Badge>}
                    {member.is_room_admin && <Badge variant="secondary">会议室管理员</Badge>}
                    {!member.is_admin && !member.is_room_admin && <Badge variant="outline">普通用户</Badge>}
                  </TableCell>
                  <TableCell>
                    {format(new Date(member.created_at), 'yyyy-MM-dd HH:mm')}
                  </TableCell>
                  <TableCell>
                    {/* 会议室管理员操作按钮 */}
                    <Button
                      size="sm"
                      variant={member.is_room_admin ? "outline" : "default"}
                      onClick={() => setRoomAdminMutation.mutate({ id: member.id, isRoomAdmin: !member.is_room_admin })}
                      disabled={setRoomAdminMutation.isPending}
                      className="h-8 px-3 py-2 text-xs rounded-md"
                    >
                      {member.is_room_admin ? "取消会议室管理员" : "设为会议室管理员"}
                    </Button>
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
          <Button size="sm" variant="outline" onClick={handlePrev} disabled={page === 1}>上一页</Button>
          <Button size="sm" variant="outline" onClick={handleNext} disabled={page === totalPages || totalPages === 0}>下一页</Button>
        </div>
      </div>
    </div>
  );
} 