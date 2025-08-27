'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus, X } from 'lucide-react';
import { BookingUser, Booking } from '@/lib/types';
import { calculateDuration, formatDuration } from '@/lib/utils';

// 格式化日期函数
const formatDate = (dateString: string) => {
  if (!dateString) return '';
  return dateString;
};

// 格式化时间函数
const formatTime = (startTime: string, endTime: string) => {
  if (!startTime || !endTime) return '';
  return `${startTime} - ${endTime}`;
};
import { selectUsers, requestAPI } from '@dootask/tools';

interface EditParticipantsDialogProps {
  booking: Booking;
  participants: BookingUser[];
  isOpen: boolean;
  isUpdating: boolean;
  onClose: () => void;
  onSave: (participants: BookingUser[]) => void;
}

export function EditParticipantsDialog({
  booking,
  participants,
  isOpen,
  isUpdating,
  onClose,
  onSave,
}: EditParticipantsDialogProps) {
  const [editingParticipants, setEditingParticipants] = useState<BookingUser[]>(participants);
  const [isAddingParticipants, setIsAddingParticipants] = useState(false);

  if (!isOpen) return null;

  const handleAddParticipant = () => {
    setIsAddingParticipants(true);
    selectUsers({
      value: editingParticipants.map(p => p.userid),
      multipleMax: booking.room?.capacity || 0,
      title: '选择参会人员',
      placeholder: '请选择参会人员',
    }).then((users) => {
      if (!users || users.length === 0) {
        setIsAddingParticipants(false);
        return;
      }
      
      requestAPI({
        url: 'users/basic',
        data: {userid: users},
      }).then(({data}) => {
        const newParticipants = data.map((user: {userid: number, nickname: string}) => ({
          userid: user.userid, 
          nickname: user.nickname
        }));
        
        // 合并新旧参会人员，去重
        const mergedParticipants = [...editingParticipants];
        newParticipants.forEach((newUser: BookingUser) => {
          if (!mergedParticipants.some(p => p.userid === newUser.userid)) {
            mergedParticipants.push(newUser);
          }
        });
        
        setEditingParticipants(mergedParticipants);
      }).finally(() => {
        setIsAddingParticipants(false);
      });
    }).catch(() => {
      setIsAddingParticipants(false);
    });
  };

  const handleRemoveParticipant = (userid: number) => {
    setEditingParticipants(prev => prev.filter(p => p.userid !== userid));
  };

  const handleSave = () => {
    // 确保有参会人员数据
    if (editingParticipants.length === 0) {
      // 如果没有参会人员，可以添加一个提示
      alert('请至少添加一名参会人员');
      return;
    }
    
    // 调用父组件的保存方法
    onSave(editingParticipants);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-auto relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">编辑参会人员</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
            会议室: {booking.room?.name}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
            时间: {formatDate(booking.date)} {formatTime(booking.start_time, booking.end_time)}
          </p>
        </div>
        
        <div className="mb-4">
          <Button 
            variant="outline" 
            type="button" 
            onClick={handleAddParticipant}
            disabled={isAddingParticipants || isUpdating}
            className="w-full"
          >
            {isAddingParticipants ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                添加中...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                添加参会人员
              </>
            )}
          </Button>
        </div>
        
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-2">当前参会人员:</h3>
          {editingParticipants.length === 0 ? (
            <p className="text-sm text-gray-500">暂无参会人员</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {editingParticipants.map((user) => (
                <div key={user.userid} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded">
                  <span className="text-sm truncate mr-2" style={{ maxWidth: 'calc(100% - 40px)' }}>{user.nickname}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleRemoveParticipant(user.userid)}
                    disabled={isUpdating}
                    className="h-6 w-6 p-0 flex-shrink-0"
                    aria-label="移除参会人员"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isUpdating}
            className="min-w-[80px]"
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={isUpdating}
            className="min-w-[80px]"
          >
            {isUpdating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              '保存'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}