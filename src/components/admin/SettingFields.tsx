'use client';
import { normalizePartnerCode } from '@/lib/partnerCode';
import { basicKeys, fieldHelp, fieldLabel, isMoneyField, readableValue, type Tree } from './settingsPresentation';

type Props = { value: Tree; path: string[]; update: (path: string[], value: Tree) => void; partnerRule?: boolean };
const structuredLists = new Set(['productsConfig', 'optionsConfig', 'discountsConfig', 'partnerCodes', 'terms', 'tiers', 'plusBenefits']);
export function SettingFields({ value, path, update, partnerRule = false }: Props) {
  const key = path.at(-1) || '', label = fieldLabel(path), help = fieldHelp(path);
  const helpId = 'help-' + path.join('-');
  const child = (name: string, item: Tree, rule = partnerRule) => <SettingFields key={name} value={item} path={[...path, name]} update={update} partnerRule={rule} />;
  if (Array.isArray(value)) {
    if (!structuredLists.has(key) && value.every(item => typeof item === 'string')) return <label className="block my-4">{label}
      <textarea aria-label={label} aria-describedby={helpId} className="admin-input" rows={Math.max(3, value.length)} placeholder={help.example} value={value.join('\n')} onChange={event => update(path, event.target.value.split('\n'))} />
      <span id={helpId} className="block text-sm text-slate-600 mt-1">{help.description} 예: {help.example}</span>
    </label>;
    function addItem() {
      const id = 'item_' + crypto.randomUUID(); let item: Tree;
      if (key === 'partnerCodes') item = { id, code: '', amount: 50000, active: false };
      else if (key === 'productsConfig') item = { id, name: '새 상품', price: 0, description: '', includedItems: [], active: false, displayOrder: value instanceof Array ? value.length : 0, originalCount: '', retouchedCount: 0, albumSpec: '', shootScope: '' };
      else if (key === 'optionsConfig') item = { id, name: '새 옵션', price: 0, description: '', active: false, displayOrder: Array.isArray(value) ? value.length : 0 };
      else if (key === 'terms') item = { id, title: '새 약관', content: '' };
      else if (key === 'tiers') item = { label: '새 취소 단계', rate: 0 };
      else if (key === 'plusBenefits') item = { title: '추가 구성', detail: '', badge: '' };
      else return;
      update(path, [...value as Tree[], item]);
    }
    return <section className="space-y-4 my-4" aria-label={label}>
      {value.map((item, index) => <div key={typeof item === 'object' && item && !Array.isArray(item) ? String(item.id || index) : index} className="border rounded-lg p-5 bg-white">
        <h3 className="font-semibold mb-3">{typeof item === 'object' && item && !Array.isArray(item) ? String(item.name || item.code || item.title || label + ' ' + (index + 1)) : label}</h3>
        {child(String(index), item, typeof item === 'object' && item && !Array.isArray(item) && typeof item.eligibility === 'object' && item.eligibility !== null && !Array.isArray(item.eligibility) ? item.eligibility.kind === 'partner' : partnerRule)}
      </div>)}
      {['productsConfig', 'optionsConfig', 'partnerCodes', 'terms', 'tiers', 'plusBenefits'].includes(key) && <button type="button" className="admin-button" onClick={addItem}>{key === 'partnerCodes' ? '할인코드 추가' : key === 'productsConfig' ? '상품 추가' : key === 'optionsConfig' ? '옵션 추가' : key === 'terms' ? '약관 추가' : key === 'tiers' ? '취소 단계 추가' : '추가 혜택 추가'}</button>}
      {['productsConfig', 'optionsConfig', 'partnerCodes'].includes(key) && <p className="text-sm text-slate-600">추가한 항목은 사용 안 함으로 시작합니다. 기존 항목은 삭제 대신 사용 안 함으로 바꾸세요.</p>}
    </section>;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value), core = basicKeys(path, value), shown = core ? core.filter(name => keys.includes(name)) : keys;
    const advanced = core ? keys.filter(name => !shown.includes(name)) : [];
    return <fieldset className="min-w-0"><legend className="font-semibold">{path.length > 1 && !['productsConfig', 'optionsConfig', 'partnerCodes'].includes(path[0]) ? label : ''}</legend>
      {shown.map(name => child(name, value[name]))}
      {advanced.length > 0 && <details className="border rounded p-4 my-5 bg-slate-50"><summary className="cursor-pointer font-medium">고급 설정 · 표시 문구와 내부 관리값</summary><p className="text-sm text-slate-600 my-2">보통 처음 설정할 때만 확인합니다. 내부 관리번호는 과거 계약과 연결되어 직접 변경할 수 없습니다.</p>{advanced.map(name => child(name, value[name]))}</details>}
      {path[0] === 'productsConfig' && path.length === 2 && <aside aria-label="상품 표시 예시" className="border-l-4 border-slate-500 p-3 bg-slate-50 text-sm"><strong>고객 표시 예시</strong><p>{String(value.name)} · {readableValue(value.price, [...path, 'price'])}</p><p>{String(value.description || '')}</p><p>원본 {String(value.originalCount || '안내 입력 필요')} / 보정 {String(value.retouchedCount ?? 0)}장</p><p>{String(value.albumSpec || '앨범 안내 입력 필요')}</p><p>{value.active ? '고객 선택 가능' : '신규 고객 선택 안 됨'}</p></aside>}
      {path[0] === 'formSchema' && path.length === 2 && <aside aria-label="입력폼 표시 예시" className="border-l-4 p-3 my-3 text-sm"><strong>고객 표시 예시</strong><p>{value.enabled ? String(value.label) + (value.required ? ' * 필수' : ' (선택)') : '이 입력칸은 숨겨집니다.'}</p>{!!value.enabled && <input disabled className="admin-input" placeholder={String(value.placeholder || '')} aria-label="입력 예시 미리보기" />}</aside>}
    </fieldset>;
  }
  const readonly = ['id', 'studioId', 'contractPrefix', 'driveFolderName', 'kind'].includes(key) || (partnerRule && key === 'amount') || path.join('.') === 'formSchema.weddingHall.enabled';
  const description = partnerRule && key === 'amount' ? '이전 계약과의 호환을 위한 기본값입니다. 신규 할인금액은 아래 할인코드별 금액으로 결정합니다.' : partnerRule && key === 'description' ? '고객에게 안내할 할인코드 설명입니다. 코드마다 금액이 다를 수 있으므로 고정 할인금액이나 짝꿍 성함 입력 안내를 쓰지 마세요.' : help.description;
  const guidance = <span id={helpId} className="block text-sm text-slate-600 mt-1">{description} <span className="block">예: {help.example}</span></span>;
  if (typeof value === 'boolean') return <label className="block my-4"><input aria-label={label} aria-describedby={helpId} type="checkbox" disabled={readonly} checked={value} onChange={event => update(path, event.target.checked)} /> <span className="font-medium">{label}</span> · {readableValue(value, path)}{guidance}{readonly && <span className="block text-sm">계약의 핵심 입력칸으로 숨길 수 없습니다.</span>}</label>;
  if (key === 'logo' || key === 'seal') return <div className="my-4"><label className="font-medium">{label}<input aria-label={label} aria-describedby={helpId} className="admin-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > 300 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { window.alert('PNG/JPEG/WebP 300KB 이하만 업로드할 수 있습니다.'); return; }
    const reader = new FileReader(); reader.onload = () => update(path, String(reader.result)); reader.readAsDataURL(file);
  }} />{guidance}</label>{typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(value) && <img src={value} alt={label + ' 표시 예시'} className="max-h-24 max-w-64 my-2 object-contain" />}</div>;
  if (key === 'type') return <label className="block my-4 font-medium">{label}<select aria-label={label} aria-describedby={helpId} className="admin-input" value={String(value)} onChange={event => update(path, event.target.value)}><option value="immediate">즉시 할인 · 계약금액 차감</option><option value="cashback">추후 Cashback · 계약금액 유지</option></select>{guidance}</label>;
  if (key === 'weekday') return <label className="block my-4 font-medium">{label}<select aria-label={label} aria-describedby={helpId} className="admin-input" value={String(value)} onChange={event => update(path, Number(event.target.value))}>{['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'].map((day, index) => <option value={index} key={day}>{day}</option>)}</select><span id={helpId} className="block text-sm text-slate-600 mt-1">{help.description} 예: 일요일</span></label>;
  if (path.includes('colors')) return <label className="block my-4 font-medium">{label}<input type="color" aria-label={label} aria-describedby={helpId} className="admin-input h-12" value={String(value)} onChange={event => update(path, event.target.value)} />{guidance}<output className="block text-sm mt-1">선택한 색상: {String(value)}</output></label>;
  const numeric = typeof value === 'number' || key === 'rate';
  const multiline = !numeric && !readonly && (String(value ?? '').length > 100 || ['content', 'description', 'notice', 'privacyNotice', 'businessInformation'].includes(key));
  return <label className="block my-4 font-medium">{label}{multiline ? <textarea className="admin-input" aria-label={label} aria-describedby={helpId} placeholder={help.example} rows={4} value={String(value ?? '')} onChange={event => update(path, event.target.value)} /> : <input className="admin-input" aria-label={label} aria-describedby={helpId} type={numeric ? 'number' : 'text'} min={numeric ? 0 : undefined} step={numeric ? 1 : undefined} readOnly={readonly} placeholder={help.example} value={value === null ? '' : String(value)} onChange={event => update(path, numeric ? event.target.value === '' && key === 'rate' ? null : Number(event.target.value) : event.target.value)} />}{guidance}
    {numeric && <output className="block mt-1 text-sm font-semibold" aria-live="polite">{readableValue(value, path)}{isMoneyField(path) && typeof value === 'number' && value >= 10000 ? ' · ' + (value / 10000).toLocaleString('ko-KR') + '만원' : ''}</output>}
    {key === 'code' && <output className="block mt-1 text-sm">저장할 코드: {normalizePartnerCode(String(value || '')) || '입력 필요'}</output>}
    {path.includes('colors') && typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) && <span aria-label="색상 표시 예시" className="block w-16 h-6 rounded border mt-2" style={{ backgroundColor: value }} />}
  </label>;
}
