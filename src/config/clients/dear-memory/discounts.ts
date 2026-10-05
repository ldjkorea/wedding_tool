import type { DiscountDefinition } from '@/types/config';

export const discountsConfig: DiscountDefinition[] = [
  {
    "id": "sunday",
    "name": "일요일 예식 프로모션",
    "amount": 100000,
    "type": "immediate",
    "eligibility": {
      "kind": "weekday",
      "weekday": 0,
      "description": "일요일에 예식을 진행하시는 신랑·신부님께 드리는 특별 일정 즉시 할인 혜택입니다."
    },
    "active": true,
    "displayOrder": 1,
    "description": "일요일에 예식을 진행하시는 신랑·신부님께 드리는 특별 일정 즉시 할인 혜택입니다.",
    "pricingName": "일요일 예식 프로모션 할인",
    "pricingDescription": "일요일 예식 고객 대상 즉시 할인",
    "labels": {
      "email": "일요일 예식",
      "form": "일요일 예식 할인",
      "review": "일요일 예식 특별 할인",
      "pdf": "일요일 예식 특별 할인",
      "summary": "일요일 할인",
      "catalog": "일요일 예식 프로모션"
    }
  },
  {
    "id": "partner",
    "name": "짝꿍 추천 할인",
    "amount": 50000,
    "type": "immediate",
    "eligibility": {
      "kind": "partner",
      "description": "업체에서 안내한 할인코드를 서버에서 확인한 후 해당 코드의 할인금액을 즉시 적용합니다."
    },
    "active": true,
    "displayOrder": 2,
    "catalogOrder": 3,
    "description": "업체에서 안내한 할인코드를 서버에서 확인한 후 해당 코드의 할인금액을 즉시 적용합니다.",
    "pricingName": "짝꿍 추천 할인",
    "pricingDescription": "서버에서 확인한 할인코드의 금액을 즉시 적용",
    "labels": {
      "email": "짝꿍 추천",
      "form": "짝꿍 할인",
      "review": "짝꿍 추천 할인",
      "pdf": "짝꿍 추천 할인",
      "summary": "짝꿍 할인",
      "catalog": "짝꿍 추천 할인"
    }
  },
  {
    "id": "portfolio",
    "name": "사진 공개 감사 할인 (SNS & 포트폴리오)",
    "amount": 100000,
    "type": "immediate",
    "eligibility": {
      "kind": "portfolio",
      "description": "Dear Memory 공식 SNS 및 웹사이트에 소중한 본식 사진 게재를 허락해주시는 신랑·신부님께 드리는 감사 할인입니다."
    },
    "active": true,
    "displayOrder": 3,
    "catalogOrder": 2,
    "description": "Dear Memory 공식 SNS 및 웹사이트에 소중한 본식 사진 게재를 허락해주시는 신랑·신부님께 드리는 감사 할인입니다.",
    "pricingName": "사진 공개 감사 할인 (SNS & 포트폴리오)",
    "pricingDescription": "공식 SNS 및 포트폴리오 게재 동의 감사 할인",
    "labels": {
      "email": "사진 공개 감사",
      "form": "사진 공개 감사 할인",
      "review": "사진 공개 감사 할인 (포트폴리오)",
      "pdf": "포트폴리오(사진 공개 동의) 감사 할인",
      "summary": "사진 공개 감사 할인",
      "catalog": "사진 공개 감사 할인 (SNS & 포트폴리오)"
    }
  },
  {
    "id": "review_contract",
    "name": "계약 후기 작성 혜택",
    "amount": 50000,
    "type": "cashback",
    "eligibility": {
      "kind": "review_contract",
      "description": "웨딩 커뮤니티(다이렉트, 멕마웨 등) 또는 블로그에 정성스러운 계약 후기 작성 시 페이백 지급."
    },
    "active": true,
    "displayOrder": 4,
    "description": "웨딩 커뮤니티(다이렉트, 멕마웨 등) 또는 블로그에 정성스러운 계약 후기 작성 시 페이백 지급.",
    "pricingName": "계약 후기 작성 페이백",
    "pricingDescription": "웨딩 커뮤니티 정성 후기 작성 시 페이백 지급",
    "labels": {
      "form": "계약 후기 할인",
      "review": "계약 후기 작성 페이백",
      "pdf": "계약 후기 작성 페이백",
      "summary": "계약 후기 페이백",
      "catalog": "계약 후기 작성 시"
    }
  },
  {
    "id": "review_main",
    "name": "본식 촬영 후기 혜택",
    "amount": 50000,
    "type": "cashback",
    "eligibility": {
      "kind": "review_main",
      "description": "예식 종료 후 결과물 수령 후 커뮤니티/블로그에 본식 후기 작성 시 페이백 지급."
    },
    "active": true,
    "displayOrder": 5,
    "description": "예식 종료 후 결과물 수령 후 커뮤니티/블로그에 본식 후기 작성 시 페이백 지급.",
    "pricingName": "본식 후기 작성 페이백",
    "pricingDescription": "본식 촬영 종료 후 후기 작성 시 페이백 지급",
    "labels": {
      "form": "촬영 후 후기 할인",
      "review": "본식 후기 작성 페이백",
      "pdf": "본식 후기 작성 페이백",
      "summary": "본식 후기 페이백",
      "catalog": "본식 후기 작성 시"
    }
  }
];
