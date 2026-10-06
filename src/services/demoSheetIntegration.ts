import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { isDemoMode } from '@/lib/serverConfig';
import { demoSettingsCall } from './demoStudioSettings';
import type { SheetIntegrationStatus, SheetSyncJob } from '@/types/sheetIntegration';
import type { ContractSnapshot, ContractFormData, PriceCalculationResult } from '@/types/contract';

export interface DemoSheetRecord { contractId: string; contractNumber: string; studioId: string; formData: ContractFormData; pricing: PriceCalculationResult; submittedAt: string; snapshot?: ContractSnapshot }
function demoProjection(record: DemoSheetRecord) {
  const data = record.snapshot?.data || record.formData, price = record.snapshot?.pricing || record.pricing;
  return { contractId: record.contractId, contractNumber: record.contractNumber, submittedAt: record.submittedAt,
    weddingDate: data.weddingDate, weddingTime: data.weddingTime, weddingVenue: data.weddingVenue, weddingHall: data.weddingHall,
    groomName: data.groomName, brideName: data.brideName, phone: data.groomPhone || data.bridePhone, email: data.email,
    product: record.snapshot?.product?.name || price.breakdown.find(line => line.category === 'base')?.name || '',
    options: price.breakdown.filter(line => line.category === 'option').map(line => line.name),
    discounts: price.breakdown.filter(line => ['immediate_discount','manual_adjustment'].includes(line.category)).map(line => ({name:line.name,amount:line.amount})),
    code: data.partnerDiscount ? data.partnerName : '', contractTotal: price.contractTotal, depositAmount: price.depositAmount,
    balanceAmount: price.balanceAmount, futureCashback: price.futureCashbackTotal, status: record.snapshot?.status || 'submitted',
    approvedAt: record.snapshot?.approvedAt || '', sentAt: record.snapshot?.sentAt || '' };
}
type DemoRow = ReturnType<typeof demoProjection>;
type State = { revision: number; enabled: boolean; name: string; createdAt: string; rows: Record<string, DemoRow>; jobs: Record<string, SheetSyncJob>; source: Record<string, DemoRow> };
let queue: Promise<unknown> = Promise.resolve();
function transaction<T>(studioId: string, task: (state: State) => T) {
  if (!isDemoMode() || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(studioId)) throw new Error('Explicit local Demo required');
  const file = path.resolve(process.env.STUDIO_DEMO_SETTINGS_TEST_DIRECTORY || '.studio-settings-demo', studioId + '-sheet-mirror.json');
  const result = queue.then(async () => {
    let state: State;
    try { state = JSON.parse(readFileSync(file,'utf8')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; state = { revision: 0, enabled: false, name: '', createdAt: '', rows: {}, jobs: {}, source: {} }; }
    const response = task(state);
    await fs.mkdir(path.dirname(file),{recursive:true}); const temporary = file+'.'+crypto.randomUUID()+'.tmp';
    await fs.writeFile(temporary,JSON.stringify(state),{mode:0o600}); await fs.rename(temporary,file);
    return response;
  }); queue = result.catch(()=>{}); return result;
}
function status(state: State): SheetIntegrationStatus {
  const counts = { pending:0,failed:0,unknown:0,synced:Object.keys(state.rows).length };
  const jobs = Object.values(state.jobs); jobs.forEach(job => counts[job.status]++);
  return { revision:state.revision,enabled:state.enabled,connection:!state.enabled?'disabled':!state.name?'disconnected':jobs.some(job=>job.status!=='pending')?'error':'connected',
    name:state.name,url:'',createdAt:state.createdAt,errorCode:'',counts,jobs:jobs.slice(0,30),nextCursor:null,demo:true,workerReady:true };
}
export async function demoSheetCall(action: string, payload: Record<string,unknown>) {
  const studioId = String(payload.studioId);
  const auth = await demoSettingsCall('admin_session', payload);
  const head = await demoSettingsCall(auth.role === 'owner' ? 'owner_read' : 'settings_read', payload);
  const displayName = (head.current as import('@/types/studioSettings').SettingsRevision | null)?.settings.studioConfig.displayName || payload.displayName;
  return transaction(studioId,state=>{
    if (action==='sheet_toggle') {
      if (payload.expectedRevision!==state.revision) throw Object.assign(new Error('Conflict'),{code:'SETTINGS_CONFLICT'});
      if (typeof payload.enabled!=='boolean') throw new Error('Invalid enabled');
      state.enabled=payload.enabled; state.revision++;
    } else if (action==='sheet_create') {
      if (!state.enabled) throw new Error('Integration disabled');
      if (!state.name) { if (payload.expectedRevision!==state.revision) throw Object.assign(new Error('Conflict'),{code:'SETTINGS_CONFLICT'}); state.name=String(displayName)+' 계약관리';state.createdAt=new Date().toISOString();state.revision++; }
    } else if (action==='sheet_read') {
      if (!state.name) throw new Error('No Sheet');
      return {success:true,integration:{...status(state),previewRows:Object.values(state.rows).slice(0,50).map(row=>[row.contractNumber,row.weddingDate,row.groomName,row.brideName,row.product,String(row.contractTotal),row.status])}};
    } else if (action==='sheet_sync') {
      if (!state.enabled || !state.name) throw new Error('Integration disabled');
      for (const [id,row] of Object.entries(state.source)) {state.rows[id]=row;delete state.jobs[id];}
      return {success:true,integration:{...status(state),queuedCount:Object.keys(state.source).length,syncCursor:null}};
    } else if (action==='sheet_retry') {
      const id=String(payload.contractId); if (!state.enabled || !state.name || !state.jobs[id] || !state.source[id]) throw new Error('No retryable local mirror job');
      state.rows[id]=state.source[id];delete state.jobs[id];
    } else if (action!=='sheet_status') throw new Error('Unknown integration action');
    return {success:true,integration:status(state)};
  });
}
/** Only fake local I/O. Demo never creates a Google file or starts a real GAS trigger. */
export async function mirrorDemoContract(record: DemoSheetRecord) {
  try {
    await transaction(record.studioId,state=>{
      if (!state.enabled) return;
      state.source[record.contractId]=demoProjection(record);
      if (state.name) { state.rows[record.contractId]=state.source[record.contractId];delete state.jobs[record.contractId]; }
      else state.jobs[record.contractId]={contractId:record.contractId,contractNumber:record.contractNumber,status:'failed',errorCode:'CONNECTION_MISSING',queuedAt:new Date().toISOString(),lastAttemptAt:''};
    });
  } catch { /* Local mirror failure never changes the Demo contract result. */ }
}
