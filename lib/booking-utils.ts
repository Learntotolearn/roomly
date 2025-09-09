import { Booking } from './types';

/**
 * 计算预订的结束时间
 */
export function calculateBookingEndTime(booking: Booking): Date {
  const bookingDate = new Date(booking.date);
  
  if (booking.end_time === '24:00') {
    const endTime = new Date(bookingDate);
    endTime.setDate(endTime.getDate() + 1);
    endTime.setHours(0, 0, 0, 0);
    return endTime;
  }
  
  if (booking.end_time === '00:00') {
    const [startHour, startMinute] = booking.start_time.split(':').map(Number);
    if (startHour > 0 || startMinute > 0) {
      const endTime = new Date(bookingDate);
      endTime.setDate(endTime.getDate() + 1);
      endTime.setHours(0, 0, 0, 0);
      return endTime;
    }
  }
  
  const [endHour, endMinute] = booking.end_time.split(':').map(Number);
  const endTime = new Date(bookingDate);
  endTime.setHours(endHour, endMinute, 0, 0);
  
  return endTime;
}

/**
 * 检查预订是否已过期
 */
export function isBookingExpired(booking: Booking): boolean {
  if (booking.status !== 'active') {
    return booking.status === 'expired';
  }
  
  const endTime = calculateBookingEndTime(booking);
  const now = new Date();
  
  return endTime <= now;
}