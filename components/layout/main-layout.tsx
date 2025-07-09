'use client';

import { useAppContext } from '@/lib/context/app-context';
import Navigation from '@/components/navigation';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { currentMember, isAdmin, loading } = useAppContext();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentMember) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            无法加载用户信息
          </h2>
          <p className="text-gray-600">
            请确保后端服务正常运行并重新加载页面
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation isAdmin={isAdmin} currentMember={currentMember.name} />
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
} 