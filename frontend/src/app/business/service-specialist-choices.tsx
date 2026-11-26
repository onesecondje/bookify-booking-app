import styles from './business-bookings.module.css';
import type { ServiceSpecialistChoicesProps } from './types/business-services.types';

export function ServiceSpecialistChoices({
  specialists,
  selectedIds,
  onToggle,
}: ServiceSpecialistChoicesProps) {
  return (
    <fieldset className={styles.specialistChoices}>
      <legend>Specialists</legend>
      {specialists.length === 0 && <p>No specialists available.</p>}
      {specialists.map(({ id, name, isActive }) => (
        <label key={id}>
          <input
            type="checkbox"
            name="specialistIds"
            value={id}
            checked={selectedIds.includes(id)}
            onChange={(event) => onToggle(id, event.target.checked)}
          />
          {isActive ? name : `${name} (inactive)`}
        </label>
      ))}
    </fieldset>
  );
}
