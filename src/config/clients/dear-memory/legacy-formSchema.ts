import type { FormSchemaConfig } from '@/types/config';

// Historical P6 form settings for snapshots without schema metadata. Do not edit.
export const legacyFormSchema: FormSchemaConfig = {
  groomPhone: {
    enabled: true,
    required: true,
    label: "신랑 연락처",
    placeholder: "010-0000-0000"
  },
  bridePhone: {
    enabled: true,
    required: true,
    label: "신부 연락처",
    placeholder: "010-0000-0000"
  },
  weddingHall: {
    enabled: true,
    required: true,
    label: "홀 명칭 / 층수",
    placeholder: "예: 6층 커스티홀, 그랜드볼룸"
  },
  makeupLocation: {
    enabled: true,
    required: false,
    label: "메이크업 장소 / in, out 시간",
    placeholder: "예: 정샘물 웨스트 / in 07:00, out 10:00"
  },
  groomFamilyMembers: {
    enabled: true,
    required: false,
    label: "신랑님 직계 가족 구성원",
    placeholder: "예시) 부모님, 형, 남동생"
  },
  brideFamilyMembers: {
    enabled: true,
    required: false,
    label: "신부님 직계 가족 구성원",
    placeholder: "예시) 부모님, 언니, 여동생"
  },
  shootRequestNotes: {
    enabled: true,
    required: false,
    label: "본식스냅 촬영 시 요청사항",
    placeholder: "예시) 신랑신부 위주로 담아주세요 / 양가 부모님 사진도 자연스럽게 많이 담아주세요 / 어두운 홀 분위기를 살려주세요 등"
  },
  retouchRequestNotes: {
    enabled: true,
    required: false,
    label: "후보정 시 요청사항",
    placeholder: "예시) 피부톤을 화사하고 깨끗하게 정돈해 주세요 / 턱선 및 승모근 라인을 자연스럽게 보정해 주세요 등"
  },
  requestNotes: {
    enabled: true,
    required: false,
    label: "기타 요청사항 / 계약에 반영할 특약",
    placeholder: "식순 특이사항(축가, 깜짝 이벤트, 행진 순서 등)이나 대표 작가님께 미리 전달하고 싶은 메모가 있다면 자유롭게 적어주세요."
  },
  referralSource: {
    enabled: true,
    required: false,
    label: "알게 된 경로",
    placeholder: "예: 웨딩북, 플래너 추천, 유튜브 등"
  },
  instagramId: {
    enabled: true,
    required: false,
    label: "인스타그램 아이디",
    placeholder: "@instagram_id"
  },
  blogUrl: {
    enabled: true,
    required: false,
    label: "블로그 주소",
    placeholder: "blog.naver.com/id"
  }
};
