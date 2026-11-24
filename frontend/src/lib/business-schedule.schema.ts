import type {
  BusinessScheduleResponse,
  ScheduleSpecialist,
  WorkingPeriod,
} from './types/business-schedule.types';
import { isTimeZone } from './validation/time-zone';
import { isUuid } from './validation/uuid';

function isWorkingPeriod(value: unknown): value is WorkingPeriod {
  return (
    typeof value === 'object' &&
    value !== null &&
    'weekday' in value &&
    typeof value.weekday === 'number' &&
    Number.isInteger(value.weekday) &&
    value.weekday >= 1 &&
    value.weekday <= 7 &&
    'startMinute' in value &&
    typeof value.startMinute === 'number' &&
    Number.isInteger(value.startMinute) &&
    value.startMinute >= 0 &&
    'endMinute' in value &&
    typeof value.endMinute === 'number' &&
    Number.isInteger(value.endMinute) &&
    value.endMinute <= 1440 &&
    value.endMinute > value.startMinute
  );
}

export function parseBusinessSchedule(payload: unknown): BusinessScheduleResponse {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('schedule' in payload) ||
    !('specialists' in payload) ||
    !Array.isArray(payload.specialists) ||
    !payload.specialists.every(isScheduleSpecialist)
  )
    throw new Error('Invalid business schedule response.');

  const { schedule, specialists } = payload;
  if (schedule === null) return { specialists, schedule };
  if (
    typeof schedule !== 'object' ||
    !('id' in schedule) ||
    !isUuid(schedule.id) ||
    !('name' in schedule) ||
    typeof schedule.name !== 'string' ||
    !schedule.name.trim() ||
    !('timeZone' in schedule) ||
    !isTimeZone(schedule.timeZone) ||
    !('workingPeriods' in schedule) ||
    !Array.isArray(schedule.workingPeriods) ||
    !schedule.workingPeriods.every(isWorkingPeriod)
  )
    throw new Error('Invalid business schedule response.');

  const { id, name, timeZone, workingPeriods } = schedule;
  return { specialists, schedule: { id, name, timeZone, workingPeriods } };
}

function isScheduleSpecialist(value: unknown): value is ScheduleSpecialist {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    isUuid(value.id) &&
    'name' in value &&
    typeof value.name === 'string' &&
    !!value.name.trim() &&
    'isActive' in value &&
    typeof value.isActive === 'boolean'
  );
}
