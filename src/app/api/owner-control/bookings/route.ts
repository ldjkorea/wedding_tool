import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminHeaders, adminError } from '@/services/adminAuthentication';
import { signedGasCall } from '@/services/gasTransport';
import { isDemoMode } from '@/lib/serverConfig';
import { MockBackendAdapter } from '@/services/mockBackendAdapter';
import type { OwnerBooking } from '@/types/ownerBooking';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;
export async function GET(req: NextRequest) {
  try {
    const sessionId = await requireAdmin(req, 'owner');
    const cursor = req.nextUrl.searchParams.get('cursor');
    if (cursor && cursor.length > 2000)
      throw new Error('설정 검증: 목록 조회 정보를 확인해 주세요.');
    const result = isDemoMode()
      ? { bookings: await MockBackendAdapter.ownerBookings(sessionId), nextCursor: null }
      : await signedGasCall('owner_bookings', { sessionId, ...(cursor ? { cursor } : {}) });
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
    return NextResponse.json(
      { success: true, bookings, nextCursor: result.nextCursor, demo: isDemoMode() },
      { headers: adminHeaders },
    );
  } catch (error) {
    return adminError(error);
  }
}
