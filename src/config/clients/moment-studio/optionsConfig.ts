import type { OptionConfig } from '@/types/config';

// Fictional studio configuration for isolated regression testing.
export const optionsConfig: OptionConfig[] = [
  {
    "id": "moment_assistant",
    "name": "모먼트 보조 작가",
    "shortName": "보조 작가",
    "price": 180000,
    "description": "추가 작가 1인 배정",
    "active": true,
    "displayOrder": 1
  },
  {
    "id": "moment_after_party",
    "name": "모먼트 애프터파티",
    "shortName": "애프터파티",
    "price": 90000,
    "description": "예식 후 애프터파티 30분 촬영",
    "active": true,
    "displayOrder": 2
  }
];
