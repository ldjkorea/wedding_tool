export const settingLabels: Record<string, string> = {
  studioConfig: '업체정보', productsConfig: '상품 목록', optionsConfig: '옵션 목록', discountsConfig: '할인 / 혜택 목록', contractPolicy: '계약정책', formSchema: '고객 입력폼',
  primaryHover: '버튼 강조 색상', subtleText: '보조 글자 색상', softBorder: '부드러운 테두리', paleBorder: '옅은 테두리', pdfAccent: 'PDF 강조 색상',
  studioId: '업체 ID (배포 고정)', contractPrefix: '계약번호 Prefix (배포 고정)', driveFolderName: '저장 폴더 표시명 (배포 고정)',
  studioName: '업체명', displayName: '표시명', friendlyName: '친근한 업체명', representativeName: '대표자', representativeEmail: '대표 이메일',
  representativePhone: '대표 전화번호', businessInformation: '사업자정보', website: '홈페이지 (HTTPS)', brandTagline: '브랜드 문구',
  logo: '로고', seal: '직인', colors: '브랜드 색상', primary: '기본 색상', secondary: '보조 색상', warm: '배경 / 글자 팔레트',
  emailSenderName: '메일 발신 표시명', bookingName: '부킹 표시명', photographyLabel: '촬영 브랜드 표시', contactChannel: '연락 채널',
  id: 'ID', name: '이름', shortName: '짧은 이름', price: '가격 (원)', amount: '금액 (원)', description: '설명', subtitle: '짧은 설명',
  active: '활성', displayOrder: '표시 순서', includedItems: '포함 항목', shootScope: '촬영 범위', retouchedCount: '보정본 수',
  originalCount: '원본 수 안내', albumSpec: '앨범 구성', additionalRetouchedCount: '추가 보정본 수', additionalOriginalCount: '추가 원본 수',
  coupleAlbumSummary: '부부 앨범 안내', parentAlbumSummary: '부모님 앨범 안내', mobilePlusItems: '모바일 추가 구성 안내',
  catalogTag: '상품 태그', includedHeading: '기본 구성 제목', premiumHeading: '프리미엄 구성 제목', upgradeHeading: '업그레이드 제목',
  badge: '배지 문구', isPlusPackage: '프리미엄 구성 표시', baseIncludedNotice: '기본 구성 안내', plusBenefits: '추가 혜택', detail: '상세 설명',
  type: '혜택 유형', eligibility: '적용 조건', kind: '조건 (고정)', weekday: '할인 요일 (일=0, 토=6)',
  pricingName: '금액 내역 표시명', pricingDescription: '금액 내역 설명', labels: '화면별 혜택 표시',
  form: '고객 폼', review: '대표 검토', pdf: 'PDF', summary: '금액 요약', catalog: '상품 안내', email: '이메일', catalogOrder: '상품 안내 순서',
  version: '정책 버전', deposit: '계약금', payment: '결제 안내', depositDueHours: '계약금 납부 기한 (시간)',
  balanceDueDaysBeforeWedding: '예식 전 잔금 기한 (일)', taxLabel: '세금 표시', cancellation: '취소 정책', refund: '환불 정책',
  dateChangeFee: '일정 변경 수수료', disasterCancellationFee: '재해 취소 수수료', tiers: '취소 단계', rate: '위약금 비율 (%) / 계약금 기준',
  label: '표시 문구', title: '제목', content: '본문', summaryTrigger: '납품 일정 기준', fullRefundWindowHours: '전액 환불 기간 (시간)',
  afterWindowNotice: '기간 이후 환불 안내', delivery: '납품 정책', format: '납품 형식', longEdgePixels: '긴 변 픽셀', channel: '납품 방식',
  revisionRequestDays: '수정 요청 기간 (일)', imageSpec: '제공 파일 규격', timeline: '납품 기간', rawFilePolicy: '원본 정책',
  retention: '데이터 보관', months: '보관 개월', backupCopies: '백업 사본 수', notice: '안내 문구', copyright: '저작권', portfolio: '포트폴리오',
  terms: '약관', privacyNotice: '개인정보 수집 안내', enabled: '사용', required: '필수', placeholder: '입력 예시',
  groomPhone: '신랑 연락처', bridePhone: '신부 연락처', weddingHall: '홀 명칭 / 층수', makeupLocation: '메이크업 장소',
  groomFamilyMembers: '신랑 가족구성', brideFamilyMembers: '신부 가족구성', shootRequestNotes: '촬영 요청', retouchRequestNotes: '후보정 요청',
  requestNotes: '요청 / 특약', referralSource: '유입경로', instagramId: '인스타그램', blogUrl: '블로그',
  catalogIntro: '상품 소개', homeDiscountSummary: '홈 혜택 요약', portfolioDescription: '포트폴리오 설명', commonProductHeading: '공통 구성 제목',
  commonShootItems: '공통 촬영 항목', pdfShootScope: '계약서 촬영 범위', reviewProofChannel: '후기 인증 채널', reviewRetentionMonths: '후기 유지 개월',
  reviewContractChannelNotice: '계약 후기 채널 안내', reviewMainNotice: '본식 후기 안내', cashbackPaymentNotice: 'Cashback 지급 안내',
  referralOptions: '유입경로 선택지', makeupNotice: '메이크업 안내', manualDiscountReason: '수동 할인 기본 문구',
  manualAdjustmentReason: '수동 조정 기본 문구', metadata: '검색 표시',
};

