'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backupApi } from '@/lib/api';
import { BackupInfo } from '@/lib/types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { 
  Database, 
  Plus, 
  MoreHorizontal, 
  Download, 
  Trash2, 
  Loader2,
  HardDrive,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';
import { useAppContext } from '@/lib/context/app-context';
import { toast } from 'sonner';

export default function AdminBackupPage() {
  const { Confirm } = useAppContext();
  const queryClient = useQueryClient();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);
  const [activeTab, setActiveTab] = useState('backups');
  const [createForm, setCreateForm] = useState({
    format: 'sql' as 'sql',
    description: ''
  });

  // 获取备份列表
  const { data: backupList, isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: backupApi.getBackupList,
  });



  // 创建备份
  const createBackupMutation = useMutation({
    mutationFn: backupApi.createBackup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      setIsCreateDialogOpen(false);
      setCreateForm({ format: 'sql', description: '' });
      toast.success('备份创建成功');
    },
    onError: (error: any) => {
      toast.error(error.message || '备份创建失败');
    },
  });

  // 删除备份
  const deleteBackupMutation = useMutation({
    mutationFn: (filename: string) => backupApi.deleteBackup(filename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      setIsDeleteDialogOpen(false);
      setSelectedBackup(null);
      toast.success('备份删除成功');
    },
    onError: (error: any) => {
      toast.error(error.message || '备份删除失败');
    },
  });



  // 还原数据
  const restoreDataMutation = useMutation({
    mutationFn: backupApi.restoreData,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      setIsRestoreDialogOpen(false);
      setSelectedBackup(null);
      toast.success('数据还原成功！页面将自动刷新以显示最新数据。');
      
      // 延迟刷新页面，让用户看到成功提示
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    },
    onError: (error: any) => {
      toast.error(error.message || '数据还原失败');
    },
  });

  const handleCreateBackup = () => {
    createBackupMutation.mutate(createForm);
  };

  const handleDeleteBackup = () => {
    if (selectedBackup) {
      deleteBackupMutation.mutate(selectedBackup.filename);
    }
  };

  const handleDownloadBackup = async (filename: string) => {
    try {
      const blob = await backupApi.downloadBackup(filename);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('备份文件下载成功');
    } catch (error: any) {
      toast.error(error.message || '下载失败');
    }
  };



  const handleRestoreBackup = (backup: BackupInfo) => {
    setSelectedBackup(backup);
    setIsRestoreDialogOpen(true);
  };

  const handleConfirmRestore = () => {
    if (selectedBackup) {
      restoreDataMutation.mutate({
        filename: selectedBackup.filename,
        description: `从备份文件 ${selectedBackup.filename} 还原数据`
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusBadge = (isValid: boolean) => {
    return isValid ? (
      <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        <CheckCircle className="w-3 h-3 mr-1" />
        有效
      </Badge>
    ) : (
      <Badge variant="destructive">
        <XCircle className="w-3 h-3 mr-1" />
        无效
      </Badge>
    );
  };

  const getFormatBadge = (format: string) => {
    return (
      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900 dark:text-purple-200">
        <Database className="w-3 h-3 mr-1" />
        SQL
      </Badge>
    );
  };



  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">数据备份管理</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            管理系统数据备份，确保数据安全
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              立即备份
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建数据备份</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="format">备份格式</Label>
                <div className="mt-2">
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900 dark:text-purple-200">
                    <Database className="w-3 h-3 mr-1" />
                    SQL格式（统一格式）
                  </Badge>
                </div>
              </div>
              <div>
                <Label htmlFor="description">备份描述（可选）</Label>
                <Textarea
                  id="description"
                  placeholder="请输入备份描述..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={createBackupMutation.isPending}
                >
                  取消
                </Button>
                <Button
                  onClick={handleCreateBackup}
                  disabled={createBackupMutation.isPending}
                >
                  {createBackupMutation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  创建备份
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 标签页 */}
      <div className="w-full">

        {/* 备份文件内容 */}
        <div className="space-y-6">
          {/* 存储状态卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">备份文件数量</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{backupList?.total || 0}</div>
                <p className="text-xs text-muted-foreground">
                  个备份文件
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总存储大小</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {backupList?.backups ? 
                    formatFileSize(backupList.backups.reduce((sum, backup) => sum + backup.size, 0)) : 
                    '0 B'
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  已使用存储空间
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">最新备份</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {backupList?.backups && backupList.backups.length > 0 ? 
                    format(new Date(backupList.backups[0].created_at), 'MM-dd HH:mm') : 
                    '无'
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  最后备份时间
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 备份文件列表 */}
          <Card>
            <CardHeader>
              <CardTitle>备份文件列表</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : backupList?.backups?.length === 0 ? (
                <div className="text-center py-8">
                  <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">暂无备份文件</p>
                  <p className="text-sm text-gray-400 mt-2">点击上方"立即备份"按钮创建第一个备份</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>文件名</TableHead>
                      <TableHead>格式</TableHead>
                      <TableHead>大小</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead>描述</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {backupList?.backups?.map((backup) => (
                      <TableRow key={backup.id}>
                        <TableCell className="font-medium">
                          {backup.filename}
                        </TableCell>
                        <TableCell>
                          {getFormatBadge(backup.format)}
                        </TableCell>
                        <TableCell>{formatFileSize(backup.size)}</TableCell>
                        <TableCell>
                          {getStatusBadge(backup.is_valid)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(backup.created_at), 'yyyy-MM-dd HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {backup.description || '无描述'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={() => handleDownloadBackup(backup.filename)}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20"
                              >
                                <Download className="mr-2 h-4 w-4" />
                                下载
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleRestoreBackup(backup)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-900/20"
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                还原
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedBackup(backup);
                                  setIsDeleteDialogOpen(true);
                                }}
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
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 还原确认对话框 */}
      <AlertDialog open={isRestoreDialogOpen} onOpenChange={setIsRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认还原数据</AlertDialogTitle>
            <AlertDialogDescription>
              您即将从备份文件 "{selectedBackup?.filename}" 还原数据，这将：
            </AlertDialogDescription>
            <div className="space-y-3">
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>删除所有当前数据（会员、会议室、预订记录等）</li>
                <li>从备份文件还原数据到系统中</li>
                <li>在还原前自动备份当前数据以防意外</li>
                <li>此操作不可撤销，请谨慎操作</li>
              </ul>
              <p className="text-red-600 font-medium text-sm">
                建议在系统使用较少的时间进行还原操作！
              </p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRestore}
              className="bg-red-600 hover:bg-red-700"
              disabled={restoreDataMutation.isPending}
            >
              {restoreDataMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {restoreDataMutation.isPending ? '正在还原...' : '确认还原'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除备份</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除备份文件 "{selectedBackup?.filename}" 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBackup}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteBackupMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}