import type { ConfiguredContractPolicy } from '@/types/config';

export const contractPolicy: ConfiguredContractPolicy = {
  "version": "2026.09.v1",
  "deposit": {
    "amount": 300000
  },
  "payment": {
    "depositDueHours": 24,
    "balanceDueDaysBeforeWedding": 7,
    "taxLabel": "VAT 포함"
  },
  "cancellation": {
    "dateChangeFee": 100000,
    "disasterCancellationFee": 200000,
    "tiers": [
      {
        "label": "촬영 확정일 90일 이전",
        "rate": null
      },
      {
        "label": "촬영 확정일 60~90일 내",
        "rate": 50
      },
      {
        "label": "촬영 확정일 30~60일 내",
        "rate": 70
      },
      {
        "label": "촬영 확정일 30일 내",
        "rate": 80
      }
    ],
    "summary": [
      "촬영 확정일 90일 이전: 계약금을 위약금으로 갈음",
      "촬영 60~90일 내: 총 상품 금액의 50% | 30~60일 내: 70% | 30일 내: 80%"
    ]
  },
  "refund": {
    "fullRefundWindowHours": 72,
    "afterWindowNotice": "일정 마감에 따라 환불이 불가합니다."
  },
  "delivery": {
    "format": "JPG",
    "longEdgePixels": 3000,
    "channel": "이메일",
    "revisionRequestDays": 7,
    "imageSpec": "{{deliveryFormat}} 파일 (장축 {{longEdgePixels}}픽셀 초고화질, {{deliveryChannel}} 제공)",
    "timeline": "전체 원본 및 보정본은 {{deliveryChannel}}로 발송되며, 앨범 수령 기점 {{revisionWindow}} 이내 수정 요청 가능합니다.",
    "rawFilePolicy": "촬영 후 데이터는 {{backupCopies}}중 백업으로 안전하게 관리되며, 원본/수정본은 {{deliveryFormat}} 파일로 {{deliveryChannel}} 제공됩니다.",
    "summaryTrigger": "최종 보정본 전달 후"
  },
  "retention": {
    "months": 3,
    "backupCopies": 3,
    "notice": "촬영된 원본은 예약자에게 전달된 날을 기준으로 {{retentionMonths}}개월까지만 보관되므로 수령 즉시 개인 백업을 권장합니다."
  },
  "copyright": {
    "notice": "저작권은 {{studioName}}에 상품제작을 위탁한 신랑신부님과 {{studioName}}가 공동 소유하게 되며, 해당 상품에 모든 인물의 초상권은 신랑신부님의 권한입니다. {{portfolioNotice}} 서비스 이용자의 개인적 용도의 이용 외에 상업적 목적으로의 반출 또는 무단으로 도용, 복사 시 법적 제재를 받을 수 있습니다."
  },
  "portfolio": {
    "notice": "포트폴리오 동의 시 {{studioName}}는 해당 상품의 사진을 해당 홈페이지({{websiteHost}})와 블로그, 인스타그램에 게시할 수 있습니다."
  },
  "terms": [
    {
      "id": "article_1",
      "title": "제 1조. 【계약 신청서】",
      "content": "계약 신청서는 서비스를 이용자가 서비스 이용을 원하는 날짜, 시간, 장소 등을 확약하는 약정서입니다. 서비스 이용자는 {{studioName}}가 제공하는 서비스에 대하여 충분한 상담을 받고 정확히 숙지하여 최종 결정하였으며, 제공되는 서비스가 상담 내용에 반하지 않는 한 이 약관 동의서를 준용합니다. 본 계약은 예약자가 '{{studioName}}'에게 사진 촬영에 관하여 사진촬영 업무대행을 위임함에 있어 상호 신뢰로서 업무를 진행하며 '{{studioName}}'는 의뢰인의 업무를 성실히 수행, 동반자로서 양자 간의 이익을 도모함에 있습니다."
    },
    {
      "id": "article_2",
      "title": "제 2조. 【정보 제공 동의】",
      "content": "{{studioName}}는 서비스를 원활히 제공하기 위한 정보를 서비스 이용자에게 요구할 수 있으며, 서비스 이용자는 정보를 제공하는데 동의합니다. {{studioName}}는 제공받은 서비스 이용자의 정보를 서비스 제공의 목적 외의 이용을 금하며, 본래의 목적 외의 활동에 활용하였을 경우 서비스 이용자는 이의를 제기할 수 있습니다."
    },
    {
      "id": "article_3",
      "title": "제 3조. 【계약금】",
      "content": "계약금은 {{depositLabel}} 입금을 원칙으로 하며, 계약금 입금은 계약 신청서 제출 이후 {{depositDueHours}}시간 이내로 합니다. 서비스 이용자는 계약금 입금 후 {{refundHours}}시간 이내에 환불(계약의 무효)을 요청할 수 있으며, {{studioName}}는 환불 요청된 계약금을 입금합니다. 단, 계약금 입금 {{refundHours}}시간 이후에는 환불 진행이 되지 않습니다. 변경된 계약 날짜에 촬영이 불가한 경우, {{dateChangeFeeLabel}}의 수수료가 발생됩니다."
    },
    {
      "id": "article_4",
      "title": "제 4조. 【계약의 무효】",
      "content": "계약 신청서가 허위로 작성되었거나 서비스 제공을 위한 충분한 정보가 제공되지 못할 경우(+제 2조. 정보 제공 동의 참조), 계약금 입금 시간이 초과되었을 경우(+제 3조. 계약금 참조) 위 사항을 근거로 {{studioName}}는 계약 신청서를 파기할 수 있으며, 이는 {{studioName}}와 서비스 이용자의 계약이 무효가 되었음을 의미합니다."
    },
    {
      "id": "article_5",
      "title": "제 5조. 【계약 확인】",
      "content": "{{studioName}}는 서비스 이용자의 계약 신청서 제출과 계약금 입금 여부를 확인하고, 서비스 이용자가 서비스를 받기 원하는 날짜, 시간, 장소 등을 확정하여 이용자에 스케줄 계약 사실을 확인합니다."
    },
    {
      "id": "article_6",
      "title": "제 6조. 【계약의 성립】",
      "content": "서비스 이용자는 정보 제공과 계약금이 입금 스케줄 확정이 되었다면, {{studioName}}는 직접적인 서비스 제공 계약 관계가 성립되었음을 의미합니다."
    },
    {
      "id": "article_7",
      "title": "제 7조. 【잔금 입금】",
      "content": "서비스 이용자는 상담에 있어 명확한 명시가 없는 한, 최소 서비스 제공일 {{balanceDeadline}} 이전에 잔금을 입금해야 합니다. 잔금 입금이 과도하게 지연될 경우, 계약이 파기되며 위약금이 발생합니다."
    },
    {
      "id": "article_8",
      "title": "제 8조. 【계약의 파기】",
      "content": "{{studioName}}는 서비스 이용자의 귀책 사유로 인하여 계약을 파기할 수 있으며, 위약금이 발생합니다.\n- 잔금 입금 날짜를 과도하게 지연\n- 계약된 상품을 타인에게로의 양도, 양수\n- 계약 확정 이후 개인적 사유로 인한 스케줄 취소"
    },
    {
      "id": "article_9",
      "title": "제 9조. 【원본(데이터) 보관 및 제공】",
      "content": "{{studioName}}는 촬영된 원본을 예약자에게 전달된 날을 기준으로 {{retentionMonths}}개월까지만 보관하고 있습니다. 서비스 이용자는 상품 수령 후 반드시 데이터를 백업하며, 수령 후 {{retentionMonths}}개월 내 데이터의 분실 또는 상품에 문제가 있는 경우 필요한 조치를 받을 수 있습니다. 원본, 수정본은 {{deliveryFormatLower}} 파일, 장축 {{longEdgePixelsLabel}} 픽셀을 {{deliveryChannel}}로 제공해 드리고 있습니다."
    },
    {
      "id": "article_10",
      "title": "제 10조. 【위약금 재해 특별 규정】",
      "content": "서비스 이용자의 귀책사유로 계약이 파기되었을 경우에는 위약금이 발생하므로 신중하게 결정하고 계약하시기 바랍니다.\n{{cancellationTiers}}\n질병이나 자연재해 등으로 인한 스케줄 연기나 취소 시 정부의 인원 제한이 있는 경우 스케줄 무료 연기가 가능하며, {{studioName}} 스케줄 마감으로 부득이하게 계약을 취소해야 하는 경우 예약금을 제외한 {{disasterFeeLabel}}의 취소 수수료가 발생합니다. 인원 제한 방침이 아닌 결혼식의 원천 금지 명령 시 별도의 위약금이나 수수료가 없고 예약금 전액 환불해 드립니다."
    },
    {
      "id": "article_11",
      "title": "제 11조. 【수정 작업】",
      "content": "납품된 앨범 및 사진의 수정 요청은 제3자가 보아도 앨범 및 사진의 불량 상태가 명확한 경우에만 진행 가능합니다. 수정에 대한 결정은 상품을 수령받은 기점으로 {{revisionWindow}} 이내에 요청해 주셔야 합니다."
    },
    {
      "id": "article_12",
      "title": "제 12조. 【보상 규정】",
      "content": "소비자피해보상규정에 의거하여 촬영 원본의 멸실 및 재해로 인한 사고 발생 시 촬영 계약금 전액을 환불해 드리며, 촬영 계약금 이외 피해 보상은 결과물에 대한 손실 정도에 따라 상호 합의하에 계약금액의 2배까지 배상합니다. 해당 업체는 한 번도 데이터 분실 사고가 없었으며, 촬영 후 데이터를 {{backupCopies}}중 백업을 하고 가장 중요하게 관리합니다. 단순 변심 또는 사진 스타일이 마음에 들지 않거나 촬영 현장(예식장, 모든 촬영 대상 인물 등)의 문제로 발생한 모든 내용은 환불 및 기타 보상 대상 건에서 제외합니다."
    },
    {
      "id": "article_13",
      "title": "제 13조. 【저작권 및 초상권】",
      "content": "{{copyrightNotice}}"
    }
  ],
  "privacyNotice": "※ {{studioName}}의 모든 상품 계약은 본 촬영 약관에 동의 절차를 확인 후 진행되며, 계약 진행된 모든 상품은 촬영 약관에 동의한 것으로 간주됩니다. {{studioName}}는 약관 동의 및 본식스냅 계약 체결/일정 조율을 위해 개인정보를 수집∙이용합니다."
};
