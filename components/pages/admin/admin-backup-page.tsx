'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backupApi } from '@/lib/api';
import { BackupInfo } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Database, 
  Plus, 
  MoreHorizontal, 
  Download, 
  Trash2, 
  Eye,
  Loader2,
  HardDrive,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  History,
  AlertCircle,
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
  const [logsPage, setLogsPage] = useState(1);
  const [logsFilter, setLogsFilter] = useState({ operation: '', status: '' });
  const [createForm, setCreateForm] = useState({
    format: 'sql' as 'sql',
    description: ''
  });

  // 获取备份列表
  const { data: backupList, isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: backupApi.getBackupList,
  });

  // 获取操作日志
  const { data: logsData, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['backup-logs', logsPage, logsFilter],
    queryFn: () => backupApi.getBackupLogs({
      page: logsPage,
      page_size: 10,
      operation: logsFilter.operation || undefined,
      status: logsFilter.status || undefined,
    }),
    enabled: activeTab === 'logs',
  });

  // 创建备份
  const createBackupMutation = useMutation({
    mutationFn: backupApi.createBackup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['backup-logs'] });
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
      queryClient.invalidateQueries({ queryKey: ['backup-logs'] });
      setIsDeleteDialogOpen(false);
      setSelectedBackup(null);
      toast.success('备份删除成功');
    },
    onError: (error: any) => {
      toast.error(error.message || '备份删除失败');
    },
  });

  // 清理日志
  const clearLogsMutation = useMutation({
    mutationFn: (days: number) => backupApi.deleteBackupLogs(days),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['backup-logs'] });
      toast.success(`已清理 ${data.deleted_count} 条日志记录`);
    },
    onError: (error: any) => {
      toast.error(error.message || '清理日志失败');
    },
  });

  // 还原数据
  const restoreDataMutation = useMutation({
    mutationFn: backupApi.restoreData,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['backup-logs'] });
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

  const handleClearLogs = (days: number) => {
    Confirm({
      title: '确认清理日志',
      message: `确定要清理 ${days} 天前的操作日志吗？此操作不可撤销。`,
      onConfirm: () => {
        clearLogsMutation.mutate(days);
      }
    });
  };

  const handleRestoreBackup = (backup: BackupInfo) => {
    setSelectedBackup(backup);
    setIsRestoreDialogOpen(true);
  };

  const handleConfirmRestore = () => {
    if (selectedBackup) {
      restoreDataMutation.mutate({
        filename: selectedBackup.filename,
        backup_before: true,
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

  const getLogStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            成功
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            失败
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            进行中
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <AlertCircle className="w-3 h-3 mr-1" />
            未知
          </Badge>
        );
    }
  };

  const getOperationBadge = (operation: string) => {
    switch (operation) {
      case 'backup':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-200">
            <Database className="w-3 h-3 mr-1" />
            备份
          </Badge>
        );
      case 'restore':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-200">
            <RotateCcw className="w-3 h-3 mr-1" />
            还原
          </Badge>
        );
      case 'delete':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900 dark:text-red-200">
            <Trash2 className="w-3 h-3 mr-1" />
            删除
          </Badge>
        );
      case 'download':
        return (
          <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900 dark:text-cyan-200">
            <Download className="w-3 h-3 mr-1" />
            下载
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <AlertCircle className="w-3 h-3 mr-1" />
            {operation}
          </Badge>
        );
    }
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="backups" className="flex items-center space-x-2">
            <Database className="w-4 h-4" />
            <span>备份文件</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center space-x-2">
            <History className="w-4 h-4" />
            <span>操作日志</span>
          </TabsTrigger>
        </TabsList>

        {/* 备份文件标签页 */}
        <TabsContent value="backups" className="space-y-6">
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
        </TabsContent>

        {/* 操作日志标签页 */}
        <TabsContent value="logs" className="space-y-6">
          {/* 日志过滤器 */}
          <Card>
            <CardHeader>
              <CardTitle>日志过滤</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-4 items-end">
                <div className="flex-1">
                  <Label htmlFor="operation-filter">操作类型</Label>
                  <Select
                    value={logsFilter.operation}
                    onValueChange={(value) => setLogsFilter({ ...logsFilter, operation: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="全部操作" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部操作</SelectItem>
                      <SelectItem value="backup">备份</SelectItem>
                      <SelectItem value="restore">还原</SelectItem>
                      <SelectItem value="delete">删除</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label htmlFor="status-filter">状态</Label>
                  <Select
                    value={logsFilter.status}
                    onValueChange={(value) => setLogsFilter({ ...logsFilter, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="全部状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部状态</SelectItem>
                      <SelectItem value="success">成功</SelectItem>
                      <SelectItem value="failed">失败</SelectItem>
                      <SelectItem value="in_progress">进行中</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setLogsFilter({ operation: '', status: '' })}
                  >
                    重置
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleClearLogs(30)}
                    disabled={clearLogsMutation.isPending}
                  >
                    {clearLogsMutation.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    清理30天前日志
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 操作日志列表 */}
          <Card>
            <CardHeader>
              <CardTitle>操作日志</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : logsData?.logs?.length === 0 ? (
                <div className="text-center py-8">
                  <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">暂无操作日志</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>操作类型</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>文件名</TableHead>
                        <TableHead>描述</TableHead>
                        <TableHead>操作时间</TableHead>
                        <TableHead>耗时</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logsData?.logs?.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {getOperationBadge(log.operation)}
                          </TableCell>
                          <TableCell>
                            {getLogStatusBadge(log.status)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {log.filename || '-'}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {log.description || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                          </TableCell>
                          <TableCell>
                            {log.duration ? `${log.duration}ms` : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* 分页 */}
                  {logsData && logsData.total_pages > 1 && (
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-500">
                        共 {logsData.total} 条记录，第 {logsData.page} / {logsData.total_pages} 页
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLogsPage(Math.max(1, logsPage - 1))}
                          disabled={logsPage <= 1}
                        >
                          上一页
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLogsPage(Math.min(logsData.total_pages, logsPage + 1))}
                          disabled={logsPage >= logsData.total_pages}
                        >
                          下一页
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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