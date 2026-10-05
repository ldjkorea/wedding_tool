import type { FormSchemaConfig } from '@/types/config';

// Fictional studio configuration for isolated regression testing.
export const formSchema: FormSchemaConfig = {
  "groomPhone": {
    "enabled": true,
    "required": false,
    "label": "신랑 연락처 (모먼트 선택)",
    "placeholder": "연락 가능한 번호를 입력해 주세요"
  },
  "bridePhone": {
    "enabled": false,
    "required": false,
    "label": "신부 연락처",
    "placeholder": ""
  },
  "weddingHall": {
    "enabled": true,
    "required": false,
    "label": "상세 홀 / 층수 (모먼트 선택)",
    "placeholder": "필요한 경우에만 작성"
  },
  "makeupLocation": {
    "enabled": false,
    "required": false,
    "label": "메이크업 준비 정보",
    "placeholder": ""
  },
  "groomFamilyMembers": {
    "enabled": false,
    "required": false,
    "label": "신랑 가족 구성",
    "placeholder": ""
  },
  "brideFamilyMembers": {
    "enabled": false,
    "required": false,
    "label": "신부 가족 구성",
    "placeholder": ""
  },
  "shootRequestNotes": {
    "enabled": true,
    "required": true,
    "label": "모먼트 촬영 요청",
    "placeholder": "특별 요청이 없으면 없음"
  },
  "retouchRequestNotes": {
    "enabled": true,
    "required": false,
    "label": "모먼트 보정 요청",
    "placeholder": "자연스러운 보정을 원합니다"
  },
  "requestNotes": {
    "enabled": true,
    "required": false,
    "label": "모먼트 계약 특약",
    "placeholder": "계약에 반영할 요청"
  },
  "referralSource": {
    "enabled": true,
    "required": true,
    "label": "모먼트 유입경로",
    "placeholder": "기타 경로를 알려주세요"
  },
  "instagramId": {
    "enabled": false,
    "required": false,
    "label": "인스타그램 아이디",
    "placeholder": ""
  },
  "blogUrl": {
    "enabled": true,
    "required": false,
    "label": "모먼트 후기 링크",
    "placeholder": "선택 후기 주소"
  }
};
