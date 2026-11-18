import type { AvailabilityLoadStatus } from '../../enums/availability-load-status.enum';

export type AvailabilitySlot = { startsAt: string; endsAt: string };

export type Availability = {
  date: string;
  timeZone: string;
  slots: AvailabilitySlot[];
  unresolvedPeriodCount: number;
};

export type AvailabilityResult =
  | { status: AvailabilityLoadStatus.Ready; availability: Availability }
  | { status: Exclude<AvailabilityLoadStatus, AvailabilityLoadStatus.Ready> };
