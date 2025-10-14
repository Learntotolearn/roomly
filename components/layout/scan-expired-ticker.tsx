'use client';

import { useQuery } from '@tanstack/react-query';
import { bookingApi } from '@/lib/api/booking';

export default function ScanExpiredTicker() {
  const enabled = true;
  useQuery({
    queryKey: ['scan-expired-meetings'],
    queryFn: () => bookingApi.scanExpired(),
    refetchInterval: 60000,
    refetchIntervalInBackground: true,
    enabled: true,
  });
  return null;
}