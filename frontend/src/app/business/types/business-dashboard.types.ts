export interface BusinessDashboardProps {
  searchParams: Promise<{ specialistId?: string | string[]; bookingStatus?: string | string[] }>;
}
