import type { SpecialistsLoadStatus } from '../../enums/specialists-load-status.enum';

export type SpecialistSummary = {
  id: string;
  name: string;
};

export type SpecialistsResult =
  | { status: SpecialistsLoadStatus.Ready; specialists: SpecialistSummary[] }
  | {
      status:
        | SpecialistsLoadStatus.InvalidServiceId
        | SpecialistsLoadStatus.BusinessNotFound
        | SpecialistsLoadStatus.ServiceNotFound
        | SpecialistsLoadStatus.Unavailable;
    };
