import type { ConfiguredContractPolicy } from '@/types/config';

// Fictional studio configuration for isolated regression testing.
export const contractPolicy: ConfiguredContractPolicy = {
  "version": "MS-DEMO-2026.10.v1",
  "deposit": {
    "amount": 250000
  },
  "payment": {
    "depositDueHours": 48,
    "balanceDueDaysBeforeWedding": 14,
    "taxLabel": "VAT 포함"
  },
  "cancellation": {
    "dateChangeFee": 80000,
    "disasterCancellationFee": 120000,
    "tiers": [
      {
        "label": "촬영 120일 이전",
        "rate": null
      },
      {
        "label": "촬영 60~120일",
        "rate": 25
      },
      {
        "label": "촬영 30~60일",
        "rate": 50
      },
      {
        "label": "촬영 30일 이내",
        "rate": 75
      }
    ],
    "summary": [
      "120일 이전: 예약금 기준",
      "60~120일 25% / 30~60일 50% / 30일 이내 75%"
    ]
  },
  "refund": {
    "fullRefundWindowHours": 96,
    "afterWindowNotice": "가상 업체의 개별 합의 기준을 확인합니다."
  },
  "delivery": {
    "format": "JPG",
    "longEdgePixels": 4000,
    "channel": "전용 다운로드 링크",
    "revisionRequestDays": 14,
    "imageSpec": "{{deliveryFormat}} 장축 {{longEdgePixels}}픽셀",
    "timeline": "최종본은 {{deliveryChannel}}로 전달하며 {{revisionWindow}} 내 수정 요청을 접수합니다.",
    "rawFilePolicy": "{{deliveryFormat}} 사진을 {{deliveryChannel}}로 제공합니다.",
    "summaryTrigger": "최종 보정본 전달 후"
  },
  "retention": {
    "months": 6,
    "backupCopies": 2,
    "notice": "전달 후 {{retentionMonths}}개월 보관합니다."
  },
  "copyright": {
    "notice": "사진 저작권은 {{studioName}}에 있으며 고객은 개인 목적으로 이용합니다."
  },
  "portfolio": {
    "notice": "별도 동의한 사진만 {{studioName}}의 가상 포트폴리오에 공개합니다."
  },
  "terms": [
    {
      "id": "article_1",
      "title": "제 1조. 【계약 신청】",
      "content": "{{studioName}}의 가상 계약 검증용 약관입니다. MS-DEMO-POLICY. 실제 판매에 사용하지 않습니다."
    },
    {
      "id": "article_2",
      "title": "제 2조. 【정보 제공】",
      "content": "계약 및 촬영 준비에 필요한 최소 정보를 수집합니다."
    },
    {
      "id": "article_3",
      "title": "제 3조. 【예약금】",
      "content": "예약금 {{depositLabel}}은 신청 후 {{depositDueHours}}시간 이내 납부합니다. 입금 후 {{refundHours}}시간 이내 환불 신청이 가능합니다."
    },
    {
      "id": "article_4",
      "title": "제 4조. 【계약 무효】",
      "content": "정보가 허위이거나 촬영을 진행할 수 없는 경우 대표가 사실을 확인합니다."
    },
    {
      "id": "article_5",
      "title": "제 5조. 【일정 확정】",
      "content": "대표 검토와 예약금 확인 후 촬영 일정을 확정합니다."
    },
    {
      "id": "article_6",
      "title": "제 6조. 【계약 성립】",
      "content": "최종 승인 Snapshot이 합의된 계약 내용의 기준입니다."
    },
    {
      "id": "article_7",
      "title": "제 7조. 【잔금】",
      "content": "잔금은 {{balanceDeadline}}까지 납부합니다."
    },
    {
      "id": "article_8",
      "title": "제 8조. 【변경 및 취소】",
      "content": "변경 수수료는 {{dateChangeFeeLabel}}입니다. 취소 기준은 별도 합의한 위약금 안내를 따릅니다."
    },
    {
      "id": "article_9",
      "title": "제 9조. 【납품】",
      "content": "모먼트 납품은 최종 보정본 전달 기준입니다. MS-DELIVERY-DEMO. {{deliveryFormat}} 장축 {{longEdgePixels}}픽셀, {{deliveryChannel}} 제공, 수정 요청 {{revisionWindow}}."
    },
    {
      "id": "article_10",
      "title": "제 10조. 【보관】",
      "content": "파일은 전달 후 {{retentionMonths}}개월 보관하고 {{backupCopies}}중 백업합니다."
    },
    {
      "id": "article_11",
      "title": "제 11조. 【저작권】",
      "content": "{{copyrightNotice}}"
    },
    {
      "id": "article_12",
      "title": "제 12조. 【작품 공개】",
      "content": "{{portfolioNotice}}"
    },
    {
      "id": "article_13",
      "title": "제 13조. 【특약】",
      "content": "대표가 최종 검토한 요청사항과 특약만 최종 계약에 포함됩니다."
    }
  ],
  "privacyNotice": "모먼트 스튜디오 Demo 개인정보 안내: 모든 고객 데이터는 테스트용 가상 데이터입니다."
};
