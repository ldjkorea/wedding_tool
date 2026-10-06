import { isDemoMode } from '@/lib/serverConfig';
import type { OwnerBooking } from '@/types/ownerBooking';

export function projectOwnerBookings(result: Record<string, unknown>) {
    const rows = result.bookings as OwnerBooking[];
    if (
      !Array.isArray(rows) ||
      (!isDemoMode() && rows.length > 30) ||
      (result.nextCursor !== null &&
        (typeof result.nextCursor !== 'string' || result.nextCursor.length > 2000)) ||
      rows.some(
        (row) =>
          !row ||
          [
            'contractId',
            'contractNumber',
            'weddingDate',
            'weddingTime',
            'weddingVenue',
            'weddingHall',
            'groomName',
            'brideName',
            'productName',
          ].some((key) => typeof row[key as keyof OwnerBooking] !== 'string') ||
          !/^cnt_[a-zA-Z0-9_-]{1,100}$/.test(row.contractId) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(row.weddingDate) ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.weddingTime) ||
          !['submitted', 'approved', 'sent'].includes(row.status) ||
          !Number.isSafeInteger(row.contractTotal) ||
          row.contractTotal < 0,
      )
    )
      throw new Error('예약 목록 응답 오류');
    // Explicit public-to-Owner projection: no token, email, phone, or whole Record.
    const bookings = rows.map((row) => ({
      contractId: row.contractId,
      contractNumber: row.contractNumber,
      weddingDate: row.weddingDate,
      weddingTime: row.weddingTime,
      weddingVenue: row.weddingVenue,
      weddingHall: row.weddingHall,
      groomName: row.groomName,
      brideName: row.brideName,
      productName: row.productName,
      contractTotal: row.contractTotal,
      status: row.status,
      calendarStatus: ['disabled', 'pending', 'working', 'synced', 'failed', 'unknown'].includes(
        row.calendarStatus,
      )
        ? row.calendarStatus
        : 'unknown',
    }));
    return { success: true, bookings, nextCursor: result.nextCursor, demo: isDemoMode() };
}
