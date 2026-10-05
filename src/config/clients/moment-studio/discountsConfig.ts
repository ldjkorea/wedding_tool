import type { DiscountDefinition } from '@/types/config';

// Fictional studio configuration for isolated regression testing.
export const discountsConfig: DiscountDefinition[] = [
  {
    "id": "moment_saturday",
    "name": "토요일 모먼트 혜택",
    "amount": 80000,
    "type": "immediate",
    "eligibility": {
      "kind": "weekday",
      "weekday": 6,
      "description": "토요일 예식"
    },
    "active": true
  },
  {
    "id": "moment_referral",
    "name": "모먼트 커플 소개",
    "amount": 35000,
    "type": "immediate",
    "eligibility": {
      "kind": "partner",
      "description": "등록된 커플 소개 코드"
    },
    "active": true
  },
  {
    "id": "moment_portfolio",
    "name": "모먼트 공개 동의",
    "amount": 60000,
    "type": "immediate",
    "eligibility": {
      "kind": "portfolio",
      "description": "작품 공개 동의"
    },
    "active": true
  },
  {
    "id": "moment_contract_review",
    "name": "모먼트 예약 후기",
    "amount": 30000,
    "type": "cashback",
    "eligibility": {
      "kind": "review_contract",
      "description": "계약 후기 확인 후"
    },
    "active": true
  },
  {
    "id": "moment_photo_review",
    "name": "모먼트 촬영 후기",
    "amount": 70000,
    "type": "cashback",
    "eligibility": {
      "kind": "review_main",
      "description": "사진 수령 후 후기 확인"
    },
    "active": true
  }
];
