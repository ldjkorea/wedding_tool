export interface OwnerBooking {
  contractId: string;
  contractNumber: string;
  weddingDate: string;
  weddingTime: string;
  weddingVenue: string;
  weddingHall: string;
  groomName: string;
  brideName: string;
  productName: string;
  contractTotal: number;
  status: 'submitted' | 'approved' | 'sent';
  calendarStatus: 'disabled' | 'pending' | 'working' | 'synced' | 'failed' | 'unknown';
}
