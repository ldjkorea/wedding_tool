import type { ClientConfiguration } from '@/types/config';
import { studioConfig } from './studioConfig';
import { productsConfig } from './productsConfig';
import { optionsConfig } from './optionsConfig';
import { discountsConfig } from './discountsConfig';
import { contractPolicy } from './contractPolicy';
import { formSchema } from './formSchema';

export const momentStudioConfiguration: ClientConfiguration = {
  studioConfig, productsConfig, optionsConfig, discountsConfig, contractPolicy, formSchema,
  content: {
  "catalogIntro": [
    "{{studioName}}는 두 사람의 순간을 기록합니다.",
    "모먼트 Demo 상품과 정책을 확인해 주세요."
  ],
  "homeDiscountSummary": "토요일·커플 소개 모먼트 혜택",
  "portfolioDescription": "{{studioName}} 작품 공개 동의 혜택",
  "commonProductHeading": "모먼트 전 상품 공통 제공",
  "commonShootItems": [
    "신부대기실부터 예식 현장 촬영",
    "디지털 원본과 보정본 제공"
  ],
  "pdfShootScope": "신부대기실 ~ 본식 ~ 기념촬영",
  "reviewProofChannel": "모먼트 Demo 접수",
  "reviewRetentionMonths": 3,
  "reviewContractChannelNotice": "(가상 업체 Demo 채널)",
  "reviewMainNotice": "최종 사진 수령 후 모먼트 후기를 작성한 경우",
  "cashbackPaymentNotice": "가상 후기 확인 후 별도 Cashback 지급",
  "referralOptions": [
    "모먼트 홈페이지",
    "친구 추천",
    "웨딩 박람회",
    "기타 경로"
  ],
  "makeupNotice": "모먼트는 계약 시 메이크업 정보를 받지 않습니다.",
  "manualDiscountReason": "모먼트 Demo 특별 할인",
  "manualAdjustmentReason": "모먼트 대표 합의 조정",
  "metadata": {
    "title": "MOMENT STUDIO | Demo Booking",
    "description": "모먼트 스튜디오 가상 업체 계약 검증"
  }
},
  demo: { representativeEmail: 'moment-demo@example.com', previewCoupleLabel: '김시온 · 박다은' },
};
