'use client';

import { useQuery } from '@tanstack/react-query';
import { roomApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, MapPin, Calendar, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const { data: roomsRes, isLoading, error } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => roomApi.getAll(),
  });
  const rooms = roomsRes?.data || [];

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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          加载失败
        </h2>
        <p className="text-gray-600 dark:text-white">
          无法加载会议室信息，请检查网络连接
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          会议室预定系统
        </h1>
        <p className="text-gray-600 dark:text-white">
          欢迎使用会议室预定系统，请选择会议室进行预定
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map((room) => (
          <Card key={room.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start gap-2">
                <div className="text-base font-semibold leading-none overflow-hidden min-w-0 flex-1 max-w-[180px]">
                  <div className="truncate">
                    {room.name}
                  </div>
                </div>
                <Badge variant={room.is_open ? "default" : "secondary"} className="flex-shrink-0 whitespace-nowrap">
                  {room.is_open ? "开放" : "关闭"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 flex flex-col">
              <div className="flex items-center text-sm text-gray-600 dark:text-zinc-300">
                <Users className="w-4 h-4 mr-2" />
                可容纳 {room.capacity} 人
              </div>
              
              <div className="flex items-start text-sm text-gray-600 dark:text-zinc-300">
                <MapPin className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <span className="break-words line-clamp-3 overflow-hidden">
                  {room.description || `适合${room.capacity}人以内的团队会议，配备基础会议设施`}
                </span>
              </div>
              
              <div className="pt-4 flex-1 flex flex-col justify-end">
                <Button 
                  className="w-full" 
                  disabled={!room.is_open}
                  onClick={() => {
                    router.push(`/booking?room=${room.id}`);
                  }}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  预定此会议室
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {rooms.length === 0 && (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            暂无会议室
          </h3>
        </div>
      )}
    </div>
  );
} 