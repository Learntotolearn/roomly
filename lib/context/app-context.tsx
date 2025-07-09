'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Member } from '@/lib/types';
import { memberApi } from '@/lib/api';
import { getUserInfo } from '@dootask/tools';

interface AppContextType {
  currentMember: Member | null;
  setCurrentMember: (member: Member | null) => void;
  isAdmin: boolean;
  loading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    initUser();
  }, [initUser]);

  const isAdmin = currentMember?.is_admin || false;

  return (
    <AppContext.Provider
      value={{
        currentMember,
        setCurrentMember,
        isAdmin,
        loading,
      }}
    >
      {children}
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