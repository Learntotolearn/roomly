'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { speechApi, bookingApi } from '@/lib/api';
import type { SpeechToText, Booking } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Mic, 
  FileText, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Clock,
  Calendar,
  MapPin,
  User
} from 'lucide-react';
import AudioRecorderSimple from '@/components/ui/audio-recorder-simple';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format, parseISO } from 'date-fns';

export default function SpeechToTextPage() {
  const queryClient = useQueryClient();
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentSpeechId, setCurrentSpeechId] = useState<number | null>(null);
  const [streamingText, setStreamingText] = useState('');

  // 获取所有预定记录
  const { data: bookings } = useQuery({
    queryKey: ['bookings', 'all'],
    queryFn: () => bookingApi.getAll({ page_size: 1000 }),
  });

  // 处理语音转文字
  const processSpeechMutation = useMutation({
    mutationFn: speechApi.processSpeechToText,
    onSuccess: (data) => {
      setCurrentSpeechId(data.id);
      setIsProcessing(true);
      // 开始轮询状态
      startPolling(data.id);
    },
    onError: (error) => {
      setIsProcessing(false);
    },
  });

  // 轮询语音转文字状态
  const { data: speechStatus } = useQuery({
    queryKey: ['speech-status', currentSpeechId],
    queryFn: () => currentSpeechId ? speechApi.getStatus(currentSpeechId) : null,
    enabled: !!currentSpeechId && isProcessing,
    refetchInterval: isProcessing ? 2000 : false,
  });

  // 监听语音转文字状态变化
  useEffect(() => {
    if (speechStatus?.status === 'completed' || speechStatus?.status === 'failed') {
      setIsProcessing(false);
      // 不要立即重置currentSpeechId，让结果保持显示
      // setCurrentSpeechId(null);
      // 刷新会议纪要列表
      queryClient.invalidateQueries({ queryKey: ['minutes'] });
    }
  }, [speechStatus?.status, queryClient]);

  const startPolling = (speechId: number) => {
    setCurrentSpeechId(speechId);
  };

  const handleRecordingComplete = (blob: Blob) => {
    setAudioBlob(blob);
  };

  const handleProcessSpeech = async () => {
    if (!selectedBookingId || !audioBlob) {
      alert('请选择预定并录制音频');
      return;
    }

    try {
      // 将音频文件转换为base64
      const reader = new FileReader();
      reader.onload = () => {
        const base64Audio = reader.result as string;
        const audioData = base64Audio.split(',')[1]; // 移除data:audio/wav;base64,前缀

        processSpeechMutation.mutate({
          booking_id: selectedBookingId,
          audio_file: audioData,
        });
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      alert('处理音频失败，请稍后重试。');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'processing':
        return '处理中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '失败';
      default:
        return '未知';
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'processing':
        return 'secondary';
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">语音转文字</h1>
        <p className="text-gray-600 dark:text-white">录制会议音频并转换为文字，自动生成会议纪要</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：录音和设置 */}
        <div className="space-y-6">
          {/* 预定选择 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                选择预定
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="booking">选择要生成纪要的预定</Label>
                <Select 
                  value={selectedBookingId?.toString() || ''} 
                  onValueChange={(value) => setSelectedBookingId(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择预定" />
                  </SelectTrigger>
                  <SelectContent>
                    {bookings?.data?.map((booking: Booking) => (
                      <SelectItem key={booking.id} value={booking.id.toString()}>
                        <div className="flex items-center justify-between w-full">
                          <span>{booking.room?.name}</span>
                          <span className="text-sm text-gray-500 ml-2">
                            {booking.date} {booking.start_time}-{booking.end_time}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {selectedBookingId && bookings?.data && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 rounded-lg">
                    {(() => {
                      const booking = bookings.data.find(b => b.id === selectedBookingId);
                      if (!booking) return null;
                      
                      return (
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center text-blue-800 dark:text-blue-200">
                            <MapPin className="w-4 h-4 mr-2" />
                            {booking.room?.name}
                          </div>
                          <div className="flex items-center text-blue-700 dark:text-blue-300">
                            <Calendar className="w-4 h-4 mr-2" />
                            {booking.date} {booking.start_time} - {booking.end_time}
                          </div>
                          <div className="flex items-center text-blue-700 dark:text-blue-300">
                            <User className="w-4 h-4 mr-2" />
                            {booking.member?.name}
                          </div>
                          <div className="text-blue-600 dark:text-blue-400">
                            {booking.reason}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 音频录制 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                录音功能
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AudioRecorderSimple
                onRecordingComplete={handleRecordingComplete}
                onError={(error) => {
                  console.error('录音错误:', error);
                }}
              />
            </CardContent>
          </Card>

          {/* 处理按钮 */}
          <Card>
            <CardContent className="pt-6">
              <Button
                onClick={handleProcessSpeech}
                disabled={!selectedBookingId || !audioBlob || isProcessing}
                className="w-full"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    处理中...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    开始语音转文字
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：处理状态和结果 */}
        <div className="space-y-6">
          {/* 处理状态 */}
          {isProcessing && speechStatus && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  {getStatusIcon(speechStatus.status)}
                  <span className="ml-2">处理状态</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>状态:</span>
                    <Badge variant={getStatusVariant(speechStatus.status)}>
                      {getStatusText(speechStatus.status)}
                    </Badge>
                  </div>
                  
                  {speechStatus.status === 'processing' && (
                    <div className="text-center">
                      <div className="animate-pulse">
                        <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
                        <p className="text-sm text-gray-600">正在处理音频，请稍候...</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 转换结果 */}
          {speechStatus?.status === 'completed' && speechStatus.text && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  转换结果
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>识别文本</Label>
                    <Textarea
                      value={speechStatus.text}
                      readOnly
                      rows={10}
                      className="mt-2"
                    />
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(speechStatus.text);
                      }}
                      variant="outline"
                      size="sm"
                    >
                      复制文本
                    </Button>
                    
                    <Button
                      onClick={() => {
                        // 这里可以跳转到会议纪要页面，预填充内容
                        window.open('/minutes', '_blank');
                      }}
                      size="sm"
                    >
                      生成会议纪要
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 错误信息 */}
          {speechStatus?.status === 'failed' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-red-600">
                  <XCircle className="w-5 h-5 mr-2" />
                  处理失败
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-red-600">
                  语音转文字处理失败，请检查音频文件或稍后重试。
                </p>
              </CardContent>
            </Card>
          )}

          {/* 使用说明 */}
          <Card>
            <CardHeader>
              <CardTitle>使用说明</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-gray-600">
                <p>1. 选择要生成纪要的预定记录</p>
                <p>2. 点击"开始录音"按钮录制会议音频</p>
                <p>3. 录音完成后点击"开始语音转文字"</p>
                <p>4. 等待处理完成，查看转换结果</p>
                <p>5. 可以复制文本或直接生成会议纪要</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 