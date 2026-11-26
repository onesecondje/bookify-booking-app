'use client';

import { useActionState, useState } from 'react';
import styles from './business-bookings.module.css';
import { saveService } from './business-services.actions';
import { ServiceSpecialistChoices } from './service-specialist-choices';
import type { ServiceEditFormProps } from './types/business-services.types';

export function ServiceEditForm({ service, specialists }: ServiceEditFormProps) {
  const [state, action, pending] = useActionState(saveService.bind(null, service.id), null);
  const [name, setName] = useState(service.name);
  const [duration, setDuration] = useState(String(service.durationMinutes));
  const [isActive, setIsActive] = useState(String(service.isActive));
  const [specialistIds, setSpecialistIds] = useState(() => service.specialists.map(({ id }) => id));
  const specialistChoices = specialists && [
    ...specialists,
    ...service.specialists.filter(
      ({ id }) => !specialists.some((specialist) => specialist.id === id),
    ),
  ];

  return (
    <details className={styles.serviceEditor}>
      <summary>Edit {service.name}</summary>
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
          {specialistChoices === null ? (
            <p>Specialists are unavailable. Refresh the page to edit assignments.</p>
          ) : (
            <>
              <input type="hidden" name="editSpecialists" value="true" />
              <ServiceSpecialistChoices
                specialists={specialistChoices}
                selectedIds={specialistIds}
                onToggle={(id, checked) =>
                  setSpecialistIds((previous) =>
                    checked ? [...previous, id] : previous.filter((selected) => selected !== id),
                  )
                }
              />
            </>
          )}
          <button type="submit">{pending ? 'Saving…' : 'Save service'}</button>
        </fieldset>
        {state && <p role={state.saved ? 'status' : 'alert'}>{state.message}</p>}
      </form>
    </details>
  );
}
