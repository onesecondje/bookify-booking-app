export interface WorkingDayFormProps {
  specialistId: string;
  weekday: number;
  day: string;
  initialHours: string;
}

export interface WorkingDayState {
  saved: boolean;
  message: string;
}
