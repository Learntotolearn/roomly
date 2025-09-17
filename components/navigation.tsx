'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CalendarDays, 
  Settings, 
  FileText, 
  Home,
  Menu,
  Users,
  Database,
  ChevronDown
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';

interface NavigationProps {
  isAdmin: boolean;
  currentMember: string;
}

export default function Navigation({ isAdmin, currentMember }: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();

  // 基础导航项目
  const baseNavItems = [
    { href: '/', label: '首页', icon: Home },
    { href: '/booking', label: '预定会议室', icon: CalendarDays },
    { href: '/my-bookings', label: '我的预定', icon: FileText },
  ];

  // 管理员项目
  const adminItems = isAdmin ? [
    { href: '/admin/members', label: '会员管理', icon: Users },
    { href: '/admin/rooms', label: '会议室管理', icon: Settings },
    { href: '/admin/bookings', label: '预定管理', icon: FileText },
    { href: '/admin/backup', label: '数据备份', icon: Database },
  ] : [];

  // 移动端所有项目
  const allNavItems = [...baseNavItems, ...adminItems];

  // 检查是否在管理页面
  const isAdminPage = pathname.startsWith('/admin');

  return (
    <nav className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-4 py-3 sticky top-0 z-50">
      <div className="flex items-center justify-between mx-auto max-w-screen-xl">
        
        {/* 左侧：移动端菜单 + 系统标题 */}
        <div className="flex items-center gap-3">
          {/* 移动端菜单按钮 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="打开菜单"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="mt-2">
              {allNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <DropdownMenuItem 
                    key={item.href} 
                    className={`flex items-center py-2 px-4 my-1 text-sm rounded cursor-pointer ${
                      isActive
                        ? 'text-lime-600 dark:text-lime-400 bg-lime-50 dark:bg-lime-900'
                        : 'text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800'
                    }`}
                    onClick={() => {
                      router.push(item.href);
                    }}
                  >
                    <Icon size={16} className="mr-3 flex-shrink-0" />
                    {item.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 系统标题 - 只在桌面端显示 */}
          <Link href="/" className="hidden lg:flex items-center">
            <span className="text-lg lg:text-xl font-semibold whitespace-nowrap">
              会议室预定系统
            </span>
          </Link>
        </div>
        
        {/* 中间：桌面端导航项目 - 水平排列 */}
        <div className="hidden lg:flex items-center space-x-6">
          {/* 基础导航项目 */}
          {baseNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                  isActive
                    ? 'text-lime-600 dark:text-lime-400 bg-lime-50 dark:bg-lime-900'
                    : 'text-gray-700 dark:text-white hover:text-lime-600 dark:hover:text-lime-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                }`}
              >
                <Icon size={16} className="mr-2 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
          
          {/* 管理中心下拉菜单 */}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                    isAdminPage
                      ? 'text-lime-600 dark:text-lime-400 bg-lime-50 dark:bg-lime-900'
                      : 'text-gray-700 dark:text-white hover:text-lime-600 dark:hover:text-lime-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Settings size={16} className="mr-2 flex-shrink-0" />
                  管理中心
                  <ChevronDown size={14} className="ml-1 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="mt-2">
                {adminItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <DropdownMenuItem 
                      key={item.href}
                      className={`flex items-center py-2 px-4 my-1 text-sm rounded cursor-pointer ${
                        isActive
                          ? 'text-lime-600 dark:text-lime-400 bg-lime-50 dark:bg-lime-900'
                          : 'text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800'
                      }`}
                      onClick={() => {
                        router.push(item.href);
                      }}
                    >
                      <Icon size={16} className="mr-3 flex-shrink-0" />
                      {item.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        
        {/* 右侧：用户信息 */}
        <div className="flex items-center gap-2 pr-22">
          <span className="text-sm text-gray-700 dark:text-white">欢迎，</span>
          <span
            className="text-sm text-gray-700 dark:text-white max-w-[80px] truncate"
            title={currentMember}
          >
            {currentMember}
          </span>
          {isAdmin && (
            <Badge variant="secondary" className="text-xs">
              管理员
            </Badge>
          )}
        </div>
      </div>
    </nav>
  );
}