'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Clock, Eye, EyeOff } from 'lucide-react';
import { TimeSlot } from '@/lib/types';

interface CollapsibleTimeSlotsProps {
  slots: (TimeSlot & { isPastTime?: boolean })[];
  selectedTimeSlots: string[];
  onTimeSlotToggle: (timeSlot: string) => void;
  formatTimeSlot: (start: string) => string;
}

export function CollapsibleTimeSlots({
  slots,
  selectedTimeSlots,
  onTimeSlotToggle,
  formatTimeSlot
}: CollapsibleTimeSlotsProps) {
  const [showExpiredSlots, setShowExpiredSlots] = useState(false);

  // 分离可用和过期的时间段
  const availableSlots = slots.filter(slot => !slot.isPastTime);
  const expiredSlots = slots.filter(slot => slot.isPastTime);

  const renderTimeSlot = (slot: TimeSlot & { isPastTime?: boolean }) => {
    const isDisabled = slot.is_booked || slot.isPastTime;
    
    const getButtonClass = () => {
      if (slot.is_booked) {
        return 'opacity-60 cursor-not-allowed bg-red-50 text-red-400 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
      }
      if (slot.isPastTime) {
        return 'opacity-40 cursor-not-allowed bg-gray-50 text-gray-400 dark:bg-gray-800/50 dark:text-gray-500';
      }
      return '';
    };
    
    return (
      <Button
        key={slot.start}
        type="button"
        variant={selectedTimeSlots.includes(slot.start) ? "default" : "outline"}
        className={`justify-start ${getButtonClass()}`}
        onClick={() => !isDisabled && onTimeSlotToggle(slot.start)}
        disabled={isDisabled}
      >
        <div className="truncate w-full">
          {formatTimeSlot(slot.start)}
          {slot.is_booked && <span className="ml-1 text-xs">(已预定)</span>}
          {slot.isPastTime && <span className="ml-1 text-xs">(已过期)</span>}
        </div>
      </Button>
    );
  };

  return (
    <div className="space-y-4">
      {/* 可用时间段 */}
      {availableSlots.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              可选时间段 ({availableSlots.length})
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {availableSlots.map(renderTimeSlot)}
          </div>
        </div>
      )}

      {/* 过期时间段 - 可折叠 */}
      {expiredSlots.length > 0 && (
        <div className="border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowExpiredSlots(!showExpiredSlots)}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-3"
          >
            {showExpiredSlots ? (
              <>
                <EyeOff className="w-4 h-4" />
                <span>隐藏已过期时间段 ({expiredSlots.length})</span>
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                <span>查看已过期时间段 ({expiredSlots.length})</span>
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </Button>
          
          {showExpiredSlots && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 animate-in slide-in-from-top-2 duration-200">
              {expiredSlots.map(renderTimeSlot)}
            </div>
          )}
        </div>
      )}

      {/* 无可用时间段提示 */}
      {availableSlots.length === 0 && expiredSlots.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>暂无可用时间段</p>
        </div>
      )}
    </div>
  );
}