import type { SheetSyncJob } from './sheetIntegration';
export interface CalendarIntegrationStatus {
  revision: number; enabled: boolean; durationMinutes: number; timezone: 'Asia/Seoul';
  connection: 'disabled' | 'disconnected' | 'connected' | 'missing' | 'error';
  name: string; url: string; createdAt: string; errorCode: string; demo: boolean; workerReady: boolean;
  counts: { pending: number; failed: number; unknown: number; synced: number }; jobs: SheetSyncJob[]; nextCursor: string | null;
  diagnostics?: { calendarIdHint: string; cycle: number; creationState: string };
}
