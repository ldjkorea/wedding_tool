export interface SheetSyncJob {
  contractId: string;
  contractNumber: string;
  status: 'pending' | 'failed' | 'unknown';
  errorCode: string;
  queuedAt: string;
  lastAttemptAt: string;
}
export interface SheetIntegrationStatus {
  revision: number;
  enabled: boolean;
  connection: 'disabled' | 'disconnected' | 'connected' | 'error';
  name: string;
  url: string;
  createdAt: string;
  errorCode: string;
  counts: { pending: number; failed: number; unknown: number; synced: number };
  jobs: SheetSyncJob[];
  nextCursor: string | null;
  demo: boolean;
  workerReady: boolean;
}
