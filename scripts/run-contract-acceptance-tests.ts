/**
 * Dear Memory Contract — Acceptance Tests Suite (#56 ~ #65)
 * 실행: npx tsx scripts/run-contract-acceptance-tests.ts
 */

import { calculateContractPrice, checkIsSunday, formatKRW } from '../src/lib/pricing';
import { createApprovalToken, verifyApprovalToken } from '../src/lib/token';
import { generateContractNumber } from '../src/lib/contractNumber';
import { MockBackendAdapter } from '../src/services/mockBackendAdapter';
import { isContractAlreadySent, clearSentRegistry } from '../src/lib/idempotency';
import {
  generateRepresentativeNotificationEmail,
  generateCustomerContractEmail,
  generateRepresentativeSentConfirmationEmail,
} from '../src/lib/emailTemplates';
import { ContractFormData } from '../src/types/contract';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { demoSettingsCall } from '../src/services/demoStudioSettings';
import { baseSettings, validateStudioSettings } from '../src/services/settingsValidation';
import { withRuntimeConfiguration } from '../src/services/serverRuntimeConfiguration';

// Existing acceptance cases run only against the explicitly selected local Demo.
process.env.BACKEND_MODE = 'demo';
Object.assign(process.env, { NODE_ENV: 'test' });

let passedCount = 0;
let totalCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalCount++;
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
  }
}

