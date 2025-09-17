'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ChevronDown, 
  ChevronUp, 
  Eye, 
  EyeOff, 
  Calendar,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { TimeSlot } from '@/lib/types';
import { cn } from '@/lib/utils';

interface EnhancedTimeSlotsProps {
  slots: (TimeSlot & { isPastTime?: boolean })[];
  selectedTimeSlots: string[];
  onTimeSlotToggle: (timeSlot: string) => void;
  formatTimeSlot: (start: string) => string;
  
}

export function EnhancedTimeSlots({
  slots,
  selectedTimeSlots,
  onTimeSlotToggle,
  formatTimeSlot,
  }: EnhancedTimeSlotsProps) {
  const [showExpiredSlots, setShowExpiredSlots] = useState(false);

  // 分离不同状态的时间段
  const availableSlots = slots.filter(slot => !slot.isPastTime && !slot.is_booked);
  const bookedSlots = slots.filter(slot => slot.is_booked && !slot.isPastTime);
  const expiredSlots = slots.filter(slot => slot.isPastTime);



  const renderTimeSlot = (slot: TimeSlot & { isPastTime?: boolean }, category: 'available' | 'booked' | 'expired') => {
    const isSelected = selectedTimeSlots.includes(slot.start);
    const isDisabled = slot.is_booked || slot.isPastTime;
    
    const getVariantAndClass = () => {
      if (isSelected) return { 
        variant: 'outline' as const, 
        className: '!bg-gray-100 dark:!bg-gray-200 !text-gray-900 dark:!text-gray-900 !border-gray-300 dark:!border-gray-400 hover:!bg-gray-200 dark:hover:!bg-gray-300' 
      };
      
      switch (category) {
        case 'available':
          return { 
            variant: 'outline' as const, 
            className: 'hover:bg-green-50 hover:border-green-300 dark:hover:bg-green-900/20' 
          };
        case 'booked':
          return { 
            variant: 'outline' as const, 
            className: 'opacity-60 cursor-not-allowed bg-gray-50 text-gray-400 border-gray-200 dark:bg-gray-800/50 dark:text-gray-500 dark:border-gray-700' 
          };
        case 'expired':
          return { 
            variant: 'outline' as const, 
            className: 'opacity-40 cursor-not-allowed bg-gray-50 text-gray-400 border-gray-200 dark:bg-gray-800/50 dark:text-gray-500 dark:border-gray-700' 
          };
        default:
          return { variant: 'outline' as const, className: '' };
      }
    };

    const { variant, className } = getVariantAndClass();
    
    return (
      <Button
        key={slot.start}
        type="button"
        variant={variant}
        className={cn('justify-between h-auto p-3 transition-all duration-200', className)}
        onClick={() => !isDisabled && onTimeSlotToggle(slot.start)}
        disabled={isDisabled}
      >
        <div className="flex items-center justify-center w-full relative">
          <span className="font-medium text-sm text-center">
            {formatTimeSlot(slot.start)}
          </span>
          {category === 'available' && (
            <CheckCircle2 className={cn('w-4 h-4 transition-opacity absolute right-0', isSelected ? 'opacity-100 text-green-600' : 'opacity-0')} />
          )}
        </div>
      </Button>
    );
  };

  const SectionHeader = ({ 
    icon: Icon, 
    title, 
    count, 
    color = 'gray' 
  }: { 
    icon: Record<string, unknown>; 
    title: string; 
    count: number; 
    color?: 'green' | 'red' | 'gray' | 'orange';
  }) => {
    const colorClasses = {
      green: 'text-green-600 dark:text-green-400',
      red: 'text-red-600 dark:text-red-400', 
      gray: 'text-gray-600 dark:text-gray-400',
      orange: 'text-orange-600 dark:text-orange-400'
    };

    return (
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn('w-4 h-4', colorClasses[color])} />
        <span className={cn('text-sm font-medium', colorClasses[color])}>
          {title} ({count})
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 可用时间段 */}
      {availableSlots.length > 0 && (
        <div>
          <SectionHeader 
            icon={CheckCircle2} 
            title="可选时间段" 
            count={availableSlots.length} 
            color="green" 
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {availableSlots.map(slot => renderTimeSlot(slot, 'available'))}
          </div>
        </div>
      )}

      {/* 已预定时间段 */}
      {bookedSlots.length > 0 && (
        <div>
          <Separator className="my-4" />
          <SectionHeader 
            icon={AlertCircle} 
            title="已预定时间段" 
            count={bookedSlots.length} 
            color="red" 
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {bookedSlots.map(slot => renderTimeSlot(slot, 'booked'))}
          </div>
        </div>
      )}

      {/* 过期时间段 - 可折叠 */}
      {expiredSlots.length > 0 && (
        <div>
          <Separator className="my-4" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowExpiredSlots(!showExpiredSlots)}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-3 transition-colors"
          >
            {showExpiredSlots ? (
              <>
                <EyeOff className="w-4 h-4" />
                <span>隐藏已过期时间段</span>
                <Badge variant="outline" className="ml-1">{expiredSlots.length}</Badge>
                <ChevronUp className="w-4 h-4 ml-auto" />
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                <span>查看已过期时间段</span>
                <Badge variant="outline" className="ml-1">{expiredSlots.length}</Badge>
                <ChevronDown className="w-4 h-4 ml-auto" />
              </>
            )}
          </Button>
          
          {showExpiredSlots && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-in slide-in-from-top-2 duration-300">
              {expiredSlots.map(slot => renderTimeSlot(slot, 'expired'))}
            </div>
          )}
        </div>
      )}

      {/* 无可用时间段提示 */}
      {availableSlots.length === 0 && bookedSlots.length === 0 && expiredSlots.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">暂无时间段数据</h3>
          <p className="text-sm">请选择其他日期或稍后再试</p>
        </div>
      )}


    </div>
  );
}