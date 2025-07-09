import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 计算预定时长（小时）
export function calculateDuration(startTime: string, endTime: string): number {
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);
  const startTimeMinutes = startHours * 60 + startMinutes;
  let endTimeMinutes = endHours * 60 + endMinutes;
  
  // 处理跨越午夜的情况 (如 23:30-00:00)
  if (endTimeMinutes === 0 && startTimeMinutes > 0) {
    endTimeMinutes = 24 * 60;
  }
  
  return (endTimeMinutes - startTimeMinutes) / 60;
}

// 格式化时长显示
export function formatDuration(hours: number): string {
  if (hours === 0) return '0小时';
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes}分钟`;
  }
  if (hours % 1 === 0) {
    return `${hours}小时`;
  }
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  return `${wholeHours}小时${minutes}分钟`;
}

// 获取系统主题
export function getSystemTheme() {
  if (typeof window === 'undefined') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}