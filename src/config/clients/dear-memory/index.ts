import type { ClientConfiguration } from '@/types/config';
import { studioConfig } from './studio';
import { productsConfig } from './products';
import { optionsConfig } from './options';
import { discountsConfig } from './discounts';
import { contractPolicy } from './contractPolicy';
import { formSchema } from './formSchema';
import { legacyFormSchema } from './legacy-formSchema';
import { legacyStudioConfig, legacyContractPolicy, legacyContent, legacyConfiguredPolicy, legacyDiscounts } from './legacy-v1';

export const dearMemoryConfiguration: ClientConfiguration = {
  studioConfig, productsConfig, optionsConfig, discountsConfig, contractPolicy, formSchema,
  compatibility: {
    legacySubmissionIds: true, legacyApprovalTokens: true,
    representativeEmailAliases: ['DEAR_MEMORY_REP_EMAIL'],
    snapshots: { studio: legacyStudioConfig, policy: legacyConfiguredPolicy, terms: legacyContractPolicy,
      content: legacyContent, formSchema: legacyFormSchema, discounts: legacyDiscounts },
  },
  content: {
  "homeDiscountSummary": "일요일·짝꿍 할인",
    "portfolioDescription": "{{friendlyName}} 공식 SNS 및 웹사이트에 소중한 본식 사진 게재를 허락해주시는 감사 할인입니다.",
    "catalogIntro": [
    "{{studioName}}는 신부대기실부터 예식 본식, 원판 사진, 연회장 인사까지",
    "하루의 가장 찬란한 순간을 정성껏 담아냅니다."
  ],
  "commonProductHeading": "전 상품 기본 공통 제공 사항 (실속형 / 화보형 공통)",
  "commonShootItems": [
    "스냅 촬영 + 원판(기념촬영) 포함",
    "신부대기실 ~ 본식 ~ 원판 ~ 연회장 인사 (10~15분)"
  ],
  "pdfShootScope": "신부대기실 ~ 본식 ~ 원판 기념촬영 ~ 연회장 인사 (10~15분)",
  "reviewProofChannel": "채널톡",
  "reviewRetentionMonths": 6,
  "reviewContractChannelNotice": "(다이렉트웨딩카페 제외)",
  "reviewMainNotice": "본식 촬영 종료 및 최종본 수령 후 커뮤니티/블로그에 후기 작성 시",
  "cashbackPaymentNotice": "* 후기 작성 확인 후 대표가 계좌로 직접 페이백 지급해 드립니다.",
  "referralOptions": [
    "블로그 후기",
    "카페 후기",
    "인스타그램",
    "지인소개",
    "기타 경로"
  ],
  "makeupNotice": "메이크업 추가 촬영 옵션은 없습니다. 장소와 시간은 촬영 준비 참고정보로, 아직 정해지지 않았다면 비워 두셔도 계약을 진행할 수 있습니다.",
  "manualDiscountReason": "지인 특별 할인",
  "manualAdjustmentReason": "대표 특약 금액 조정",
  "metadata": {
    "title": "웨딩 부킹 프로그램 | 본식스냅 계약정보 작성",
    "description": "웨딩 스냅 업체용 계약정보 작성 및 자동 발송 프로그램"
  }
},
  demo: { representativeEmail: 'studio@example.com', previewCoupleLabel: '강태양 · 이지은' },
};
