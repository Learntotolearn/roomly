'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Button } from './button';
import { Mic, Square, Play, Pause, Download } from 'lucide-react';
import { toast } from 'sonner';

interface AudioRecorderSimpleProps {
  onRecordingComplete: (blob: Blob) => void;
  onError?: (error: string) => void;
}

export default function AudioRecorderSimple({
  onRecordingComplete,
  onError
}: AudioRecorderSimpleProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 检查浏览器支持
  const isSupported = typeof window !== 'undefined' && 
    'MediaRecorder' in window && 
    'getUserMedia' in navigator;

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      onError?.('浏览器不支持录音功能');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });

      // 选择最佳的MIME类型
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg'
      ];
      
      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      if (!selectedMimeType) {
        selectedMimeType = 'audio/webm';
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 128000
      });

      audioChunksRef.current = [];
      setRecordingDuration(0);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: selectedMimeType });
        setAudioBlob(blob);
        
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        onRecordingComplete(blob);
        
        // 停止所有音轨
        stream.getTracks().forEach(track => track.stop());
        
        // 清除定时器
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // 每秒收集一次数据
      setIsRecording(true);

      // 开始计时
      const startTime = Date.now();
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      toast.success('开始录音');
    } catch (error) {
      console.error('录音失败:', error);
      onError?.(`录音失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }, [isSupported, onRecordingComplete, onError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.success('录音完成');
    }
  }, [isRecording]);

  const playRecording = useCallback(() => {
    if (!audioUrl) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.onpause = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [audioUrl, isPlaying]);

  const downloadRecording = useCallback(() => {
    if (!audioBlob) return;

    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `录音_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('录音已下载');
  }, [audioBlob]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isSupported) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>您的浏览器不支持录音功能</p>
        <p className="text-sm mt-2">请使用 Chrome、Edge 或 Safari 浏览器</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 录音控制 */}
      <div className="flex items-center gap-4">
        <Button
          onClick={isRecording ? stopRecording : startRecording}
          variant={isRecording ? "destructive" : "default"}
          size="lg"
          className="flex items-center gap-2"
          disabled={!isSupported}
        >
          {isRecording ? (
            <>
              <Square className="h-4 w-4" />
              停止录音
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              开始录音
            </>
          )}
        </Button>

        {isRecording && (
          <div className="flex items-center gap-2 text-sm text-orange-600">
            <div className="w-2 h-2 bg-orange-600 rounded-full animate-pulse"></div>
            录音中... {formatDuration(recordingDuration)}
          </div>
        )}
      </div>

      {/* 录音播放控制 */}
      {audioBlob && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button
              onClick={playRecording}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-4 w-4" />
                  暂停
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  播放
                </>
              )}
            </Button>

            <Button
              onClick={downloadRecording}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              下载
            </Button>
          </div>

          <div className="text-sm text-gray-600">
            录音时长: {formatDuration(recordingDuration)} | 
            文件大小: {(audioBlob.size / 1024 / 1024).toFixed(2)} MB
          </div>
        </div>
      )}

      {/* 使用提示 */}
      <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
        <p className="font-medium mb-1">录音提示：</p>
        <ul className="space-y-1">
          <li>• 请在安静环境中录音，避免背景噪音</li>
          <li>• 说话清晰，语速适中</li>
          <li>• 录音完成后点击"开始语音转文字"进行处理</li>
          <li>• 支持中文语音识别</li>
        </ul>
      </div>
    </div>
  );
} 