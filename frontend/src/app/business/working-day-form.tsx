'use client';

import { useActionState, useId, useState } from 'react';
import styles from './business-bookings.module.css';
import type { WorkingDayFormProps } from './types/working-day.types';
import { saveWorkingDay } from './working-day.actions';

export function WorkingDayForm({ specialistId, weekday, day, initialHours }: WorkingDayFormProps) {
  const [state, action, pending] = useActionState(
    saveWorkingDay.bind(null, specialistId, weekday),
    null,
  );
  const [hours, setHours] = useState(initialHours);
  const hintId = useId();

  return (
    <details className={styles.workingDayEditor}>
      <summary>Edit {day}</summary>
      <form action={action}>
        <label>
          Working hours for {day}
          <textarea
            name="hours"
            aria-describedby={hintId}
            rows={3}
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            disabled={pending}
            maxLength={20000}
          />
        </label>
        <p id={hintId}>
          Enter one interval per line, for example 09:00-13:00. Leave blank for a day off.
        </p>
        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save hours'}
        </button>
        {state && <p role={state.saved ? 'status' : 'alert'}>{state.message}</p>}
      </form>
    </details>
  );
}
