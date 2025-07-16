'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Member } from '@/lib/types';
import { memberApi } from '@/lib/api';
import { getThemeName, getUserInfo } from '@dootask/tools';
import AlertLayout, { AlertLayoutProps, AlertProps } from '@/components/layout/alert';

interface AppContextType {
  currentMember: Member | null;
  setCurrentMember: (member: Member | null) => void;
  isAdmin: boolean;
  loading: boolean;
  Alert: (message: string | AlertProps) => void;
  Confirm: (message: string | AlertProps) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<AlertLayoutProps[]>([]);

  // 初始化主题
  const initTheme = useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }
    const theme = await getThemeName();
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  // 初始化用户信息
  const initUser = useCallback(async () => {
    try {
      // 获取用户信息
      const userInfo = await getUserInfo();
      if (!userInfo) {
        throw new Error('用户信息不存在');
      }

      // 获取会员信息
      let member: Member | null = null;
      try {
        member = await memberApi.getForDootaskId(userInfo.userid);
        // 更新会员信息
        member = await memberApi.update(member.id, {
          name: userInfo.nickname,
          is_admin: userInfo.identity.includes('admin'),
        });
      } catch {
        // 会员不存在，创建会员
        member = await memberApi.create({
          dootask_id: userInfo.userid,
          name: userInfo.nickname,
          is_admin: userInfo.identity.includes('admin'),
          is_room_admin: false,
        });
      }

      // 设置当前会员
      setCurrentMember(member); 
      localStorage.setItem('current_member_id', member.id.toString());
    } catch (error) {
      console.error('获取用户信息失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 弹出alert或confirm
  const alertConfirm = useCallback((type: 'alert' | 'confirm', message: string | AlertProps) => {
    const id = crypto.randomUUID();
    if (typeof message === 'string') {
      message = { message };
    }
    setAlerts([...alerts, { 
      id, 
      type,
      onConfirm: () => {
        setAlerts(alerts.filter(alert => alert.id !== id));
      },
      onClose: () => {
        setAlerts(alerts.filter(alert => alert.id !== id));
      },
      ...message,
    }]);
  }, [alerts]);

  // 初始化主题和用户信息
  useEffect(() => {
    initTheme();
    initUser();
  }, [initTheme, initUser]);

  // 判断是否是管理员
  const isAdmin = currentMember?.is_admin || currentMember?.is_room_admin || false;

  return (
    <AppContext.Provider
      value={{
        currentMember,
        setCurrentMember,
        isAdmin,
        loading,
        Alert: (message: string | AlertProps) => alertConfirm('alert', message),
        Confirm: (message: string | AlertProps) => alertConfirm('confirm', message),
      }}
    >
      {children}

      {/* 弹出框 */}
      <AlertLayout alerts={alerts}/>
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
} 