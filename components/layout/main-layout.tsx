'use client';

import { useAppContext } from '@/lib/context/app-context';
import Navigation from '@/components/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { closeApp } from '@dootask/tools';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { currentMember, isAdmin, loading } = useAppContext();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!currentMember) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            无法加载用户信息
          </h2>
          <p className="text-gray-600 dark:text-white mb-8">
            请确保后端服务正常运行并重新加载页面
          </p>
          {/* 关闭按钮 */}
          <Button onClick={() => {
            closeApp()
          }}>
            关闭应用
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
      <Navigation isAdmin={isAdmin} currentMember={currentMember.name} />
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
} 