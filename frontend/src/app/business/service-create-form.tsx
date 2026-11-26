'use client';

import { useActionState, useState } from 'react';
import styles from './business-bookings.module.css';
import { createService } from './business-services.actions';
import { ServiceSpecialistChoices } from './service-specialist-choices';
import type { ServiceCreateFormProps, ServiceFormState } from './types/business-services.types';

export function ServiceCreateForm({ specialists }: ServiceCreateFormProps) {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [specialistIds, setSpecialistIds] = useState<string[]>([]);
  const [state, action, pending] = useActionState(
    async (_previous: ServiceFormState | null, form: FormData) => {
      const result = await createService(form);
      if (result.saved) {
        setName('');
        setDuration('');
        setSpecialistIds([]);
      }
      return result;
    },
    null,
  );

  return (
    <details className={`${styles.serviceEditor} ${styles.serviceCreate}`}>
      <summary>Add service</summary>
      <form action={action}>
        <fieldset disabled={pending}>
          <legend>New service</legend>
          <label>
            Name
            <input
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label>
            Duration (minutes)
            <input
              name="durationMinutes"
              type="number"
              min="1"
              max="2147483647"
              step="1"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              required
            />
          </label>
          <ServiceSpecialistChoices
            specialists={specialists}
            selectedIds={specialistIds}
            onToggle={(id, checked) =>
              setSpecialistIds((previous) =>
                checked ? [...previous, id] : previous.filter((selected) => selected !== id),
              )
            }
          />
          <button type="submit">{pending ? 'Creating…' : 'Create service'}</button>
        </fieldset>
        {state && <p role={state.saved ? 'status' : 'alert'}>{state.message}</p>}
      </form>
    </details>
  );
}