export const sectionInformation = {
  studioConfig: { title: '고객에게 보여줄 업체 정보', purpose: '업체를 소개하고 계약 담당자의 연락처를 안내합니다.', locations: '고객 화면 상단 · 대표 검토 · 계약서 PDF · 고객/대표 이메일', example: '표시명: MOMENT STUDIO / 대표 이메일: owner@studio.co.kr' },
  productsConfig: { title: '판매할 촬영 상품', purpose: '고객이 선택할 상품과 기본 가격, 실제 제공 구성을 입력합니다.', locations: '상품 안내 · 고객 상품 선택 · 가격 계산 · 대표 검토 · PDF · 이메일', example: '상품명: 본식 기본형 / 가격: 1,250,000원 / 보정본: 70장' },
  optionsConfig: { title: '추가 촬영 옵션', purpose: '기본 상품에 고객이 추가할 수 있는 촬영 서비스를 관리합니다.', locations: '고객 옵션 선택 · 가격 계산 · 대표 검토 · PDF · 이메일', example: '옵션명: 2인 촬영 / 추가금액: 250,000원' },
  discountsConfig: { title: '할인과 후기 혜택', purpose: '즉시 할인과 촬영 후 지급할 Cashback을 구분합니다. 아래에서 고객에게 안내할 할인코드도 관리합니다.', locations: '고객 할인 선택 · 가격 계산 · 대표 검토 · PDF · 이메일', example: '즉시 할인은 계약금액 차감 / 후기 Cashback은 계약금액 유지' },
  contractPolicy: { title: '계약과 납품 약속', purpose: '계약금, 납부 기한, 취소·환불 및 사진 납품 기준을 입력합니다. 업무 정책을 확정한 뒤 변경하세요.', locations: '약관 동의 화면 · 대표 검토 · 확정 Snapshot · PDF · 이메일', example: '계약금: 300,000원 / 잔금: 예식 7일 전' },
  formSchema: { title: '계약할 때 받을 고객 정보', purpose: '계약 시 받을 정보와 촬영 준비 단계에서 나중에 받을 정보를 구분합니다.', locations: '고객 입력폼 · 필수 입력 검사 · 대표 검토 · 계약서의 해당 정보', example: '촬영 요청: 사용함 + 선택 / Label: 원하는 촬영 분위기' },
  content: { title: '화면과 계약서 안내 문구', purpose: '이미 있는 안내 영역에 표시할 문구를 편집합니다. 상품 구성과 서로 다른 내용을 쓰지 않도록 확인하세요.', locations: '상품 소개 · 고객 폼 · 약관 안내 · PDF · 이메일 · 검색 제목', example: '촬영 범위: 신부대기실부터 본식·원판 촬영까지' },
};
settingLabels.partnerCodes = '짝꿍 할인코드';
settingLabels.code = '할인코드';
settingLabels.weekday = '할인을 적용할 예식 요일';
export type SettingPath = string[];
export type Tree = string | number | boolean | null | Tree[] | { [key: string]: Tree };
export function fieldLabel(path: SettingPath): string {
  const key=path.at(-1) || '';
  if (/^\d+$/.test(key)) return path.includes('warm') ? '색상 단계 ' + key : '항목 ' + (Number(key)+1);
  if (key === 'name') return path[0] === 'productsConfig' ? '상품명' : path[0] === 'optionsConfig' ? '옵션명' : '혜택 이름';
  if (key === 'amount' && path[0] === 'partnerCodes') return '코드 할인금액 (원)';
  return settingLabels[key] || '추가 안내 문구';
}
export function basicKeys(path: SettingPath, value: Record<string, Tree>): string[] | null {
  if (path.length===1 && path[0]==='studioConfig') return ['studioName','displayName','representativeName','representativePhone','representativeEmail','businessInformation','website','brandTagline','logo','seal','colors'];
  if (path[0]==='productsConfig' && path.length===2) return ['name','price','description','shootScope','originalCount','retouchedCount','albumSpec','includedItems','active'];
  if (path[0]==='optionsConfig' && path.length===2) return ['name','price','description','active'];
  if (path[0]==='discountsConfig' && path.length===2) return (value.eligibility as {kind?:string})?.kind==='partner' ? ['name','description','active'] : ['name','amount','type','description','active','eligibility'];
  if (path[0]==='partnerCodes' && path.length===2) return ['code','amount','active'];
  if (path.at(-1)==='colors') return ['primary','secondary'];
  if (path.length===1 && path[0]==='contractPolicy') return ['deposit','payment','cancellation','refund','delivery','retention','copyright','portfolio','terms','privacyNotice'];
  if (path.at(-1)==='eligibility') return ['weekday','description'];
  return null;
}
export function isMoneyField(path: SettingPath) { return ['price','amount','dateChangeFee','disasterCancellationFee'].includes(path.at(-1)||''); }
export function readableValue(value: Tree | undefined, path: SettingPath): string {
  const key=path.at(-1);
  if (value === undefined) return '입력 없음';
  if (value === null) return '계약금 기준';
  if (typeof value==='boolean') return key==='required' ? (value?'필수':'선택') : (value?'사용함':'사용 안 함');
  if (typeof value==='number') return key==='weekday' ? ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'][value] || '요일 확인 필요' : isMoneyField(path) ? value.toLocaleString('ko-KR')+'원' : value.toLocaleString('ko-KR')+(key==='retouchedCount'?'장':key==='rate'?'%':'');
  if (typeof value==='string') {
    if (['logo','seal'].includes(key||'')) return value?'이미지 등록':'이미지 없음';
    if (value==='immediate') return '즉시 할인'; if (value==='cashback') return '추후 Cashback';
    return value.trim() ? value.length>90 ? value.slice(0,90)+'…' : value : '입력 없음';
  }
  return '세부 구성';
}
export function fieldHelp(path: SettingPath): {description:string;example:string} {
  const key=path.at(-1)||'', label=fieldLabel(path);
  const examples:Record<string,string> = {studioName:'모먼트 스튜디오',displayName:'MOMENT STUDIO',representativeName:'김대표',representativeEmail:'owner@studio.co.kr',representativePhone:'010-1234-5678',businessInformation:'상호 / 사업자등록번호 / 사업장 주소',website:'https://studio.co.kr',brandTagline:'소중한 순간을 기록합니다',name:path[0]==='productsConfig'?'본식 기본형':path[0]==='optionsConfig'?'2인 촬영':'포트폴리오 할인',description:'신부대기실부터 본식·원판 촬영까지 포함',price:'1250000',amount:path[0]==='partnerCodes'?'30000':'100000',code:'PAIR-2027',originalCount:'2,000장 이상',retouchedCount:'70',albumSpec:'부부앨범 15×12인치 70페이지 1권',shootScope:'신부대기실 → 본식 → 원판 촬영',includedItems:'원본 촬영 파일 전체 제공\n정밀 보정본 70장',label:'원하는 촬영 분위기',placeholder:'자연스러운 사진 위주로 부탁드립니다',version:'2027-01',title:'취소 및 환불 안내',content:'고객에게 약속할 정책을 정확히 입력해 주세요.',privacyNotice:'수집 항목·이용 목적·보관 기간·문의처를 안내하세요.',displayOrder:'1',depositDueHours:'24',balanceDueDaysBeforeWedding:'7',months:'12',rate:'10',weekday:'0',primary:'#322A1B',secondary:'#B09A74',shortName:'기본형',subtitle:'앨범 1권 포함',format:'JPEG',channel:'온라인 다운로드 링크'};
  Object.assign(examples, { backupCopies:'2', longEdgePixels:'4000', revisionRequestDays:'14', fullRefundWindowHours:'48', dateChangeFee:'100000', disasterCancellationFee:'50000', additionalRetouchedCount:'10', additionalOriginalCount:'500', reviewRetentionMonths:'6', id:'자동 생성되는 내부 관리번호' });
  if (path[0] === 'formSchema') {
    if (key === 'label') examples.label = settingLabels[path[1]] || '고객에게 보여줄 입력칸 제목';
    if (key === 'placeholder') examples.placeholder = ({ groomPhone:'010-1234-5678', bridePhone:'010-1234-5678', weddingHall:'6층 그랜드볼룸', makeupLocation:'청담동 메이크업숍 이름', groomFamilyMembers:'부모님, 형제자매', brideFamilyMembers:'부모님, 형제자매', referralSource:'인스타그램', instagramId:'@studio_account', blogUrl:'https://blog.naver.com/account', retouchRequestNotes:'자연스러운 피부 톤 보정을 원합니다.', requestNotes:'별도로 협의한 촬영 내용을 적어 주세요.' } as Record<string,string>)[path[1]] || '자연스러운 사진 위주로 부탁드립니다.';
  }
  const descriptions:Record<string,string> = {
    studioName:'업체의 정식 이름입니다. 계약서와 업체 안내에 사용합니다.',displayName:'화면 상단과 이메일 제목에 보이는 브랜드 이름입니다.',
    representativeName:'계약을 담당하는 대표자의 이름입니다.',representativeEmail:'신규 접수 알림과 새 계약 대표 사본을 받을 주소입니다. Gmail 발신 계정은 바뀌지 않습니다.',
    representativePhone:'고객에게 안내할 업무 연락처입니다.',businessInformation:'업체 정보로 저장합니다. 현재 PDF에 별도 표시 영역을 추가하지 않습니다.',
    website:'고객이 방문할 홈페이지입니다. https://로 시작해야 합니다.',brandTagline:'업체를 소개하는 짧은 문구입니다.',
    name:'고객이 선택하고 계약서·메일에서 확인할 이름입니다. 고급 설정의 짧은 이름은 별도 요약 표시에 사용됩니다.',
    price:'상품은 기본 계약금액, 옵션은 추가금액입니다. 숫자만 입력하면 아래에 원 단위로 표시합니다.',
    amount:path[0]==='partnerCodes'?'이 코드에 적용할 즉시 할인금액입니다. 다른 코드 금액과 달라도 됩니다.':'이 혜택의 금액입니다. 즉시 할인과 추후 Cashback을 구분하세요.',
    code:'고객에게 안내할 코드입니다. 대소문자를 구분하지 않고 앞뒤 공백을 제거합니다. 내부 공백은 금지합니다.',
    active:'사용 안 함으로 바꾸면 신규 고객이 선택하거나 코드를 사용할 수 없습니다. 과거 확정 계약은 유지합니다.',
    enabled:'고객 입력폼에 이 정보를 표시할지 선택합니다.',required:'필수면 입력하지 않은 고객은 제출할 수 없습니다. 선택이면 비워도 됩니다.',
    label:'고객 입력칸 위에 표시할 제목입니다.',placeholder:'고객이 입력하기 전에 입력칸 안에 보이는 예시입니다.',
    originalCount:'고객에게 안내할 원본 제공 수량입니다. 포함 항목 문구와 일치시키세요.',retouchedCount:'기본 보정본 수량입니다. 추가 보정본은 고급 설정에서 관리합니다.',
    albumSpec:'실제로 제공할 앨범 크기·페이지·권수를 적습니다.',includedItems:'상품 안내에 표시할 구성입니다. 한 줄에 한 항목을 입력하세요.',
    shootScope:'이 상품의 촬영 범위입니다. 비워두면 공통 계약서 촬영 범위를 사용합니다.',
    id:'과거 계약과 연결하는 내부 관리번호입니다. 자동 생성되며 직접 변경하지 않습니다.',
    studioId:'업체 데이터를 구분하는 배포 고정값입니다.',contractPrefix:'계약번호 앞에 붙는 배포 고정값입니다.',driveFolderName:'기존 계약 저장에 사용하는 배포 고정 표시명입니다.',
    displayOrder:'작은 숫자부터 먼저 표시합니다.',type:'즉시 할인은 현재 계약금액을 줄이고, Cashback은 추후 지급합니다. 후기 혜택은 Cashback만 가능합니다.',
    weekday:'고객이 선택한 예식일이 이 요일이면 요일 혜택을 자동 적용합니다.',
    primary:'버튼과 주요 안내에 사용할 기본 색상입니다. 색상 선택칸을 눌러 고르세요.',
    secondary:'혜택과 강조 부분에 사용할 보조 색상입니다. 색상 선택칸을 눌러 고르세요.',
    version:'업무상 약관 버전 이름입니다. 저장 이력 번호는 자동으로 별도 관리합니다.',
    content:'고객에게 실제 약속할 약관 본문입니다. 수정 시 미처리 계약을 먼저 확인하세요.',
    logo:'고객 화면과 계약서에 사용할 PNG/JPEG/WebP 이미지입니다. 300KB 이하로 업로드합니다.',
    seal:'계약서에 사용할 직인 이미지입니다. PNG/JPEG/WebP 300KB 이하입니다.',
    depositDueHours:'계약금 납부 기한을 시간 단위로 입력합니다.',balanceDueDaysBeforeWedding:'예식 며칠 전에 잔금을 받는지 입력합니다.',
    rate:'위약금 비율입니다. 비워두면 계약금 기준을 사용합니다.',
    kind:'할인 계산 규칙과 연결하는 고정값입니다. 변경할 수 없습니다.',
  };
  return { description:descriptions[key] || label+'에 사용할 실제 운영 문구·값입니다. '+(sectionInformation[path[0] as keyof typeof sectionInformation]?.locations || '해당 안내 영역')+'에 반영됩니다.',
    example:examples[key] || (key==='active'||key==='enabled'?'사용함 / 사용 안 함':key==='required'?'필수 / 선택':key==='logo'||key==='seal'?'studio-logo.png':path.includes('colors')?'#B09A74':label+'의 실제 운영 내용') };
}
export function describeChanges(before: import('@/types/studioSettings').StudioSettings, after: import('@/types/studioSettings').StudioSettings): string[] {
  const rows:string[]=[];
  function visit(a:any,b:any,path:string[], context:string) {
    if(JSON.stringify(a)===JSON.stringify(b)) return;
    if(Array.isArray(a)||Array.isArray(b)) {
      const old=Array.isArray(a)?a:[],next=Array.isArray(b)?b:[];
      if(next.some(x=>x&&typeof x==='object'&&'id' in x)||old.some(x=>x&&typeof x==='object'&&'id' in x)) {
        for(const item of next) {
          const previous=old.find(x=>x.id===item.id),title=context+' 「'+(item.name||item.code||item.title||'항목')+'」';
          if(!previous) rows.push(title+' 추가'+(typeof item.price==='number'?' · '+item.price.toLocaleString('ko-KR')+'원':typeof item.amount==='number'?' · '+item.amount.toLocaleString('ko-KR')+'원':'')+' · '+(item.active===false?'사용 안 함':'사용함'));
          else visit(previous,item,[...path,String(next.indexOf(item))],title);
        }
        for(const item of old) if(!next.some(x=>x.id===item.id)) rows.push(context+' 「'+(item.name||item.code||item.title||'항목')+'」 제거');
      } else if (next.every(item => typeof item === 'string') && old.every(item => typeof item === 'string')) {
        rows.push(context+' · '+fieldLabel(path)+': '+(old.join(' / ')||'없음')+' → '+(next.join(' / ')||'없음'));
      } else {
        for(let index=0;index<Math.max(old.length,next.length);index++) visit(old[index],next[index],[...path,String(index)],context+' '+fieldLabel(path)+' '+(index+1));
      }
      return;
    }
    if((a&&typeof a==='object')||(b&&typeof b==='object')) { for(const key of new Set([...Object.keys(a||{}),...Object.keys(b||{})])) visit(a?.[key],b?.[key],[...path,key],context); return; }
    rows.push(context+' · '+fieldLabel(path)+': '+readableValue(a,path)+' → '+readableValue(b,path));
  }
  for(const key of new Set([...Object.keys(before),...Object.keys(after)])) visit((before as any)[key],(after as any)[key],[key],settingLabels[key]||'업체 설정');
  return rows;
}
