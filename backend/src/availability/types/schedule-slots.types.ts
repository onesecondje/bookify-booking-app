export type WorkingPeriodMinutes = {
  startMinute: number;
  endMinute: number;
};

export type WeeklyWorkingPeriod = WorkingPeriodMinutes & { weekday: number };
export type ScheduleSlot = { startsAt: string; endsAt: string };

export type ScheduleSlotOptions = {
  date: string;
  timeZone: string;
  periods: readonly WeeklyWorkingPeriod[];
  durationMinutes: number;
  stepMinutes?: number;
  now: string;
};

export type ScheduleSlotsResult = { slots: ScheduleSlot[]; unresolvedPeriodCount: number };
