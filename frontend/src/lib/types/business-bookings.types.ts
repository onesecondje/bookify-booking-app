export type BusinessBooking = {
  id: string;
  startsAt: string;
  endsAt: string;
  cancelledAt: string | null;
  customerName: string | null;
  customerPhone: string | null;
  service: { id: string; name: string };
  specialist: { id: string; name: string };
};
