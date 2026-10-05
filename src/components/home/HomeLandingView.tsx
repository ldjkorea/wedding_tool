import { getStudioConfig, getProducts, getOptions, getClientContent } from '@/services/configuration';
import React from 'react';
import { Camera, FileEdit, ArrowRight, Sparkles, ShieldCheck } from 'lucide-react';


interface HomeLandingViewProps {
  onSelectCatalog: () => void;
  onSelectApply: () => void;
}

export const HomeLandingView: React.FC<HomeLandingViewProps> = ({
  onSelectCatalog,
  onSelectApply,
}) => {
  const studio = getStudioConfig();
  return (
    <div className="max-w-3xl mx-auto py-5 sm:py-10 space-y-6 sm:space-y-8 animate-fade-in">
      {/* 2대 선택 카드: 모바일에서도 한 화면에 좌우 2열(grid-cols-2)로 나란히 표시 */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-6 items-stretch">

        {/* 카드 1: 계약상품 구경하기 */}
        <div
          onClick={onSelectCatalog}
          className="group cursor-pointer bg-[#FFFFFF] border border-[rgb(var(--studio-border))] hover:border-[rgb(var(--studio-primary))] rounded-2xl sm:rounded-3xl p-3 sm:p-7 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between h-full relative overflow-hidden"
        >
          <div className="space-y-2 sm:space-y-3.5 flex-1 flex flex-col">
            {/* 아이콘 */}
            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-border))] flex items-center justify-center text-[rgb(var(--studio-muted))] group-hover:bg-[rgb(var(--studio-primary))] group-hover:text-[rgb(var(--studio-background))] transition-colors shrink-0">
              <Camera className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>

            {/* 헤더 & 제목 */}
            <div>
              <span className="text-[9px] sm:text-[11px] font-semibold text-[rgb(var(--studio-muted))] tracking-wider uppercase h-4 flex items-center">
                PRODUCTS
              </span>
              <h3 className="text-xs sm:text-xl font-serif font-bold text-[rgb(var(--studio-primary))] h-6 sm:h-8 flex items-center leading-tight">
                계약상품 구경하기
              </h3>
              <p className="text-[10px] sm:text-xs text-[rgb(var(--studio-body))] leading-tight break-keep h-7 sm:h-9 flex items-center">
                {getProducts().map(product => product.name).join('·')} 구성과 혜택을 한눈에 살펴봅니다.
              </p>
            </div>

            {/* 주요 하이라이트 박스 (높이 완벽 일치) */}
            <div className="p-2 sm:p-3.5 bg-[rgb(var(--studio-background))] rounded-xl border border-[rgb(var(--studio-border))] space-y-1 sm:space-y-1.5 text-[9.5px] sm:text-xs text-[rgb(var(--studio-muted))] h-[78px] sm:h-[98px] flex flex-col justify-center">
              <div className="flex items-center gap-1 sm:gap-1.5 truncate">
                <span className="text-[rgb(var(--studio-accent))] shrink-0">•</span>
                <span className="font-semibold text-[rgb(var(--studio-primary))] truncate">{getProducts().map(product => (product.shortName || product.name) + ' ' + (product.basePrice / 10000).toLocaleString('ko-KR') + '만').join(' / ')}</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 truncate">
                <span className="text-[rgb(var(--studio-accent))] shrink-0">•</span>
                <span className="truncate">{getOptions().map(option => option.shortName || option.name).join(' · ')} 옵션</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 truncate">
                <span className="text-[rgb(var(--studio-accent))] shrink-0">•</span>
                <span className="truncate">{getClientContent().homeDiscountSummary}</span>
              </div>
            </div>
          </div>

          {/* 하단 액션 버튼 */}
          <div className="mt-3 sm:mt-6 pt-2.5 sm:pt-4 border-t border-[rgb(var(--studio-surface))] flex items-center justify-between text-[10.5px] sm:text-xs font-semibold text-[rgb(var(--studio-primary))] group-hover:text-[rgb(var(--studio-muted))] transition-colors h-7 sm:h-8">
            <span>상품 보기</span>
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* 카드 2: 계약정보 작성하기 */}
        <div
          onClick={onSelectApply}
          className="group cursor-pointer bg-[#FFFFFF] border-2 border-[rgb(var(--studio-primary))]/80 hover:border-[rgb(var(--studio-primary))] rounded-2xl sm:rounded-3xl p-3 sm:p-7 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between h-full relative overflow-hidden bg-gradient-to-br from-[#FFFFFF] to-[rgb(var(--studio-background))]"
        >
          {/* 상단 추천 뱃지 */}
          <div className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4">
            <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))] rounded-full text-[8.5px] sm:text-[10px] font-semibold tracking-wider flex items-center">
              <span className="hidden sm:inline">상담 완료 고객</span>
              <span className="sm:hidden">추천</span>
            </span>
          </div>

          <div className="space-y-2 sm:space-y-3.5 flex-1 flex flex-col">
            {/* 아이콘 */}
            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))] flex items-center justify-center shrink-0">
              <FileEdit className="w-4 h-4 sm:w-6 sm:h-6 text-[rgb(var(--studio-highlight))]" />
            </div>

            {/* 헤더 & 제목 */}
            <div>
              <span className="text-[9px] sm:text-[11px] font-semibold text-[rgb(var(--studio-muted))] tracking-wider uppercase h-4 flex items-center">
                APPLICATION
              </span>
              <h3 className="text-xs sm:text-xl font-serif font-bold text-[rgb(var(--studio-primary))] h-6 sm:h-8 flex items-center leading-tight">
                계약정보 작성하기
              </h3>
              <p className="text-[10px] sm:text-xs text-[rgb(var(--studio-body))] leading-tight break-keep h-7 sm:h-9 flex items-center">
                약관을 확인하시고 예식 정보 및 일정을 작성합니다.
              </p>
            </div>

            {/* 안내 배지 박스 (높이 완벽 일치 & 3줄 정렬) */}
            <div className="p-2 sm:p-3.5 bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-border))] rounded-xl space-y-1 sm:space-y-1.5 text-[9.5px] sm:text-xs text-[rgb(var(--studio-muted))] h-[78px] sm:h-[98px] flex flex-col justify-center">
              <div className="flex items-center gap-1 sm:gap-1.5 truncate">
                <span className="text-[rgb(var(--studio-accent))] shrink-0">•</span>
                <span className="font-semibold text-[rgb(var(--studio-primary))] truncate">1. 약관 사전 확인 및 동의</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 truncate">
                <span className="text-[rgb(var(--studio-accent))] shrink-0">•</span>
                <span className="truncate">2. 예식 및 계약정보 입력</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 truncate">
                <span className="text-[rgb(var(--studio-accent))] shrink-0">•</span>
                <span className="truncate">3. 대표 확인 후 메일 발송</span>
              </div>
            </div>
          </div>

          {/* 하단 액션 버튼 */}
          <div className="mt-3 sm:mt-6 pt-2.5 sm:pt-4 border-t border-[rgb(var(--studio-surface))] flex items-center justify-between text-[10.5px] sm:text-xs font-semibold text-[rgb(var(--studio-primary))] h-7 sm:h-8">
            <span>작성 시작</span>
            <div className="w-4.5 h-4.5 sm:w-6 sm:h-6 rounded-full bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))] flex items-center justify-center group-hover:bg-[rgb(var(--studio-hover))] transition-colors">
              <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
        </div>

      </div>

      {/* 하단 신뢰 안내문 */}
      <div className="text-center text-xs text-[rgb(var(--studio-muted))] pt-6 flex flex-col items-center space-y-2">
        <img
          src={studio.logo}
          alt={studio.displayName + " Photography"}
          className="h-8 sm:h-10 w-auto object-contain select-none opacity-85 hover:opacity-100 transition-opacity"
        />
        <p className="font-semibold text-[rgb(var(--studio-primary))] text-xs sm:text-sm">
          {studio.brandTagline}
        </p>
        <p className="text-[11px] text-[rgb(var(--studio-subtle))] leading-relaxed break-keep max-w-sm mx-auto">
          작성해 주신 정보는 안전하게 보호되며 대표 확인 및 계약서 발행 목적으로만 <span className="whitespace-nowrap">사용됩니다.</span>
        </p>
      </div>
    </div>
  );
};
