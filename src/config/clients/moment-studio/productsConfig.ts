import type { ProductConfig } from '@/types/config';

// Fictional studio configuration for isolated regression testing.
export const productsConfig: ProductConfig[] = [
  {
    "id": "moment_essential",
    "name": "모먼트 에센셜",
    "shortName": "에센셜",
    "price": 980000,
    "description": "디지털 중심의 모먼트 기본 촬영",
    "subtitle": "디지털 컬렉션",
    "includedItems": [
      "예식 현장 스냅 촬영",
      "보정 사진 40장",
      "원본 1,200장 이상"
    ],
    "retouchedCount": 40,
    "originalCount": "1,200장 이상",
    "albumSpec": "앨범 미포함",
    "coupleAlbumSummary": "디지털 사진 제공",
    "parentAlbumSummary": "앨범 미포함",
    "active": true,
    "displayOrder": 1,
    "includedHeading": "에센셜 기본 제공",
    "premiumHeading": "시그니처 추가 제공",
    "upgradeHeading": "시그니처 업그레이드"
  },
  {
    "id": "moment_signature",
    "name": "모먼트 시그니처",
    "shortName": "시그니처",
    "price": 1680000,
    "description": "앨범과 추가 보정이 포함된 모먼트 촬영",
    "subtitle": "앨범 컬렉션",
    "includedItems": [
      "예식 현장 스냅 촬영",
      "보정 사진 90장",
      "원본 2,200장 이상",
      "부부 앨범 1권"
    ],
    "retouchedCount": 90,
    "originalCount": "2,200장 이상",
    "albumSpec": "10x10 60p 앨범 1권",
    "coupleAlbumSummary": "부부 10x10 60p 1권",
    "parentAlbumSummary": "부모님 앨범 미포함",
    "active": true,
    "displayOrder": 2,
    "isPlusPackage": true,
    "mobilePlusItems": [
      "보정 사진 총 90장",
      "부부 앨범 1권"
    ],
    "plusBenefits": [
      {
        "title": "시그니처 앨범",
        "detail": "부부 앨범 1권"
      }
    ],
    "includedHeading": "시그니처 기본 제공",
    "premiumHeading": "시그니처 혜택",
    "upgradeHeading": "시그니처 구성"
  }
];