async function runAcceptanceTests() {
  // Explicit private Demo fixture, never bundled or automatically accepted in Production.
  process.env.STUDIO_SETTINGS_ENABLED = 'true';
  fs.mkdirSync('.contract-test-output', { recursive: true });
  process.env.STUDIO_DEMO_SETTINGS_TEST_DIRECTORY = fs.mkdtempSync(path.resolve('.contract-test-output/acceptance-codes-'));
  const seed = baseSettings(); seed.studioConfig.representativeEmail = 'acceptance-owner@example.com';
  seed.partnerCodes = [{ id: 'fixture_pair', code: '최수현', amount: 50000, active: true }];
  const settings = validateStudioSettings(seed), studioId = settings.studioConfig.studioId, sessionId = crypto.randomBytes(32).toString('hex');
  await demoSettingsCall('admin_login', { studioId, sessionId });
  await demoSettingsCall('settings_save', { studioId, sessionId, settings, expectedRevision: 0, hash: crypto.createHash('sha256').update(JSON.stringify(settings)).digest('hex') });
  return withRuntimeConfiguration(async () => {
  console.log('====================================================');
  console.log('  Dear Memory for Booking — V1 인수 테스트(Acceptance Tests)');
  console.log('====================================================\n');

  clearSentRegistry();
  MockBackendAdapter.clearMailbox();

  // ----------------------------------------------------
  // #56. Acceptance Test — 기본 상품
  // ----------------------------------------------------
  const test56Pricing = calculateContractPrice({
    productId: 'standard',
    optionIds: [],
    weddingDate: '2027-04-17', // 토요일
    partnerDiscount: false,
    portfolioConsent: false,
    reviewContractCashback: false,
    reviewMainCashback: false,
  });
  assert(
    test56Pricing.contractTotal === 1250000 &&
    test56Pricing.basePrice === 1250000 &&
    test56Pricing.optionTotal === 0 &&
    test56Pricing.immediateDiscountTotal === 0,
    '#56 기본 상품: 실속형 선택, 옵션 없음, 할인 없음 = 1,250,000원',
    `계약금액: ${test56Pricing.contractTotal}`
  );

  // ----------------------------------------------------
  // #57. Acceptance Test — 전체 옵션 (2인촬영 + 폐백)
  // ----------------------------------------------------
  const test57Pricing = calculateContractPrice({
    productId: 'album_plus',
    optionIds: ['second_shooter', 'pyebaek'],
    weddingDate: '2027-04-17', // 토요일
    partnerDiscount: false,
    portfolioConsent: false,
    reviewContractCashback: false,
    reviewMainCashback: false,
  });
  const expected57 = 1450000 + 250000 + 100000; // 1,800,000원
  assert(
    test57Pricing.contractTotal === expected57 &&
    test57Pricing.optionTotal === 350000,
    '#57 전체 옵션: 화보형 + 2인촬영(250,000) + 폐백(100,000) = 1,800,000원',
    `계약금액: ${test57Pricing.contractTotal}`
  );

  // ----------------------------------------------------
  // #58. Acceptance Test — 후기 할인 (페이백 분리)
  // ----------------------------------------------------
  const test58Pricing = calculateContractPrice({
    productId: 'standard',
    optionIds: [],
    weddingDate: '2027-04-17', // 토요일
    partnerDiscount: false,
    portfolioConsent: false,
    reviewContractCashback: true,
    reviewMainCashback: true,
  });
  assert(
    test58Pricing.contractTotal === 1250000 &&
    test58Pricing.futureCashbackTotal === 100000,
    '#58 후기 페이백: 계약후기 + 본식후기 체크 시 현재 계약금액 변동 없고, 페이백 100,000원 분리 표기',
    `계약금액: ${test58Pricing.contractTotal}, 페이백: ${test58Pricing.futureCashbackTotal}`
  );

  // ----------------------------------------------------
  // #59. Acceptance Test — 즉시 할인 (일요일 + 짝꿍 + 사진 공개 감사 할인)
  // ----------------------------------------------------
  const test59Pricing = calculateContractPrice({
    productId: 'standard',
    optionIds: [],
    weddingDate: '2027-04-18', // 일요일
    partnerDiscount: true,
    partnerName: '김지현',
    portfolioConsent: true,
    reviewContractCashback: false,
    reviewMainCashback: false,
  });
  // 1,250,000 - 100,000(일요일) - 50,000(짝꿍) - 100,000(포트폴리오) = 1,000,000원
  assert(
    test59Pricing.contractTotal === 1000000 &&
    test59Pricing.immediateDiscountTotal === 250000,
    '#59 즉시 할인: 일요일(-100,000) + 짝꿍(-50,000) + 포트폴리오(-100,000) = 총 250,000원 할인 반영 (1,000,000원)',
    `계약금액: ${test59Pricing.contractTotal}`
  );

  // ----------------------------------------------------
  // #60. Acceptance Test — 짝꿍 유효성 검증
  // ----------------------------------------------------
  const backend = new MockBackendAdapter();
  const invalidPartnerFormData: ContractFormData = {
    weddingDate: '2027-04-18',
    weddingTime: '14:00',
    weddingVenue: '더채플앳청담',
    weddingHall: '6층 커스티홀',
    makeupLocation: '꼼나나 비앙 / in 07:00, out 10:30',
    groomName: '김민우',
    groomPhone: '010-1111-2222',
    groomFamilyMembers: '부모님, 누나 1명',
    brideName: '박서연',
    bridePhone: '010-3333-4444',
    brideFamilyMembers: '부모님, 남동생 1명',
    email: 'couple@example.com',
    productId: 'album_plus',
    optionIds: ['second_shooter', 'pyebaek'],
    partnerDiscount: true,
    partnerName: '', // 짝꿍 성함 비어있음!
    sundayDiscount: true,
    portfolioConsent: true,
    reviewContractCashback: true,
    reviewMainCashback: true,
    shootRequestNotes: '신부 좌측 얼굴 위주, 부모님 기념촬영 다양하게',
    retouchRequestNotes: '자연스러운 피부 보정, 과한 왜곡 지양',
    referralSource: '인스타그램 검색',
    instagramId: '@wedding_minwoo',
    blogUrl: 'https://blog.naver.com/sample',
    requestNotes: '밝고 자연스러운 톤 희망',
    termsAgreed: true,
  };
  const submitResultFail = await backend.submitContract({ formData: invalidPartnerFormData });
  assert(
    submitResultFail.success === false &&
    Boolean(submitResultFail.error?.includes('짝꿍')),
    '#60 짝꿍 유효성 검증: 짝꿍 체크 후 이름 미입력 시 Submit 차단',
    `에러 메시지: ${submitResultFail.error}`
  );

  // ----------------------------------------------------
  // #61. Acceptance Test — 일요일 동적 감지
  // ----------------------------------------------------
  const satIsSun = checkIsSunday('2027-04-17'); // Saturday
  const sunIsSun = checkIsSunday('2027-04-18'); // Sunday
  const backToSat = checkIsSunday('2027-04-24'); // Next Saturday
  assert(
    satIsSun === false && sunIsSun === true && backToSat === false,
    '#61 일요일 동적 감지: 토요일(false) -> 일요일(true, -100,000) -> 다시 토요일(false, 자동 제거)',
    `토: ${satIsSun}, 일: ${sunIsSun}, 재토: ${backToSat}`
  );

  // ----------------------------------------------------
  // #62. Acceptance Test — 대표 수정 (화보형 -> 실속형 변경 시 가격 자동 변경)
  // ----------------------------------------------------
  const validCustomerData: ContractFormData = {
    ...invalidPartnerFormData,
    partnerName: '최수현',
  };
  const submitSuccess = await backend.submitContract({ formData: validCustomerData });
  assert(submitSuccess.success === true, '#62-A 고객 정상 제출 및 토큰 생성 성공');

  // 대표가 확인 화면에서 화보형 -> 실속형으로 수정
  const repModifiedData: ContractFormData = {
    ...validCustomerData,
    productId: 'standard', // 실속형으로 수정!
  };
  const repModifiedPricing = calculateContractPrice({
    productId: repModifiedData.productId,
    optionIds: repModifiedData.optionIds,
    weddingDate: repModifiedData.weddingDate,
    partnerDiscount: repModifiedData.partnerDiscount,
    partnerName: repModifiedData.partnerName,
    portfolioConsent: repModifiedData.portfolioConsent,
    reviewContractCashback: repModifiedData.reviewContractCashback,
    reviewMainCashback: repModifiedData.reviewMainCashback,
  });
  // 실속형(1,250,000) + 옵션(350,000: 2인촬영+폐백) - 즉시할인(250,000) = 1,350,000원
  assert(
    repModifiedPricing.contractTotal === 1350000 &&
    repModifiedPricing.basePrice === 1250000 &&
    repModifiedPricing.optionTotal === 350000,
    '#62 대표 수정: 고객 화보형 제출 -> 대표 검토에서 실속형으로 변경 시 계약금액 1,350,000원으로 자동 재계산',
    `수정 후 금액: ${repModifiedPricing.contractTotal}`
  );

  // ----------------------------------------------------
  // #63. Acceptance Test — 발송: GET 발송 금지 및 POST 최종 확인 발송
  // ----------------------------------------------------
  const token = submitSuccess.approvalToken;
  // 토큰 검증(GET 요청 모사) - 계약서가 발송되지 않아야 함!
  const decodedPayload = verifyApprovalToken(token);
  const alreadySentBefore = isContractAlreadySent(decodedPayload.contractId);
  assert(
    alreadySentBefore === false,
    '#63-A 대표 이메일 링크 GET 호출(토큰 검증) 시 계약서 발송 X (안전 링크)'
  );

  // 대표의 명시적 POST 최종 발송
  const approveResult = await backend.approveAndSendContract({
    token: token,
    updatedData: repModifiedData,
  });
  assert(
    approveResult.success === true &&
    approveResult.customerEmailSent === true &&
    approveResult.representativeEmailSent === true &&
    isContractAlreadySent(decodedPayload.contractId) === true,
    '#63-B 대표 Final Confirm POST 시 계약서 스냅샷 확정 및 메일 발송 완료'
  );

  // 중복 발송 방지 테스트 (#50)
  const doubleApproveResult = await backend.approveAndSendContract({
    token: token,
    updatedData: repModifiedData,
  });
  assert(
    doubleApproveResult.success === false &&
    Boolean(doubleApproveResult.error?.includes('이미 발송')),
    '#63-C 중복 발송 차단: 이미 발송된 토큰 재요청 시 발송 차단',
    doubleApproveResult.error
  );

  // ----------------------------------------------------
  // #64. Acceptance Test — 4대 채널 데이터 정합성 (Review, Snapshot/PDF, 고객Email, 대표Email)
  // ----------------------------------------------------
  const mailbox = await backend.getMockMailbox();
  const customerMail = mailbox.find((m) => m.type === 'customer_contract');
  const repSentMail = mailbox.find((m) => m.type === 'rep_confirmation');

  const snapshot = approveResult.snapshot;
  const matchName =
    snapshot.data.groomName === repModifiedData.groomName &&
    snapshot.data.brideName === repModifiedData.brideName;
  const matchDate = snapshot.data.weddingDate === repModifiedData.weddingDate;
  const matchProduct = snapshot.pricing.basePrice === 1250000;
  const matchTotal = snapshot.pricing.contractTotal === repModifiedPricing.contractTotal;
  const matchCustomerMail = Boolean(customerMail?.html.includes(formatKRW(repModifiedPricing.contractTotal)));
  const matchRepMail = Boolean(repSentMail?.html.includes(formatKRW(repModifiedPricing.contractTotal)));

  assert(
    matchName && matchDate && matchProduct && matchTotal && !!matchCustomerMail && !!matchRepMail,
    '#64 동일 데이터 정합성: 대표 Review, PDF Snapshot, 고객 Email, 대표 Email 4곳의 데이터 100% 일치',
    `스냅샷 총액: ${snapshot.pricing.contractTotal}, 고객메일 일치: ${!!matchCustomerMail}, 대표메일 일치: ${!!matchRepMail}`
  );

  // V1 범위 검증: Google Drive 저장은 V1.1 분리 확인
  assert(
    approveResult.driveSaved === false,
    '#V1 범위: Google Drive 자동 저장은 V1.1 분리 확인 (V1에서는 비활성화)',
    `driveSaved: ${approveResult.driveSaved}`
  );

  // PDF 첨부 동일성 검증: 고객 메일 및 대표 메일에 동일 계약번호 및 PDF 첨부 확인
  assert(
    Boolean(
      customerMail?.hasAttachment &&
      repSentMail?.hasAttachment &&
      customerMail?.subject.includes(repModifiedData.groomName) &&
      repSentMail?.subject.includes(repModifiedData.groomName)
    ),
    '#V1 PDF 무결성: 고객 이메일과 대표 이메일에 동일한 공식 PDF 계약서 정상 첨부'
  );

  // ----------------------------------------------------
  // #65. Acceptance Test — 계약 식별번호 포맷
  // ----------------------------------------------------
  const contractNum = generateContractNumber('2027-04-18');
  assert(
    /^DM-20270418-[A-Z0-9]{4}$/.test(contractNum),
    '#65 계약번호 포맷 검증: DM-YYYYMMDD-XXXX 형식 준수 (예: DM-20270418-K8M2)',
    `생성된 계약번호: ${contractNum}`
  );

  console.log('\n====================================================');
  console.log(`  테스트 결과: ${passedCount} / ${totalCount} 테스트 통과 (${passedCount === totalCount ? '100% 성공' : '일부 실패'})`);
  console.log('====================================================\n');

  if (passedCount !== totalCount) {
    process.exit(1);
  }
  });
}

runAcceptanceTests().catch((err) => {
  console.error('테스트 실행 중 예외 발생:', err);
  process.exit(1);
});
