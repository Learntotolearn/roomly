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
  X
} from 'lucide-react';
import { closeApp } from '@dootask/tools';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';

interface NavigationProps {
  isAdmin: boolean;
  currentMember: string;
}

export default function Navigation({ isAdmin, currentMember }: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { href: '/', label: '首页', icon: Home },
    { href: '/booking', label: '预定会议室', icon: CalendarDays },
    { href: '/my-bookings', label: '我的预定', icon: FileText },
    ...(isAdmin ? [
      { href: '/admin/rooms', label: '会议室管理', icon: Settings },
      { href: '/admin/bookings', label: '预定管理', icon: FileText },
    ] : []),
  ];

  return (
    <nav className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-4 lg:px-6 py-3 lg:py-4 sticky top-0 z-50">
      <div className="flex flex-wrap justify-between items-center mx-auto max-w-screen-xl">
        <div className="flex items-center gap-2">
          <div className="flex items-center sm:hidden">
            <Button variant="ghost" size="sm" onClick={() => closeApp()}>
              <X size={20} />
            </Button>
          </div>
          
          <Link href="/" className="flex items-center">
            <span className="self-center text-xl font-semibold whitespace-nowrap">
              会议室预定系统
            </span>
          </Link>
        </div>
        
        <div className="flex items-center lg:order-2">
          <div className="flex items-center gap-2 mr-4">
            <span className="text-sm text-gray-700 dark:text-white">欢迎，{currentMember}</span>
            {isAdmin && (
              <Badge variant="secondary" className="text-xs">
                管理员
              </Badge>
            )}
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
              >
                <Menu />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="mt-3.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <DropdownMenuItem 
                    key={item.href} 
                    className={`flex items-center py-2 px-4 my-1 text-sm rounded lg:hover:text-lime-600 dark:lg:hover:text-lime-400 ${
                      isActive
                        ? 'text-lime-600 dark:text-white bg-lime-50 dark:bg-lime-900 dark:lg:text-lime-400 lg:bg-transparent dark:lg:bg-transparent'
                        : 'text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800 lg:hover:bg-transparent dark:lg:hover:bg-transparent'
                    }`}
                    onClick={() => {
                      router.push(item.href);
                    }}
                  >
                    <div className="w-full flex items-center">
                      <Icon size={16} className="mr-4" />
                      {item.label}
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="justify-between items-center w-full lg:w-auto lg:order-1 hidden lg:flex">
          <ul className="flex flex-col mt-4 font-medium lg:flex-row lg:space-x-8 lg:mt-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center py-2 pr-4 pl-3 text-sm rounded lg:p-0 lg:hover:text-lime-600 dark:lg:hover:text-lime-400 ${
                      isActive
                        ? 'text-lime-600 dark:text-white bg-lime-50 dark:bg-lime-900 dark:lg:text-lime-400 lg:bg-transparent dark:lg:bg-transparent'
                        : 'text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800 lg:hover:bg-transparent dark:lg:hover:bg-transparent'
                    }`}
                  >
                    <Icon size={16} className="mr-2" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
} 