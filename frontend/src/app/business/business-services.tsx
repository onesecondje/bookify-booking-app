import styles from './business-bookings.module.css';
import { ServiceCreateForm } from './service-create-form';
import { ServiceEditForm } from './service-edit-form';
import type { BusinessServicesProps } from './types/business-services.types';

export function BusinessServices({ services, specialists }: BusinessServicesProps) {
  return (
    <section className={styles.services} aria-labelledby="business-services-title">
      <h2 id="business-services-title">Services</h2>
      {specialists === null ? (
        <p role="status">Specialists are unavailable. Refresh the page to create a service.</p>
      ) : specialists.length === 0 ? (
        <p>An active specialist is required to create a service.</p>
      ) : (
        <ServiceCreateForm specialists={specialists} />
      )}
      {services === null ? (
        <p role="status">Services are unavailable. Refresh the page to try again.</p>
      ) : services.length === 0 ? (
        <p>No services yet.</p>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.table} aria-labelledby="business-services-title">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Duration</th>
                <th scope="col">Status</th>
                <th scope="col">Assigned specialists</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id}>
                  <th scope="row">{service.name}</th>
                  <td>{service.durationMinutes} min</td>
                  <td>{service.isActive ? 'Active' : 'Inactive'}</td>
                  <td>
                    {service.specialists.length
                      ? service.specialists
                          .map(({ name, isActive }) => (isActive ? name : `${name} (inactive)`))
                          .join(', ')
                      : 'Unassigned'}
                  </td>
                  <td>
                    <ServiceEditForm
                      serviceId={service.id}
                      initialValues={{
                        name: service.name,
                        durationMinutes: service.durationMinutes,
                        isActive: service.isActive,
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
