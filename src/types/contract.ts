/**
 * 웨딩 부킹 계약 데이터 및 가격 스냅샷 타입 정의
 */

export interface ContractFormData {
  // 예식 및 메이크업 정보
  weddingDate: string; // YYYY-MM-DD
  weddingTime: string; // HH:mm
  weddingVenue: string; // 웨딩홀
  weddingHall: string; // 홀명 (예: 그랜드볼룸)
  makeupLocation?: string; // 선택 촬영 준비 정보. 메이크업 추가 촬영 옵션과 무관하며 계약 필수 항목이 아님.

  // 고객 및 가족 정보
  groomName: string; // 신랑 성명
  groomPhone: string; // 신랑 연락처
  brideName: string; // 신부 성명
  bridePhone: string; // 신부 연락처
  email: string; // 계약서 수신 이메일
  groomFamilyMembers?: string; // 선택 가족사진 준비 정보. 계약 후 확인 가능.
  brideFamilyMembers?: string; // 선택 가족사진 준비 정보. 계약 후 확인 가능.

  // 상품 및 옵션
  productId: string; // 업체 상품 Config ID
  optionIds: string[]; // 업체 옵션 Config ID 목록

  // 할인 및 혜택
  partnerDiscount: boolean; // 서버에서 확인한 짝꿍 할인코드 사용 여부
  partnerName: string; // 정규화한 할인코드. 이전 계약 payload/Snapshot의 필드명 유지.
  partnerDiscountAmount?: number; // Verified by the server; frozen with the normalized code in Snapshot.
  sundayDiscount: boolean; // 일요일 식 할인 (이전 payload 호환 필드; 실제 할인은 Config 요일 조건으로 계산)
  portfolioConsent: boolean; // 사진 공개 감사 할인 (금액·유형은 할인 Config)
  reviewContractCashback: boolean; // 계약 후기 작성 페이백 (추후 Cashback; 금액은 할인 Config)
  reviewMainCashback: boolean; // 본식 후기 작성 페이백 (추후 50,000원)

  // 요청사항 및 사후 확인
  shootRequestNotes?: string; // 선택 촬영 요청. 입력하면 대표 검토 및 최종 문서에 보존.
  retouchRequestNotes?: string; // 선택 후보정 요청. 입력하면 대표 검토 및 최종 문서에 보존.
  requestNotes: string; // 선택 요청/특약. 기존 payload 호환을 위해 빈 문자열을 허용하는 string으로 유지.
  referralSource?: string; // 선택 유입경로 참고정보. 계약/가격 계산에 사용하지 않음.
  instagramId?: string; // 선택 후기 확인 계정. 추후 전달 가능하며 계약 금액과 무관.
  blogUrl?: string; // 선택 후기 확인 주소. 추후 전달 가능하며 계약 금액과 무관.

  // 약관 동의
  termsAgreed: boolean; // 필수 약관 및 개인정보 수집이용 동의

  // 대표 수동 조정 (선택적)
  manualAdjustment?: {
    amount: number; // 음수/양수 가능 (예: -50000)
    reason: string; // 사유 (예: '프로모션 추가 할인')
  };
}

export interface PriceBreakdownItem {
  policyId?: import('./config').DiscountType;
  category: 'base' | 'option' | 'immediate_discount' | 'manual_adjustment' | 'future_cashback';
  name: string;
  amount: number;
  description?: string;
}

export interface PriceCalculationResult {
  basePrice: number;
  optionTotal: number;
  immediateDiscountTotal: number;
  manualAdjustmentAmount: number;
  contractTotal: number; // 최종 계약금액 = basePrice + optionTotal - immediateDiscountTotal + manualAdjustmentAmount
  depositAmount: number; // 계약금 (계약 정책 Config)
  balanceAmount: number; // 잔금 = contractTotal - depositAmount
  futureCashbackTotal: number; // 추후 페이백 총액 (계약 후기 + 본식 후기)
  breakdown: PriceBreakdownItem[];
  isSunday: boolean;
  dateDiscountEligible?: boolean;
}

export interface ContractSnapshot {
  contractNumber: string; // 업체 Prefix 기반 번호
  id: string; // 고유 ID
  data: ContractFormData;
  pricing: PriceCalculationResult;
  settingsRevision?: number;
  settingsHash?: string;
  termsVersion: string;
  policyNotes?: string;
  terms?: import('./config').ContractPolicyConfig & Partial<import('./config').ConfiguredContractPolicy>;
  formSchema?: import('./config').FormSchemaConfig;
  studio?: import('./config').StudioConfig;
  content?: import('./config').ClientConfiguration['content'];
  discounts?: import('./config').DiscountConfig[];
  product?: import('./config').ProductItem;
  options?: import('./config').OptionItem[];
  generatedAt: string; // ISO 8601
  approvedAt?: string;
  sentAt?: string;
  status: 'submitted' | 'approved' | 'sent';
}

export interface ApprovalPayload {
  contractId: string;
  data: ContractFormData;
  generatedAt: string;
  exp: number; // 만료 타임스탬프
}
