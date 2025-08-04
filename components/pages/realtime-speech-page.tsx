'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Save, FileText, Mic } from 'lucide-react';
import SpeechRecognizer from '@/components/ui/speech-recognizer';
import { toast } from 'sonner';

export default function RealtimeSpeechPage() {
  const [transcript, setTranscript] = useState('');
  const [finalText, setFinalText] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSpeechResult = (text: string) => {
    setFinalText(prev => prev + text + ' ');
    setTranscript(prev => prev + text + ' ');
  };

  const handleSpeechError = (errorMessage: string) => {
    setError(errorMessage);
    toast.error(errorMessage);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(finalText);
      toast.success('文本已复制到剪贴板');
    } catch (err) {
      toast.error('复制失败');
    }
  };

  const saveToFile = () => {
    if (!finalText.trim()) {
      toast.error('没有内容可保存');
      return;
    }

    const blob = new Blob([finalText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `语音转文字_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('文件已保存');
  };

  const clearText = () => {
    setTranscript('');
    setFinalText('');
    setError('');
  };

  const formatText = () => {
    if (!finalText.trim()) {
      toast.error('没有内容可格式化');
      return;
    }

    // 简单的文本格式化
    let formatted = finalText
      .replace(/\s+/g, ' ') // 合并多个空格
      .replace(/([。！？；：])\s*/g, '$1\n') // 在句号、感叹号等后换行
      .replace(/\n\s*\n/g, '\n') // 删除多余的空行
      .trim();

    setFinalText(formatted);
    toast.success('文本已格式化');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">实时语音转文字</h1>
        <p className="text-gray-600">使用浏览器原生语音识别功能，实时将语音转换为文字</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 语音识别控制区域 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              语音识别
            </CardTitle>
            <CardDescription>
              点击开始录音，实时将语音转换为文字
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SpeechRecognizer
              onResult={handleSpeechResult}
              onError={handleSpeechError}
              language="zh-CN"
              continuous={true}
            />

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                语言: 中文
              </Badge>
              <Badge variant="outline">
                模式: 连续识别
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* 文本编辑区域 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              转写结果
            </CardTitle>
            <CardDescription>
              实时显示语音转文字的结果，支持编辑和导出
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transcript">转写文本</Label>
              <Textarea
                id="transcript"
                value={finalText}
                onChange={(e) => setFinalText(e.target.value)}
                placeholder="语音转文字的结果将显示在这里..."
                className="min-h-[200px] resize-none"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={copyToClipboard}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                复制文本
              </Button>
              
              <Button
                onClick={saveToFile}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                保存文件
              </Button>
              
              <Button
                onClick={formatText}
                variant="outline"
                size="sm"
              >
                格式化
              </Button>
              
              <Button
                onClick={clearText}
                variant="outline"
                size="sm"
              >
                清空
              </Button>
            </div>

            {finalText && (
              <div className="text-sm text-gray-500">
                字符数: {finalText.length} | 词数: {finalText.split(/\s+/).filter(Boolean).length}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">功能特点</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 完全本地处理，保护隐私</li>
                <li>• 实时语音识别，无需等待</li>
                <li>• 支持连续录音和识别</li>
                <li>• 自动保存和导出功能</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">注意事项</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 需要允许浏览器麦克风权限</li>
                <li>• 建议在安静环境中使用</li>
                <li>• 支持中文语音识别</li>
                <li>• 需要现代浏览器支持</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 