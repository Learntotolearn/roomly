'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CalendarDays, 
  Users, 
  Settings, 
  FileText, 
  Home,
  Menu,
  X
} from 'lucide-react';

interface NavigationProps {
  isAdmin: boolean;
  currentMember: string;
}

export default function Navigation({ isAdmin, currentMember }: NavigationProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { href: '/', label: '首页', icon: Home },
    { href: '/booking', label: '预定会议室', icon: CalendarDays },
    { href: '/my-bookings', label: '我的预定', icon: FileText },
    ...(isAdmin ? [
      { href: '/admin/rooms', label: '会议室管理', icon: Settings },
      { href: '/admin/members', label: '会员管理', icon: Users },
      { href: '/admin/bookings', label: '预定管理', icon: FileText },
    ] : []),
  ];

  return (
    <nav className="bg-white border-b border-gray-200 px-4 lg:px-6 py-2.5">
      <div className="flex flex-wrap justify-between items-center mx-auto max-w-screen-xl">
        <Link href="/" className="flex items-center">
          <span className="self-center text-xl font-semibold whitespace-nowrap">
            会议室预定系统
          </span>
        </Link>
        
        <div className="flex items-center lg:order-2">
          <div className="flex items-center gap-2 mr-4">
            <span className="text-sm text-gray-700">欢迎，{currentMember}</span>
            {isAdmin && (
              <Badge variant="secondary" className="text-xs">
                管理员
              </Badge>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>
        </div>
        
        <div className={`${
          isMobileMenuOpen ? 'block' : 'hidden'
        } justify-between items-center w-full lg:flex lg:w-auto lg:order-1`}>
          <ul className="flex flex-col mt-4 font-medium lg:flex-row lg:space-x-8 lg:mt-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center py-2 pr-4 pl-3 text-sm rounded lg:p-0 lg:hover:text-blue-600 ${
                      isActive
                        ? 'text-blue-600 bg-blue-50 lg:bg-transparent'
                        : 'text-gray-700 hover:bg-gray-50 lg:hover:bg-transparent'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
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