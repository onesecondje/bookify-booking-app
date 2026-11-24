'use client';

import { useActionState, useState } from 'react';
import styles from './business-bookings.module.css';
import { saveService } from './business-services.actions';
import type { ServiceEditFormProps } from './types/business-services.types';

export function ServiceEditForm({ serviceId, initialValues }: ServiceEditFormProps) {
  const [state, action, pending] = useActionState(saveService.bind(null, serviceId), null);
  const [name, setName] = useState(initialValues.name);
  const [duration, setDuration] = useState(String(initialValues.durationMinutes));
  const [isActive, setIsActive] = useState(String(initialValues.isActive));

  return (
    <details className={styles.serviceEditor}>
      <summary>Edit {initialValues.name}</summary>
      <form action={action}>
        <fieldset disabled={pending}>
          <legend>Service details</legend>
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
          <label>
            Status
            <select
              name="isActive"
              value={isActive}
              onChange={(event) => setIsActive(event.target.value)}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <button type="submit">{pending ? 'Saving…' : 'Save service'}</button>
        </fieldset>
        {state && <p role={state.saved ? 'status' : 'alert'}>{state.message}</p>}
      </form>
    </details>
  );
}
