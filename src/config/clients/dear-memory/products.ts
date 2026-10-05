import type { ProductConfig } from '@/types/config';

export const productsConfig: ProductConfig[] = [
  {
    "id": "standard",
    "name": "실속형",
    "subtitle": "앨범 1권 상품",
    "description": "신부대기실부터 본식, 원판, 연회장까지 하루의 소중한 순간을 부부 앨범 1권에 알차게 담아내는 기본 상품",
    "includedItems": [
      "스냅 촬영 + 원판 촬영 포함",
      "신부대기실 ~ 본식 ~ 원판 ~ 연회장",
      "부부앨범 15x12 70p 1권",
      "정밀 세부 보정본 70장",
      "고화질 원본 2,000장 이상"
    ],
    "originalCount": "2,000장 이상",
    "retouchedCount": 70,
    "albumSpec": "부부앨범 15x12 70p 1권 (양가 부모님 앨범 미포함)",
    "coupleAlbumSummary": "부부 15×12 70p (1권)",
    "parentAlbumSummary": "(부모님앨범 미포함)",
    "active": true,
    "displayOrder": 1,
    "badge": "기본 상품",
    "price": 1250000,
    "shortName": "실속",
    "catalogTag": "",
    "includedHeading": "기본 포함 5대 구성",
    "premiumHeading": "화보형 프리미엄 5대 구성",
    "upgradeHeading": "화보형 특별 업그레이드"
  },
  {
    "id": "album_plus",
    "name": "화보형",
    "subtitle": "앨범 3권 상품",
    "description": "실속형 전 구성에 양가 부모님께 선물할 원판·스냅 합본 앨범 2권이 기본 포함된 인기 상품",
    "includedItems": [
      "스냅 촬영 + 원판 촬영 포함",
      "신부대기실 ~ 본식 ~ 원판 ~ 연회장",
      "부부앨범 15x12 80p 1권",
      "부모님 앨범 12x8 40p 2권 제공",
      "정밀 세부 보정본 70장 + 추가 10장 / 원본 2,500장 이상"
    ],
    "originalCount": "2,500장 이상",
    "retouchedCount": 70,
    "additionalRetouchedCount": 10,
    "additionalOriginalCount": 500,
    "coupleAlbumSummary": "부부 15×12 80p (1권)",
    "parentAlbumSummary": "부모님 12×8 40p (2권)",
    "mobilePlusItems": [
      "실속형 전 구성 100% 기본 포함",
      "부모님 앨범 2권 추가 제공 (40p)",
      "부부앨범 80p (+10p 증면)",
      "정밀 세부 보정본 (+10장 추가)",
      "고화질 원본 (+500장 추가)"
    ],
    "albumSpec": "부부앨범 15x12 80p 1권\n부모님앨범 12x8 40p 2권 [원판·스냅 합본]",
    "active": true,
    "displayOrder": 2,
    "badge": "대표 추천",
    "isPlusPackage": true,
    "baseIncludedNotice": "실속형 전 촬영 구성 100% 기본 포함",
    "plusBenefits": [
      {
        "title": "부모님 앨범 12x8 40p 2권 제공",
        "detail": "부모님 앨범 12x8 40p 2권 [원판·스냅 합본, 양가 부모님 선물용]",
        "badge": "2권 추가"
      }
    ],
    "price": 1450000,
    "shortName": "화보",
    "catalogTag": "부모님 앨범",
    "includedHeading": "기본 포함 5대 구성",
    "premiumHeading": "화보형 프리미엄 5대 구성",
    "upgradeHeading": "화보형 특별 업그레이드"
  }
];
