'use client';
import { useState } from 'react';
import { formatKRW } from '@/lib/pricing';
import type { OwnerSettings } from '@/types/ownerSettings';

type List = keyof OwnerSettings;
export const ownerMenus = [
  ['products', '상품 및 가격', '상품 이름, 가격, 제공 내용을 관리합니다.'],
  ['options', '추가 옵션', '폐백, 2인 촬영 등 추가 옵션을 관리합니다.'],
  ['discounts', '할인 및 혜택', '예식일 할인, 사진 사용 혜택과 후기 캐시백을 관리합니다.'],
  ['codes', '할인코드', '고객이 입력하면 자동 적용되는 코드를 관리합니다.'],
  ['calendar', '촬영 일정', '승인된 계약을 Google Calendar에 등록할지 선택합니다.'],
  ['sheets', '계약목록', 'Google Sheets에 계약 목록을 정리할지 선택합니다.'],
] as const;
export function OwnerField({ label, help, value, change, money = false, number = false, multiline = false, placeholder = '' }: {
  label: string; help: string; value: string | number; change: (value: string | number) => void;
  money?: boolean; number?: boolean; multiline?: boolean; placeholder?: string;
}) {
  const invalid = (money || number) && (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 100000000);
  return <label className="block"><span className="font-medium">{label}</span><span className="block mt-1 text-sm text-slate-600">{help}</span>
    {multiline ? <textarea className="owner-input" aria-label={label} value={value} placeholder={placeholder} rows={3} onChange={event => change(event.target.value)} /> :
      <input className="owner-input" aria-label={label} aria-invalid={invalid} type={money || number ? 'number' : 'text'} min={money || number ? 0 : undefined} max={money || number ? 100000000 : undefined} step={money || number ? 1 : undefined} value={Number.isNaN(value) ? '' : value} placeholder={placeholder} onChange={event => change(money || number ? event.target.value === '' ? NaN : Number(event.target.value) : event.target.value)} />}
    {invalid && <span role="alert" className="block text-sm text-red-700 mt-1">0부터 100,000,000까지의 정수를 입력해 주세요. 음수와 소수는 사용할 수 없습니다.</span>}
    {money && !invalid && <span className="block mt-2 text-sm font-semibold">고객에게 표시: {formatKRW(Number(value))}</span>}
  </label>;
}
export function OwnerEditors({ kind, settings, update, benefits }: { kind: List; settings: OwnerSettings; update: (next: OwnerSettings) => void; benefits: { id: string; timing: string; condition: string }[] }) {
  const [selected, setSelected] = useState(0);
  const items = settings[kind];
  const index = Math.min(selected, Math.max(0, items.length - 1));
  const item = items[index] as unknown as Record<string, unknown> | undefined;
  function change(key: string, value: unknown) {
    const copy = structuredClone(settings);
    (copy[kind][index] as unknown as Record<string, unknown>)[key] = value; update(copy);
  }
  function add() {
    const next = structuredClone(settings);
    if (kind === 'products') next.products.push({ name: '새 상품', price: 0, description: '', includedItems: [], active: false, displayOrder: next.products.length + 1 });
    if (kind === 'options') next.options.push({ name: '새 옵션', price: 0, description: '', active: false, displayOrder: next.options.length + 1 });
    if (kind === 'codes') next.codes.push({ code: '', amount: 50000, active: false });
    setSelected(items.length); update(next);
  }
  const field = (key: string, label: string, help: string, props: Partial<Parameters<typeof OwnerField>[0]> = {}) => <OwnerField key={key} label={label} help={help} value={item?.[key] as string | number ?? (props.money || props.number ? 0 : '')} change={value => change(key, value)} {...props} />;
  return <>
    {kind === 'codes' && <><p className="mb-3">고객이 코드를 입력하면 서버가 사용 여부를 확인한 뒤 설정한 금액을 즉시 할인합니다.</p><p className="text-sm mb-5 text-slate-600">대소문자는 구분하지 않습니다. 앞뒤 공백은 제거하며 내부 공백은 사용할 수 없습니다. 사용을 중단할 때는 사용 안 함을 선택하세요. 할인 혜택에서 할인코드 사용도 켜져 있어야 적용됩니다.</p>
      <table className="w-full mb-5 text-left"><thead><tr><th className="p-2">할인코드</th><th>할인금액</th><th>상태</th><th>관리</th></tr></thead><tbody>{settings.codes.map((code, row) => <tr key={code.id || row} className="border-t"><td className="p-2">{code.code || '새 코드'}</td><td>{formatKRW(code.amount)}</td><td>{code.active ? '사용' : '사용 안 함'}</td><td><button type="button" className="owner-button" onClick={() => setSelected(row)} aria-label={(code.code || '새 코드') + ' 수정'}>수정</button></td></tr>)}</tbody></table></>}
    {kind !== 'codes' && <div className="flex flex-wrap gap-2 mb-6" aria-label="수정할 항목">{items.map((value, row) => <button type="button" key={value.id || row} aria-pressed={row === index} className={'owner-button ' + (row === index ? 'bg-slate-100 font-semibold' : '')} onClick={() => setSelected(row)}>{'name' in value ? value.name : ''}</button>)}</div>}
    {kind !== 'discounts' && <button type="button" className="owner-button mb-6" onClick={add} disabled={items.length >= (kind === 'codes' ? 100 : 30)}>+ {kind === 'products' ? '상품' : kind === 'options' ? '옵션' : '할인코드'} 추가</button>}
    {item && <section className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      <div className="space-y-5">
        {kind === 'codes' ? field('code', '할인코드', '고객에게 안내할 코드입니다. 예: FRIEND50', { placeholder: 'FRIEND50' }) : field('name', kind === 'products' ? '상품 이름' : kind === 'options' ? '옵션 이름' : '고객 표시명', '고객의 선택 화면과 새 계약에 표시됩니다.')}
        {field(kind === 'products' || kind === 'options' ? 'price' : 'amount', kind === 'products' ? '상품 가격' : kind === 'options' ? '옵션 가격' : '할인 / 혜택 금액', '원 단위 숫자를 입력하세요. 예: 1250000', { money: true })}
        {kind !== 'codes' && field('description', '설명', '제공 내용이나 혜택을 짧게 설명해 주세요.', { multiline: true })}
        {kind === 'products' && <>
          {field('retouchedCount', '보정본 수', '기본 제공하는 보정 사진의 장수입니다.', { number: true })}
          {field('originalCount', '원본 제공 안내', '예: 2,000장 이상. 고객에게 안내할 수량을 적어 주세요.')}
          {field('albumSpec', '앨범 구성', '계약에 표시할 앨범 크기, 페이지, 권수를 적어 주세요.', { multiline: true })}
          <details className="border rounded-lg p-4"><summary className="cursor-pointer font-medium">제공내용 자세히 관리</summary><div className="space-y-5 mt-5">
            {field('subtitle', '한 줄 안내', '상품 이름 아래에 표시되는 짧은 안내입니다. 예: 앨범 1권 상품')}
            <OwnerField label="주요 제공내용" help="한 줄에 한 항목을 입력합니다. 수량이나 앨범 구성을 바꿨다면 여기의 안내 문구도 함께 확인하세요." multiline value={(item.includedItems as string[]).join('\n')} change={value => change('includedItems', String(value).split('\n'))} />
            {field('additionalRetouchedCount', '추가 보정본 수', '추가 제공 수량이 있으면 입력합니다. 없으면 0입니다.', { number: true })}
            {field('coupleAlbumSummary', '부부 앨범 안내', '고객 상품 선택 화면에 표시됩니다. 예: 15×12 70p 1권')}
            {field('parentAlbumSummary', '부모님 앨범 안내', '미포함이면 미포함으로 안내해 주세요.')}
          </div></details>
        </>}
        {(kind === 'products' || kind === 'options') && field('displayOrder', '표시 순서', '작은 숫자부터 먼저 보여줍니다.', { number: true })}
        <label className="flex gap-3 items-center"><input aria-label="사용 여부" type="checkbox" checked={!!item.active} onChange={event => change('active', event.target.checked)} /><span className="font-medium">{item.active ? '사용' : '사용 안 함'}</span></label>
        <p className="text-sm text-slate-600">사용 안 함으로 바꾸면 신규 고객에게 적용되지 않습니다. 과거 확정 계약은 유지됩니다.</p>
      </div>
      <aside className="rounded-xl border bg-slate-50 p-6 h-fit sticky top-6" aria-label="고객 표시 예시"><h3 className="font-semibold mb-4">고객에게 이렇게 보입니다</h3>
        <p className="text-xl font-semibold">{String(kind === 'codes' ? item.code || '할인코드' : item.name)}</p>
        <p className="text-xl mt-2 font-bold">{formatKRW(Number(item.price ?? item.amount) || 0)}</p>
        <p className="mt-3 whitespace-pre-line">{String(item.subtitle || '')}</p><p className="mt-2 whitespace-pre-line">{String(item.description || '')}</p>
        {kind === 'products' && <><ul className="list-disc pl-5 mt-4">{(item.includedItems as string[]).filter(Boolean).map((text, row) => <li key={row}>{text}</li>)}</ul><p className="mt-4">보정본 {Number(item.retouchedCount || 0) + Number(item.additionalRetouchedCount || 0)}장 · 원본 {String(item.originalCount || '별도 안내')}</p><p className="mt-2 whitespace-pre-line">{String(item.coupleAlbumSummary || item.albumSpec || '')}</p><p className="mt-1">{String(item.parentAlbumSummary || '')}</p><p className="text-sm mt-4 text-slate-600">저장하면 이 상품 데이터로 고객 화면과 새 계약을 구성합니다. 기존 상세 안내와 내용이 맞는지도 확인해 주세요.</p></>}
        {kind === 'discounts' && <><p className="mt-3">{benefits.find(value => value.id === item.id)?.condition}</p><p className="mt-2 font-semibold">{benefits.find(value => value.id === item.id)?.timing}</p><p className="mt-2 text-sm">추후 캐시백은 계약금액에서 차감하지 않습니다. 혜택 조건의 구조 변경은 관리자에게 요청해 주세요.</p></>}
        {!item.active && <p className="mt-4 text-amber-800">사용 안 함: 신규 고객에게 적용되지 않습니다.</p>}
      </aside>
    </section>}
  </>;
}
