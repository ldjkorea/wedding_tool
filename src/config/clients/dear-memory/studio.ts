import type { StudioConfig } from '@/types/config';
import { DEAR_MEMORY_LOGO_BASE64, HANMINGYU_SEAL_BASE64 } from './assets';

// Public metadata only. The operational recipient is required in REPRESENTATIVE_EMAIL.
export const studioConfig: StudioConfig = {
  "studioId": "dear-memory",
  "studioName": "디어메모리",
  "displayName": "DEAR MEMORY",
  "friendlyName": "Dear Memory",
  "representativeName": "한민규",
  "representativeEmail": "",
  "representativePhone": "010-4822-2615",
  "website": "https://dearmemory.co.kr",
  "logo": DEAR_MEMORY_LOGO_BASE64,
  "seal": HANMINGYU_SEAL_BASE64,
  "contractPrefix": "DM",
  "brandTagline": "본식스냅 스튜디오 디어메모리",
  "emailSenderName": "Wedding Booking",
  "driveFolderName": "Dear Memory/Contracts",
  "bookingName": "DEAR MEMORY FOR BOOKING",
  "photographyLabel": "WEDDING PHOTOGRAPHY",
  "contactChannel": "카카오톡 채널 '디어메모리'",
  "colors": {
    "primary": "#322A1B",
    "secondary": "#B09A74",
    "warm": {
      "50": "#FAF8F5",
      "100": "#F5F1EA",
      "200": "#EBE3D5",
      "300": "#DDD1BD",
      "400": "#C7B698",
      "500": "#B09A74",
      "600": "#8F7A56",
      "700": "#6E5C3D",
      "800": "#4E412A",
      "900": "#322A1B"
    },
    "primaryHover": "#1E1910",
    "subtleText": "#A8987E",
    "softBorder": "#F0EAE1",
    "paleBorder": "#F0EBE1",
    "pdfAccent": "#B45309"
  }
};
