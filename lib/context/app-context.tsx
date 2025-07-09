'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Member } from '@/lib/types';
import { memberApi } from '@/lib/api';

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

  useEffect(() => {
    // 从localStorage获取当前用户ID，如果没有则默认为1（管理员）
    const storedMemberId = localStorage.getItem('current_member_id');
    const memberId = storedMemberId ? parseInt(storedMemberId) : 1;
    
    // 获取用户信息
    memberApi
      .get(memberId)
      .then((member) => {
        setCurrentMember(member);
        localStorage.setItem('current_member_id', member.id.toString());
      })
      .catch((error) => {
        console.error('获取用户信息失败:', error);
        // 如果获取失败，尝试获取管理员账户
        memberApi
          .get(1)
          .then((member) => {
            setCurrentMember(member);
            localStorage.setItem('current_member_id', member.id.toString());
          })
          .catch((error) => {
            console.error('获取管理员信息失败:', error);
          });
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

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