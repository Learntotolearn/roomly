'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { Mic, Square, Play, Download, Loader2, AlertCircle } from 'lucide-react';
// 简单的Alert组件
const Alert = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
    {children}
  </div>
);

const AlertDescription = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-red-600">{children}</p>
);

interface AudioRecorderV2Props {
  onRecordingComplete: (audioBlob: Blob) => void;
  isProcessing?: boolean;
}

export default function AudioRecorderV2({ onRecordingComplete, isProcessing = false }: AudioRecorderV2Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioURL, setAudioURL] = useState<string>('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string>('');
  const [isSupported, setIsSupported] = useState(true);
  const [actualMimeType, setActualMimeType] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 检查浏览器支持
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsSupported(false);
      setError('您的浏览器不支持录音功能');
      return;
    }

    if (!window.MediaRecorder) {
      setIsSupported(false);
      setError('您的浏览器不支持MediaRecorder API');
      return;
    }

    // 检查是否在安全上下文中
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      setError('录音功能需要HTTPS环境或localhost');
    }
  }, []);

  // 获取最佳音频格式
  const getBestAudioFormat = useCallback(() => {
    // 你可以在这里调整格式优先级
    const formats = [
      'audio/mp4',           // 优先使用MP4
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus'
    ];

    for (const format of formats) {
      if (MediaRecorder.isTypeSupported(format)) {
        return format;
      }
    }

    return '';
  }, []);

  // 开始录音
  const startRecording = useCallback(async () => {
    try {
      setError('');

      // 获取音频流 - 恢复标准配置
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        }
      });

      streamRef.current = stream;

      // 创建MediaRecorder - 使用最佳格式
      const format = getBestAudioFormat();
      const options = format ? { mimeType: format } : {};
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // 设置事件处理器
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        } else {
          // console.warn('收到空数据块'); // 删除调试
        }
      };

      mediaRecorder.onstop = () => {
        try {
          if (audioChunksRef.current.length === 0) {
            throw new Error('没有录到音频数据');
          }

          // 获取实际使用的MIME类型
          const mimeType = mediaRecorder.mimeType || 'audio/webm';
          setActualMimeType(mimeType);

          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

          if (audioBlob.size === 0) {
            throw new Error('录音文件为空');
          }

          // 创建音频URL
          const url = URL.createObjectURL(audioBlob);
          setAudioURL(url);
          onRecordingComplete(audioBlob);
          
        } catch (error) {
          setError(`录音失败: ${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
          // 清理资源
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
        }
      };

      mediaRecorder.onerror = (event) => {
        setError('录音过程中发生错误');
      };

      // 开始录音
      mediaRecorder.start(500); // 每500毫秒收集一次数据
      setIsRecording(true);
      setRecordingTime(0);

      // 开始计时
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      let errorMessage = '录音启动失败';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = '麦克风权限被拒绝，请在浏览器设置中允许麦克风访问';
        } else if (error.name === 'NotFoundError') {
          errorMessage = '未找到麦克风设备';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = '当前环境不支持录音功能';
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
    }
  }, [getBestAudioFormat, onRecordingComplete]);

  // 停止录音
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  // 播放录音 - 使用AudioContext方式
  const playRecording = useCallback(() => {
    if (audioURL) {
      
      // 从Blob URL获取音频数据
      fetch(audioURL)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => {
          // 创建AudioContext
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          
          // 解码音频数据
          audioContext.decodeAudioData(arrayBuffer)
            .then(audioBuffer => {
              
              // 创建音频源
              const source = audioContext.createBufferSource();
              source.buffer = audioBuffer;
              
              // 创建增益节点控制音量
              const gainNode = audioContext.createGain();
              gainNode.gain.value = 1.0;
              
              // 连接音频节点
              source.connect(gainNode);
              gainNode.connect(audioContext.destination);
              
              // 开始播放
              source.start(0);
              setIsPlaying(true);
              
              // 播放结束后更新状态
              source.onended = () => {
                setIsPlaying(false);
                audioContext.close();
              };
            })
            .catch(error => {
              setError('音频解码失败');
            });
        })
        .catch(error => {
          setError('获取音频数据失败');
        });
    } else {
      setError('播放失败: audioURL不存在');
    }
  }, [audioURL]);

  // 停止播放
  const stopPlaying = useCallback(() => {
    // 对于AudioContext播放，我们无法直接停止，只能等待播放结束
    // 这里我们只更新UI状态
    setIsPlaying(false);
  }, []);

  // 下载录音
  const downloadAudio = useCallback(() => {
    if (audioURL) {
      const a = document.createElement('a');
      a.href = audioURL;
      
      // 使用保存的实际MIME类型
      let extension = 'webm'; // 默认
      if (actualMimeType) {
        
        if (actualMimeType.includes('mp4')) {
          extension = 'mp4';
        } else if (actualMimeType.includes('webm')) {
          extension = 'webm';
        } else if (actualMimeType.includes('ogg')) {
          extension = 'ogg';
        }
      }
      
      a.download = `recording-${new Date().toISOString().slice(0, 19)}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [audioURL, actualMimeType]);

  // 格式化时间
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // 测试音频格式支持
  const testAudioFormats = useCallback(() => {
    const audioElement = document.createElement('audio');
    const formats = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/wav'
    ];
    
    formats.forEach(format => {
      const canPlay = audioElement.canPlayType(format);
    });
    
    // 测试当前录音格式
    if (actualMimeType) {
    }
  }, [actualMimeType]);

  // 清理资源
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioURL) {
        URL.revokeObjectURL(audioURL);
      }
    };
  }, [audioURL]);

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Mic className="w-5 h-5 mr-2" />
            语音录制
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Mic className="w-5 h-5 mr-2" />
          语音录制
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 错误提示 */}
        {error && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 录音控制 */}
        <div className="flex items-center justify-center space-x-4">
          {!isRecording ? (
            <Button
              onClick={startRecording}
              disabled={isProcessing}
              className="bg-red-500 hover:bg-red-600"
            >
              <Mic className="w-4 h-4 mr-2" />
              开始录音
            </Button>
          ) : (
            <Button
              onClick={stopRecording}
              variant="destructive"
            >
              <Square className="w-4 h-4 mr-2" />
              停止录音
            </Button>
          )}

          {isProcessing && (
            <div className="flex items-center">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              <span className="text-sm text-gray-600">处理中...</span>
            </div>
          )}
          
        </div>

        {/* 录音时间显示 */}
        {isRecording && (
          <div className="text-center">
            <Badge variant="secondary">
              录音时间: {formatTime(recordingTime)}
            </Badge>
          </div>
        )}

        {/* 录音播放控制 */}
        {audioURL && !isRecording && (
          <div className="space-y-2">
            <div className="flex items-center justify-center space-x-2">
              {!isPlaying ? (
                <Button onClick={playRecording} variant="outline" size="sm">
                  <Play className="w-4 h-4 mr-2" />
                  播放
                </Button>
              ) : (
                <Button onClick={stopPlaying} variant="outline" size="sm">
                  <Square className="w-4 h-4 mr-2" />
                  停止
                </Button>
              )}

              <Button onClick={downloadAudio} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                下载
              </Button>
              
              <Button onClick={testAudioFormats} variant="outline" size="sm">
                <AlertCircle className="w-4 h-4 mr-2" />
                测试格式
              </Button>
            </div>

            {/* 格式信息 */}
            {actualMimeType && (
              <div className="text-center text-sm text-gray-500">
                录音格式: {actualMimeType}
              </div>
            )}
          </div>
        )}

        {/* 提示信息 */}
        <div className="text-sm text-gray-500 text-center">
          {!isRecording && !audioURL && "点击开始录音按钮开始录制会议音频"}
          {isRecording && "正在录音中，请说话..."}
          {audioURL && !isRecording && "录音完成，可以播放或下载音频文件"}
        </div>
      </CardContent>
    </Card>
  );
} 