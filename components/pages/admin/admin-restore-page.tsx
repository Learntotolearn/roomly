'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { backupApi } from '@/lib/api';
import { BackupInfo, RestoreRequest } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  ArrowLeft, 
  AlertTriangle, 
  CheckCircle, 
  FileText,
  Loader2,
  RotateCcw,
  Shield,
  Clock,
  Users,
  Building
} from 'lucide-react';
import { format } from 'date-fns';
import { useAppContext } from '@/lib/context/app-context';
import { toast } from 'sonner';

function AdminRestorePage() {
  const { Confirm } = useAppContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);
  const [restoreForm, setRestoreForm] = useState<RestoreRequest>({
    filename: '',
    backup_before: true,
    description: ''
  });
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // 从URL参数获取预选的备份文件
  const preselectedFilename = searchParams.get('filename');

  // 获取备份列表
  const { data: backupList, isLoading: isLoadingBackups } = useQuery({
    queryKey: ['backups'],
    queryFn: backupApi.getBackupList,
  });

  // 获取还原预览
  const { data: restorePreview, isLoading: isLoadingPreview } = useQuery({
    queryKey: ['restore-preview', selectedBackup?.filename],
    queryFn: () => backupApi.getRestorePreview(selectedBackup!.filename),
    enabled: !!selectedBackup,
  });

  // 还原数据
  const restoreDataMutation = useMutation({
    mutationFn: backupApi.restoreData,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
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

  // 初始化预选备份
  useEffect(() => {
    if (preselectedFilename && backupList?.backups) {
      const backup = backupList.backups.find((b: BackupInfo) => b.filename === preselectedFilename);
      if (backup) {
        setSelectedBackup(backup);
        setRestoreForm(prev => ({ ...prev, filename: backup.filename }));
        setCurrentStep(2);
      }
    }
  }, [preselectedFilename, backupList]);

  const handleBackupSelect = (backup: BackupInfo) => {
    setSelectedBackup(backup);
    setRestoreForm(prev => ({ ...prev, filename: backup.filename }));
    setCurrentStep(2);
  };

  const handleNextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleConfirmRestore = () => {
    if (confirmText === 'RESTORE') {
      restoreDataMutation.mutate(restoreForm);
      setIsConfirmDialogOpen(false);
      setConfirmText('');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFormatBadge = (format: string) => {
    return format === 'json' ? (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-200">
        <FileText className="w-3 h-3 mr-1" />
        JSON
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900 dark:text-purple-200">
        <Database className="w-3 h-3 mr-1" />
        SQL
      </Badge>
    );
  };

  const steps = [
    { number: 1, title: '选择备份', description: '选择要还原的备份文件' },
    { number: 2, title: '还原选项', description: '配置还原参数' },
    { number: 3, title: '确认执行', description: '确认还原操作' },
  ];

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/admin/backup')}
            className="flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回备份管理
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">数据还原</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              从备份文件还原系统数据
            </p>
          </div>
        </div>
      </div>

      {/* 步骤指示器 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  currentStep >= step.number
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-300 text-gray-400'
                }`}>
                  {currentStep > step.number ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    step.number
                  )}
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${
                    currentStep >= step.number ? 'text-blue-600' : 'text-gray-400'
                  }`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-500">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 mx-4 ${
                    currentStep > step.number ? 'bg-blue-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 步骤内容 */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>选择备份文件</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingBackups ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : backupList?.backups?.length === 0 ? (
              <div className="text-center py-8">
                <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">暂无可用的备份文件</p>
                <Button
                  onClick={() => router.push('/admin/backup')}
                  className="mt-4"
                >
                  创建备份
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {backupList?.backups?.map((backup: BackupInfo) => (
                  <Card
                    key={backup.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedBackup?.id === backup.id
                        ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : ''
                    }`}
                    onClick={() => handleBackupSelect(backup)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-medium text-sm truncate" title={backup.filename}>
                            {backup.filename}
                          </h3>
                          {backup.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {backup.description}
                            </p>
                          )}
                        </div>
                        {getFormatBadge(backup.format)}
                      </div>
                      <div className="space-y-2 text-xs text-gray-500">
                        <div className="flex items-center justify-between">
                          <span>大小</span>
                          <span>{formatFileSize(backup.size)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>创建时间</span>
                          <span>{format(new Date(backup.created_at), 'MM-dd HH:mm')}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>创建者</span>
                          <span>{backup.created_by}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>状态</span>
                          <Badge variant={backup.is_valid ? "default" : "destructive"} className="text-xs">
                            {backup.is_valid ? '有效' : '无效'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {selectedBackup && (
              <div className="flex justify-end mt-6">
                <Button onClick={handleNextStep}>
                  下一步
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {currentStep === 2 && selectedBackup && (
        <Card>
          <CardHeader>
            <CardTitle>还原选项</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 选中的备份信息 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h3 className="font-medium mb-2">选中的备份文件</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{selectedBackup.filename}</p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(selectedBackup.created_at), 'yyyy-MM-dd HH:mm:ss')} · {formatFileSize(selectedBackup.size)}
                  </p>
                </div>
                {getFormatBadge(selectedBackup.format)}
              </div>
            </div>

            {/* 还原前备份选项 */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Shield className="w-5 h-5 text-blue-600" />
                <div>
                  <Label className="text-sm font-medium">还原前备份当前数据</Label>
                  <p className="text-xs text-gray-500 mt-1">
                    推荐开启，在还原前自动备份当前数据以防意外
                  </p>
                </div>
              </div>
              <Switch
                checked={restoreForm.backup_before}
                onCheckedChange={(checked) => 
                  setRestoreForm(prev => ({ ...prev, backup_before: checked }))
                }
              />
            </div>

            {/* 还原描述 */}
            <div>
              <Label htmlFor="description">还原描述（可选）</Label>
              <Textarea
                id="description"
                placeholder="请输入还原操作的描述..."
                value={restoreForm.description}
                onChange={(e) => setRestoreForm(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1"
              />
            </div>

            {/* 数据预览 */}
            {isLoadingPreview ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="text-sm text-gray-500">加载预览数据...</span>
              </div>
            ) : restorePreview && (
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-3">数据预览</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">备份数据</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          会员
                        </span>
                        <span>{restorePreview.backup_data.members_count || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center">
                          <Building className="w-4 h-4 mr-1" />
                          会议室
                        </span>
                        <span>{restorePreview.backup_data.rooms_count || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          预订记录
                        </span>
                        <span>{restorePreview.backup_data.bookings_count || 0}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">当前数据</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          会员
                        </span>
                        <span>{restorePreview.current_data.members_count || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center">
                          <Building className="w-4 h-4 mr-1" />
                          会议室
                        </span>
                        <span>{restorePreview.current_data.rooms_count || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          预订记录
                        </span>
                        <span>{restorePreview.current_data.bookings_count || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={handlePrevStep}>
                上一步
              </Button>
              <Button onClick={handleNextStep}>
                下一步
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 3 && selectedBackup && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-orange-600">
              <AlertTriangle className="w-5 h-5 mr-2" />
              确认还原操作
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 警告信息 */}
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-orange-800 dark:text-orange-200">重要提醒</h3>
                  <ul className="mt-2 text-sm text-orange-700 dark:text-orange-300 space-y-1">
                    <li>• 此操作将完全替换当前系统中的所有数据</li>
                    <li>• 所有现有的会员、会议室、预订记录都将被删除</li>
                    <li>• 还原过程中请勿关闭浏览器或刷新页面</li>
                    <li>• 建议在系统使用较少的时间进行还原操作</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 还原摘要 */}
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-3">还原摘要</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>备份文件：</span>
                  <span className="font-medium">{selectedBackup.filename}</span>
                </div>
                <div className="flex justify-between">
                  <span>备份时间：</span>
                  <span>{format(new Date(selectedBackup.created_at), 'yyyy-MM-dd HH:mm:ss')}</span>
                </div>
                <div className="flex justify-between">
                  <span>还原前备份：</span>
                  <span className={restoreForm.backup_before ? 'text-green-600' : 'text-red-600'}>
                    {restoreForm.backup_before ? '是' : '否'}
                  </span>
                </div>
                {restoreForm.description && (
                  <div className="flex justify-between">
                    <span>操作描述：</span>
                    <span className="max-w-xs truncate">{restoreForm.description}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handlePrevStep}>
                上一步
              </Button>
              <Button
                onClick={() => setIsConfirmDialogOpen(true)}
                className="bg-red-600 hover:bg-red-700"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                执行还原
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 确认对话框 */}
      <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-red-600">
              <AlertTriangle className="w-5 h-5 mr-2" />
              最终确认
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>您即将执行数据还原操作，这将：</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>删除所有当前数据</li>
                <li>从备份文件还原数据</li>
                <li>此操作不可撤销</li>
              </ul>
              <div className="mt-4">
                <Label htmlFor="confirm-text" className="text-sm font-medium">
                  请输入 <span className="font-bold text-red-600">RESTORE</span> 确认操作：
                </Label>
                <Input
                  id="confirm-text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="输入 RESTORE"
                  className="mt-1"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRestore}
              disabled={confirmText !== 'RESTORE' || restoreDataMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {restoreDataMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {restoreDataMutation.isPending ? '正在还原...' : '确认还原'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AdminRestorePage;