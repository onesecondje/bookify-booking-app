import type { SpecialistSummary } from './specialists.types';

export interface WorkingPeriod {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export interface BusinessSchedule extends SpecialistSummary {
  timeZone: string;
  workingPeriods: WorkingPeriod[];
}

export interface ScheduleSpecialist extends SpecialistSummary {
  isActive: boolean;
}

export interface BusinessScheduleResponse {
  specialists: ScheduleSpecialist[];
  schedule: BusinessSchedule | null;
}
