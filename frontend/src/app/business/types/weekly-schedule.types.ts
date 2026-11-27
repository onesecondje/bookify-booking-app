import type { BusinessScheduleResponse } from '@/lib/types/business-schedule.types';
import type { BookingFilter } from '../enums/booking-filter.enum';

export interface WeeklyScheduleProps {
  result: BusinessScheduleResponse | null;
  invalidSelection: boolean;
  bookingFilter: BookingFilter;
}
