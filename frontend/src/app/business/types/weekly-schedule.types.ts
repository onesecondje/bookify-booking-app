import type { BusinessScheduleResponse } from '@/lib/types/business-schedule.types';

export interface WeeklyScheduleProps {
  result: BusinessScheduleResponse | null;
  invalidSelection: boolean;
}
