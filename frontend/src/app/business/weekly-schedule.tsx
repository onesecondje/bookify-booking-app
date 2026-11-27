import styles from './business-bookings.module.css';
import { weekdays } from './constants/weekdays';
import { BookingFilter } from './enums/booking-filter.enum';
import type { WeeklyScheduleProps } from './types/weekly-schedule.types';
import { WorkingDayForm } from './working-day-form';

function formatWorkingTime(minute: number): string {
  const hours = String(Math.floor(minute / 60)).padStart(2, '0');
  const minutes = String(minute % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function WeeklySchedule({ result, invalidSelection, bookingFilter }: WeeklyScheduleProps) {
  const specialists = result?.specialists ?? [];
  const schedule = invalidSelection ? null : result?.schedule;

  return (
    <section className={styles.schedule} aria-labelledby="schedule-title">
      <h2 id="schedule-title">Weekly schedule</h2>
      {specialists.length > 0 && (
        <form className={styles.scheduleForm} action="/business" method="get">
          {bookingFilter !== BookingFilter.All && (
            <input type="hidden" name="bookingStatus" value={bookingFilter} />
          )}
          <label>
            Specialist
            <select name="specialistId" defaultValue={schedule?.id ?? ''} required>
              <option value="" disabled>
                Choose a specialist
              </option>
              {specialists.map(({ id, name, isActive }) => (
                <option key={id} value={id}>
                  {name}
                  {isActive ? '' : ' (inactive)'}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Show schedule</button>
        </form>
      )}
      {result === null ? (
        <p role="status">The weekly schedule is unavailable. Refresh the page to try again.</p>
      ) : schedule ? (
        <table className={styles.table} aria-labelledby="schedule-title">
          <caption>
            {schedule.name} · {schedule.timeZone}
          </caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Working hours</th>
            </tr>
          </thead>
          <tbody>
            {weekdays.map((day, index) => {
              const periods = schedule.workingPeriods.filter(
                ({ weekday }) => weekday === index + 1,
              );
              return (
                <tr key={day}>
                  <th scope="row">{day}</th>
                  <td>
                    {periods.length
                      ? periods
                          .map(
                            ({ startMinute, endMinute }) =>
                              `${formatWorkingTime(startMinute)}–${formatWorkingTime(endMinute)}`,
                          )
                          .join(', ')
                      : 'Day off'}
                    <WorkingDayForm
                      key={schedule.id}
                      specialistId={schedule.id}
                      weekday={index + 1}
                      day={day}
                      initialHours={periods
                        .map(
                          ({ startMinute, endMinute }) =>
                            `${formatWorkingTime(startMinute)}-${formatWorkingTime(endMinute)}`,
                        )
                        .join('\n')}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : specialists.length > 0 ? (
        <p role="status">This specialist is unavailable. Choose a specialist from the list.</p>
      ) : (
        <p>No specialists.</p>
      )}
    </section>
  );
}
