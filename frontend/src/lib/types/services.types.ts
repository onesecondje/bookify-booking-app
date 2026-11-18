import type { CatalogueLoadStatus } from '../../enums/catalogue-load-status.enum';

export type ServiceSummary = {
  id: string;
  name: string;
  durationMinutes: number;
};

export type CatalogueResult =
  | { status: CatalogueLoadStatus.Ready; services: ServiceSummary[] }
  | { status: CatalogueLoadStatus.NotFound }
  | { status: CatalogueLoadStatus.Unavailable };
