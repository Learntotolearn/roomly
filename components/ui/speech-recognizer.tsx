'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from './button';
import { Mic, MicOff, Square } from 'lucide-react';

interface SpeechRecognizerProps {
  onResult: (text: string) => void;
  onError?: (error: string) => void;
  language?: string;
  continuous?: boolean;
}

export default function SpeechRecognizer({
  onResult,
  onError,
  language = 'zh-CN',
  continuous = true
}: SpeechRecognizerProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    // 检查浏览器支持
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);
      const recognition = new SpeechRecognition();
      
      // 配置识别器
      recognition.lang = language;
      recognition.continuous = continuous;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      // 事件处理
      recognition.onstart = () => {
        setIsListening(true);
        setTranscript('');
      };

      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const fullTranscript = finalTranscript + interimTranscript;
        setTranscript(fullTranscript);
        
        if (finalTranscript) {
          onResult(finalTranscript);
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        const errorMessage = getErrorMessage(event.error);
        onError?.(errorMessage);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setIsSupported(false);
      onError?.('浏览器不支持语音识别功能');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [language, continuous, onResult, onError]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        onError?.(`启动语音识别失败: ${error}`);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  const getErrorMessage = (error: string) => {
    switch (error) {
      case 'not-allowed':
        return '麦克风权限被拒绝，请在浏览器设置中允许麦克风访问';
      case 'no-speech':
        return '没有检测到语音，请说话';
      case 'audio-capture':
        return '无法捕获音频，请检查麦克风设备';
      case 'network':
        return '网络错误，请检查网络连接';
      case 'service-not-allowed':
        return '语音识别服务不可用';
      default:
        return `语音识别错误: ${error}`;
    }
  };

  if (!isSupported) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>您的浏览器不支持语音识别功能</p>
        <p className="text-sm mt-2">请使用 Chrome、Edge 或 Safari 浏览器</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button
          onClick={isListening ? stopListening : startListening}
          variant={isListening ? "destructive" : "default"}
          size="lg"
          className="flex items-center gap-2"
        >
          {isListening ? (
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
        
        {isListening && (
          <div className="flex items-center gap-2 text-sm text-orange-600">
            <div className="w-2 h-2 bg-orange-600 rounded-full animate-pulse"></div>
            正在录音...
          </div>
        )}
      </div>

      {transcript && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">实时转写结果:</h3>
          <p className="text-gray-900 whitespace-pre-wrap">{transcript}</p>
        </div>
      )}
    </div>
  );
} 