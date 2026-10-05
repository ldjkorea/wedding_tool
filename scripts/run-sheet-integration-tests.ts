import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { installGasHarness } from './test-support/gasHarness';
import { installSheetHarness } from './test-support/sheetHarness';
import { GET,PUT,POST } from '../src/app/api/studio-control/sheet-integration/route';
import { POST as login } from '../src/app/api/studio-control/auth/route';
import { POST as submit } from '../src/app/api/submit-contract/route';
import { GET as review } from '../src/app/api/review-contract/route';
import { POST as approve } from '../src/app/api/approve-and-send/route';
import { withRuntimeConfiguration } from '../src/services/serverRuntimeConfiguration';
import { configurationBinding,snapshotBinding } from '../src/lib/contractWorkflow';
import { getProducts,getOptions,getClientContent,getStudioConfig } from '../src/services/configuration';
import { signedGasCall } from '../src/services/gasTransport';

const h=installGasHarness(), sheets=installSheetHarness(h.context);
process.env.STUDIO_SETTINGS_ENABLED='true';
const password=crypto.randomBytes(24).toString('base64'),salt=crypto.randomBytes(16);
process.env.STUDIO_ADMIN_PASSWORD_HASH='scrypt$16384$8$1$'+salt.toString('hex')+'$'+crypto.scryptSync(password,salt,64).toString('hex');
const root=path.resolve(process.env.SHEETS_ARTIFACT_DIR||'.contract-test-output/sheets');fs.mkdirSync(root,{recursive:true});
const results:{name:string;status:string;error?:string}[]=[];let cookie='',id='',token='',snapshot:any,config:any;
const form={...h.form,productId:getProducts().at(-1)!.id,optionIds:getOptions().filter(option=>option.active).map(option=>option.id),referralSource:getClientContent().referralOptions[0],shootRequestNotes:'Sheet fixture'};
const req=(method='GET',body?:unknown,auth=true)=>new NextRequest('https://booking.fixture.com/api/studio-control/sheet-integration',{method,headers:{'Content-Type':'application/json',Origin:'https://booking.fixture.com',...(auth?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
async function status(){const response=await GET(req());assert.equal(response.status,200);return(await response.json()).integration;}
async function toggle(enabled:boolean){const current=await status();const response=await PUT(req('PUT',{enabled,expectedRevision:current.revision}));assert.equal(response.status,200);return(await response.json()).integration;}
async function create(){const current=await status();return POST(req('POST',{operation:'create',expectedRevision:current.revision}));}
async function sendForm(data:any){const request=h.request('/api/submit-contract',data);request.headers.set('X-Contract-Configuration',await withRuntimeConfiguration(async()=>configurationBinding()));return submit(request);}
async function finish(contractToken:string,changes?:any){const response=await approve(h.request('/api/approve-and-send',{token:contractToken,phase:'prepare',expectedRevision:1,...(changes?{updatedData:changes}:{})}));assert.equal(response.status,200);const value=await response.json();return approve(h.request('/api/approve-and-send',{token:contractToken,phase:'send',snapshotHash:value.snapshotHash,pdfBase64:h.pdf(value.snapshotHash)}));}
async function test(name:string,task:()=>void|Promise<void>){try{await task();results.push({name,status:'passed'});console.log('PASS '+name);}catch(error){results.push({name,status:'failed',error:String(error)});throw error;}}
async function main(){
  await test('Anonymous and cross-site integration requests are blocked',async()=>{
    for(const response of[await GET(req('GET',undefined,false)),await PUT(req('PUT',{enabled:true,expectedRevision:0},false)),await POST(req('POST',{operation:'create',expectedRevision:0},false))])assert.equal(response.status,401);
    const response=await login(new NextRequest('https://booking.fixture.com/api/studio-control/auth',{method:'POST',headers:{Origin:'https://booking.fixture.com','Content-Type':'application/json'},body:JSON.stringify({password})}));assert.equal(response.status,200);cookie=response.headers.get('set-cookie')!.split(';')[0];
    const bad=req('PUT',{enabled:true,expectedRevision:0});bad.headers.set('Origin','https://evil.fixture');assert.equal((await PUT(bad)).status,502);
  });
  await test('OFF needs no Sheet configuration; full contract/PDF/emails work without Sheets calls',async()=>{
    assert.equal((await status()).enabled,false);const before=sheets.calls.length;const response=await sendForm({...form,email:'off@example.com'});assert.equal(response.status,200);const body=await response.json();assert.ok(!h.stored(body.contractId).sheetSync);const offToken=h.reviewToken();assert.equal((await review(new NextRequest('https://booking.fixture.com/api/review-contract?token='+encodeURIComponent(offToken)))).status,200);assert.equal((await finish(offToken)).status,200);h.context.contractSheetWorker();assert.equal(sheets.calls.length,before);assert.equal(h.deliveries.filter(mail=>mail.options.attachments).length,2);
  });
  await test('ON starts one worker and remains disconnected without changing business binding',async()=>{
    const binding=await withRuntimeConfiguration(async()=>configurationBinding());config=await toggle(true);assert.equal(config.connection,'disconnected');assert.equal(sheets.triggers.length,1);assert.equal(await withRuntimeConfiguration(async()=>configurationBinding()),binding);
  });
  await test('Lost create response is reconciled to one private Sheet with Korean headers and formatting',async()=>{
    sheets.fault('create-after');assert.notEqual((await create()).status,200);assert.equal(sheets.creations,1);sheets.fault('');assert.equal((await create()).status,200);assert.equal((await create()).status,200);assert.equal(sheets.creations,1);const book=sheets.book();assert.equal(book.sharing,'private');assert.equal(book.frozen,1);assert.equal(book.hidden,24);assert.ok(book.filter);assert.equal(book.cells[0].length,24);assert.deepEqual(book.cells[0].slice(14,18),['계약금액','계약금','잔금','추후 캐시백']);assert.equal(book.cells[0][0],'계약번호');config=await status();assert.equal(config.connection,'connected');
  });
  await test('Submission persists queue before worker; customer request never calls Sheets',async()=>{
    const before=sheets.calls.length,response=await sendForm(form);assert.equal(response.status,200);id=(await response.json()).contractId;token=h.reviewToken();assert.equal(h.stored(id).sheetSync.status,'pending');assert.equal(sheets.calls.length,before);h.context.contractSheetWorker();assert.equal(h.stored(id).sheetSync.status,'synced');const row=sheets.book().cells[1];assert.equal(row[23],id);assert.equal(row[18],'접수');assert.equal(row[14],h.stored(id).pricing.contractTotal);assert.ok(sheets.book().formats.includes('#,##0"원"'));
  });
  await test('Duplicate submit and worker retries use the same ID and one logical row',async()=>{
    const response=await sendForm(form);assert.equal((await response.json()).contractId,id);h.context.contractSheetWorker();assert.equal(sheets.book().cells.length,2);
  });
  await test('Review GET never sends or updates Sheet; owner edits update same row from Snapshot',async()=>{
    const before=sheets.calls.length,count=h.deliveries.length;assert.equal((await review(new NextRequest('https://booking.fixture.com/api/review-contract?token='+encodeURIComponent(token)))).status,200);assert.equal(sheets.calls.length,before);assert.equal(h.deliveries.length,count);
    const response=await approve(h.request('/api/approve-and-send',{token,phase:'prepare',expectedRevision:1,updatedData:{...form,productId:getProducts()[0].id,optionIds:[],manualAdjustment:{amount:20000,reason:'Fixture'}}}));assert.equal(response.status,200);snapshot=(await response.json()).snapshot;assert.equal(h.stored(id).sheetSync.status,'pending');h.context.contractSheetWorker();assert.equal(sheets.book().cells.length,2);const row=sheets.book().cells[1];assert.equal(row[10],snapshot.product.name);assert.equal(row[11],'');assert.equal(row[14],snapshot.pricing.contractTotal);assert.equal(row[15],snapshot.pricing.depositAmount);assert.equal(row[16],snapshot.pricing.balanceAmount);assert.equal(row[18],'대표 확인 완료');
  });
  await test('Sheet write fails independently after both final emails and PDF storage succeed',async()=>{
    sheets.fault('write-before');const hash=snapshotBinding(snapshot);const before=sheets.calls.length;const response=await approve(h.request('/api/approve-and-send',{token,phase:'send',snapshotHash:hash,pdfBase64:h.pdf(hash)}));assert.equal(response.status,200);assert.equal(sheets.calls.length,before);h.context.contractSheetWorker();assert.equal(h.stored(id).status,'sent');assert.equal(h.stored(id).sheetSync.status,'unknown');assert.equal((await status()).counts.unknown,1);assert.ok(h.stored(id).pdfFileId);assert.equal(sheets.book().cells.length,2);
  });
  await test('Admin retry does not send email; lost write receipt never duplicates row',async()=>{
    const mailCount=h.deliveries.length;sheets.fault('');assert.equal((await POST(req('POST',{operation:'retry',contractId:id}))).status,200);sheets.fault('write-after');h.context.contractSheetWorker();assert.equal(h.stored(id).sheetSync.status,'unknown');sheets.fault('');assert.equal((await POST(req('POST',{operation:'retry',contractId:id}))).status,200);h.context.contractSheetWorker();assert.equal(h.deliveries.length,mailCount);assert.equal(sheets.book().cells.length,2);const row=sheets.book().cells[1];assert.equal(row[18],'계약 완료');assert.equal(row[20],'발송 완료');assert.ok(row[22]);assert.equal(row[14],snapshot.pricing.contractTotal);
  });
  await test('Edited contract number/hidden ID and renamed file/tab do not change row identity or Core',async()=>{
    const book=sheets.book(),original=h.stored(id),frozen=JSON.stringify(original.snapshot);book.cells[1][0]='human-edited';book.cells[1][23]='human-edited-id';book.name='운영자 변경 이름';book.tabName='바뀐 탭';h.context.queueContractSheet(original);const file=[...h.files.values()].find(file=>file.name===id+'.json')!;file.bytes=Buffer.from(JSON.stringify(original));h.context.contractSheetWorker();assert.equal(book.cells.length,2);assert.equal(book.cells[1][0],original.contractNumber);assert.equal(book.cells[1][23],id);assert.equal((await status()).name,book.name);assert.equal(JSON.stringify(h.stored(id).snapshot),frozen);
  });
  await test('Missing row is restored from frozen Snapshot without current catalog repricing',async()=>{
    sheets.deleteRow(2);const stored=h.stored(id);h.context.queueContractSheet(stored);const file=[...h.files.values()].find(file=>file.name===id+'.json')!;file.bytes=Buffer.from(JSON.stringify(stored));h.context.contractSheetWorker();assert.equal(sheets.book().cells.length,2);assert.equal(sheets.book().cells[1][14],snapshot.pricing.contractTotal);assert.equal(sheets.book().cells[1][10],snapshot.product.name);
  });
  await test('Permission/deletion/public sharing/malformed header failures never alter sent Snapshot',async()=>{
    const frozen=JSON.stringify(h.stored(id).snapshot),book=sheets.book();
    for(const fault of['permission','deleted','public','header','flush']){
      sheets.fault(fault==='permission'||fault==='flush'?fault:'');book.trashed=fault==='deleted';book.sharing=fault==='public'?'anyone':'private';book.cells[0][0]=fault==='header'?'bad header':'계약번호';const stored=h.stored(id);h.context.queueContractSheet(stored);[...h.files.values()].find(file=>file.name===id+'.json')!.bytes=Buffer.from(JSON.stringify(stored));h.context.contractSheetWorker();assert.equal(h.stored(id).sheetSync.status,fault==='flush'?'unknown':'failed');assert.equal(h.stored(id).status,'sent');assert.equal(JSON.stringify(h.stored(id).snapshot),frozen);
    }sheets.fault('');book.trashed=false;book.sharing='private';book.cells[0][0]='계약번호';
  });
  await test('Unknown durable worker marker survives a lost final record save and is safely recoverable',async()=>{
    await POST(req('POST',{operation:'retry',contractId:id}));h.writeFailure(record=>record.contractId===id&&record.sheetSync?.status==='synced');h.context.contractSheetWorker();assert.equal(h.stored(id).sheetSync.status,'working');assert.equal((await status()).counts.unknown,1);h.writeFailure();h.context.contractSheetWorker();assert.equal(h.stored(id).sheetSync.status,'synced');assert.equal(sheets.book().cells.length,2);
  });
  await test('OFF keeps existing Sheet and pauses automatic work without blocking pending contract',async()=>{
    const pending=await sendForm({...form,email:'pending@example.com'});const pendingId=(await pending.json()).contractId,pendingToken=h.reviewToken(),before=sheets.calls.length;await toggle(false);const afterToggle=sheets.calls.length;h.context.contractSheetWorker();assert.equal(sheets.calls.length,afterToggle);assert.ok(sheets.book());assert.equal(h.stored(pendingId).sheetSync.status,'pending');assert.equal((await finish(pendingToken)).status,200);assert.equal(sheets.calls.length,afterToggle);assert.ok(afterToggle>=before);
  });
  await test('Formula injection is escaped; operational row contains no bearer/secret/internal payload',async()=>{
    await toggle(true);const data={...form,email:'formula@example.com',groomName:'=IMPORTXML("evil")',requestNotes:'PRIVATE-NOTE-MARKER',instagramId:'PRIVATE-SNS-MARKER'};assert.equal((await sendForm(data)).status,200);h.context.contractSheetWorker();h.context.contractSheetWorker();const rows=sheets.book().cells.slice(1);assert.ok(rows.some(row=>row[6]==='\'=IMPORTXML("evil")'));const text=JSON.stringify(rows);for(const value of[token,process.env.APP_SECRET,h.secret,'PRIVATE-NOTE-MARKER','PRIVATE-SNS-MARKER','tokenHash','snapshotHash'])assert.ok(!text.includes(value!));
  });
  await test('Customer runtime and contract responses exclude private integration identifiers',async()=>{
    const runtime=JSON.stringify(await signedGasCall('settings_runtime',{}));assert.ok(!runtime.includes(sheets.book().id));assert.ok(!runtime.includes('sheetSync'));const response=await review(new NextRequest('https://booking.fixture.com/api/review-contract?token='+encodeURIComponent(token)));assert.equal(response.status,200);const text=JSON.stringify(await response.json());assert.ok(!text.includes(sheets.book().id));assert.ok(!text.includes('sheetSync'));
  });
  await test('Stale integration revision/cross-studio retry/unsupported input are rejected',async()=>{
    assert.equal((await PUT(req('PUT',{enabled:false,expectedRevision:0}))).status,409);assert.equal((await PUT(req('PUT',{enabled:false,expectedRevision:(await status()).revision,sheetId:'injected'}))).status,400);assert.notEqual((await POST(req('POST',{operation:'retry',contractId:'cnt_unknown'}))).status,200);assert.equal((await POST(req('POST',{operation:'rebuild'}))).status,400);
  });
  await test('Sheets I/O releases the Core lock and an in-flight old result cannot acknowledge a newer queue generation',async()=>{
    const stored=h.stored(id);h.context.queueContractSheet(stored);[...h.files.values()].find(file=>file.name===id+'.json')!.bytes=Buffer.from(JSON.stringify(stored));
    let checked=false;
    sheets.duringWrite(()=>{
      assert.equal(h.lockHeld(),false);if(checked)return;checked=true;
      const newest=h.stored(id);h.context.queueContractSheet(newest);[...h.files.values()].find(file=>file.name===id+'.json')!.bytes=Buffer.from(JSON.stringify(newest));
      const action='review_contract',payloadJson=JSON.stringify({studioId:getStudioConfig().studioId,contractId:id,tokenHash:newest.tokenHash}),timestamp=Date.now(),nonce=crypto.randomUUID();
      const signature=crypto.createHmac('sha256',h.secret).update(timestamp+'\n'+nonce+'\n'+action+'\n'+payloadJson).digest('hex');
      assert.equal(h.gas({action,payloadJson,timestamp,nonce,signature}).success,true);
    });
    h.context.contractSheetWorker();sheets.duringWrite();assert.ok(checked);assert.equal(h.stored(id).sheetSync.status,'pending');h.context.contractSheetWorker();assert.equal(h.stored(id).sheetSync.status,'synced');
  });
  await test('Duplicated system identifier fails closed instead of overwriting another row',async()=>{
    const book=sheets.book();book.cells.push([...book.cells[1]]);const stored=h.stored(id);h.context.queueContractSheet(stored);[...h.files.values()].find(file=>file.name===id+'.json')!.bytes=Buffer.from(JSON.stringify(stored));h.context.contractSheetWorker();assert.equal(h.stored(id).sheetSync.errorCode,'DUPLICATE_ROW');assert.equal(h.stored(id).sheetSync.status,'failed');book.cells.pop();await POST(req('POST',{operation:'retry',contractId:id}));h.context.contractSheetWorker();assert.equal(h.stored(id).sheetSync.status,'synced');
  });
  await test('Business catalog changes never reprice a previously sent mirror or invalidate its Snapshot',async()=>{
    const old=h.stored(id),frozen=JSON.stringify(old.snapshot);const current=h.seedPartnerCodes([]),sessionId=crypto.randomBytes(32).toString('hex');
    const settings=JSON.parse(JSON.stringify(current.settings));settings.productsConfig.forEach((product:any)=>{product.price+=800000;});
    h.context.settingsAction('admin_login',{studioId:getStudioConfig().studioId,sessionId});h.context.settingsAction('settings_save',{studioId:getStudioConfig().studioId,sessionId,expectedRevision:current.revision,settings,hash:crypto.createHash('sha256').update(JSON.stringify(settings)).digest('hex')});
    h.context.queueContractSheet(old);[...h.files.values()].find(file=>file.name===id+'.json')!.bytes=Buffer.from(JSON.stringify(old));h.context.contractSheetWorker();assert.equal(sheets.book().cells[1][14],snapshot.pricing.contractTotal);assert.equal(JSON.stringify(h.stored(id).snapshot),frozen);
  });
  await test('Paginated admin status covers every queued contract without exposing full records',async()=>{
    for(let index=0;index<34;index++)assert.equal((await sendForm({...form,email:'page-'+index+'@example.com'})).status,200);
    let cursor:string|null=null,total=0;const ids:string[]=[];
    do{const request=req();if(cursor)request.nextUrl.searchParams.set('cursor',cursor);const response=await GET(request);assert.equal(response.status,200);const value=(await response.json()).integration;total+=value.counts.pending;ids.push(...value.jobs.map((job:any)=>job.contractId));assert.ok(!JSON.stringify(value).includes('tokenHash'));cursor=value.nextCursor;}while(cursor);
    assert.ok(total>=34);assert.equal(new Set(ids).size,ids.length);
  });
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{h.restore();fs.writeFileSync(path.join(root,'sheet-results.json'),JSON.stringify({results,passed:results.filter(result=>result.status==='passed').length,failed:results.filter(result=>result.status==='failed').length,realCodeGs:true,liveGoogleIO:false,distributedLockVerified:false},null,2));});
