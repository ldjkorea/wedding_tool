import { getProducts, getOptions, getDiscounts, getClientContent, renderConfigText, getDefaultProductId, getContractPolicy, getDiscountLabel } from '@/services/configuration';
import React from 'react';
import { formatKRW } from '@/lib/pricing';
import { ArrowLeft, BookOpen, Check, Gift, Sparkles, PlusCircle, Tag, ArrowRight } from 'lucide-react';


interface ProductCatalogViewProps {
  onBackToHome: () => void;
  onSelectProductAndApply: (productId: string) => void;
}

export const ProductCatalogView: React.FC<ProductCatalogViewProps> = ({
  onBackToHome,
  onSelectProductAndApply,
}) => {
  const DISCOUNTS_CONFIG = getDiscounts();
  const PRODUCTS_CONFIG = getProducts();
  const OPTIONS_CONFIG = getOptions();
  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-10 space-y-10 animate-fade-in">
      {/* 상단 네비게이션 */}
      <div className="flex items-center justify-between border-b border-[rgb(var(--studio-border))] pb-4">
        <button
          type="button"
          onClick={onBackToHome}
          className="flex items-center gap-1.5 text-xs font-semibold text-[rgb(var(--studio-body))] hover:text-[rgb(var(--studio-primary))] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>홈으로 돌아가기</span>
        </button>
        <span className="text-xs text-[rgb(var(--studio-muted))] font-medium">
          본식스냅 상품 라인업 & 혜택
        </span>
      </div>

      {/* 인트로 */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[rgb(var(--studio-primary))]">
          본식스냅 상품 안내
        </h2>
        <p className="text-xs sm:text-sm text-[rgb(var(--studio-body))] max-w-lg mx-auto leading-relaxed">
          {renderConfigText(getClientContent().catalogIntro[0])}<br className="hidden sm:inline" />
          {getClientContent().catalogIntro[1]}
        </p>
      </div>

      {/* 1. 상품 비교 카드 (기본 상품 vs 상위 상품): 모바일에서도 한 화면에 좌우 2열(grid-cols-2)로 나란히 표시 */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-6 items-stretch">
        {PRODUCTS_CONFIG.filter(product => product.active).map((product) => {
          const isPlus = product.isPlusPackage;

          return (
            <div
              key={product.id}
              className={`bg-white border ${
                isPlus ? 'border-[rgb(var(--studio-accent))] shadow-md ring-1 ring-[rgb(var(--studio-accent))]/30' : 'border-[rgb(var(--studio-border))] shadow-sm'
              } rounded-2xl sm:rounded-3xl p-3 sm:p-7 flex flex-col justify-between h-full relative overflow-hidden`}
            >
              {/* 상단 뱃지 라인 (높이 완벽 일치) */}
              <div className="h-6 sm:h-7 flex items-center justify-between mb-2 sm:mb-3">
                <span
                  className={`px-2 sm:px-2.5 py-0.5 rounded-full text-[9.5px] sm:text-xs font-semibold border ${
                    isPlus
                      ? 'bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))] border-[rgb(var(--studio-primary))]'
                      : 'bg-[rgb(var(--studio-background))] text-[rgb(var(--studio-muted))] border-[rgb(var(--studio-line))]'
                  }`}
                >
                  {product.badge}
                </span>
                <span className="text-[9.5px] sm:text-xs text-[rgb(var(--studio-muted))]">{getContractPolicy().payment.taxLabel}</span>
              </div>

              <div className="space-y-2 sm:space-y-3.5 flex-1 flex flex-col">
                {/* 상품명 및 부모님 앨범 태그 라인 (높이 완벽 일치) */}
                <div className="h-7 sm:h-8 flex items-center gap-1 sm:gap-2">
                  <h3 className="text-sm sm:text-xl font-serif font-bold text-[rgb(var(--studio-primary))]">
                    {product.name}
                  </h3>
                  {isPlus ? (
                    <span className="text-[9px] sm:text-[11px] font-sans font-medium text-[rgb(var(--studio-muted))] bg-[rgb(var(--studio-background))] px-1.5 sm:px-2 py-0.5 rounded-full border border-[rgb(var(--studio-line))]">
                      {product.catalogTag}
                    </span>
                  ) : (
                    <span className="text-[9px] sm:text-[11px] font-sans font-medium text-transparent px-1.5 py-0.5 select-none hidden sm:inline">
                      기본형
                    </span>
                  )}
                </div>

                {/* 부제 (높이 완벽 일치) */}
                <div className="h-7 sm:h-9 flex items-center">
                  <p className="text-[9.5px] sm:text-xs text-[rgb(var(--studio-muted))] leading-tight break-keep line-clamp-2">
                    {product.subtitle}
                  </p>
                </div>

                {/* 가격 (높이 완벽 일치) */}
                <div className="h-8 sm:h-11 flex items-center text-base sm:text-3xl font-serif font-bold text-[rgb(var(--studio-primary))] pb-2 sm:pb-3 border-b border-[rgb(var(--studio-surface))] tabular-nums">
                  {formatKRW(product.basePrice)}
                </div>

                {/* 스펙 하이라이트 박스 (좌우 양끝 칼정렬 & 높이 완벽 일치) */}
                {(product.albumSpec || product.originalCount || product.retouchedCount > 0) && (<div className="p-2 sm:p-3.5 bg-[rgb(var(--studio-background))] rounded-xl sm:rounded-2xl border border-[rgb(var(--studio-border))] h-[116px] sm:h-[136px] flex flex-col justify-between">
                  {/* 앨범 사양 2줄 높이 완전 통일 */}
                  <div className="flex items-start justify-between gap-1 sm:gap-3 h-10 sm:h-11">
                    <div className="flex items-center gap-1 text-[rgb(var(--studio-muted))] shrink-0 font-medium pt-0.5">
                      <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span className="text-[9.5px] sm:text-xs">앨범 사양</span>
                    </div>
                    <div className="font-semibold text-[rgb(var(--studio-primary))] text-right space-y-0.5 text-[8.5px] sm:text-xs leading-tight whitespace-nowrap">
                      {!isPlus ? (
                        <>
                          <div className="truncate">{product.coupleAlbumSummary || product.albumSpec}</div>
                          <div className="text-[rgb(var(--studio-subtle))] font-normal text-[8px] sm:text-[11px] truncate">{product.parentAlbumSummary}</div>
                        </>
                      ) : (
                        <>
                          <div className="truncate">{product.coupleAlbumSummary || product.albumSpec}</div>
                          <div className="text-[rgb(var(--studio-muted))] font-semibold text-[8px] sm:text-[11px] truncate">{product.parentAlbumSummary}</div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 정밀 세부 보정본 */}
                  <div className="flex justify-between items-center text-[rgb(var(--studio-body))] pt-1.5 border-t border-[rgb(var(--studio-border))] text-[9px] sm:text-xs h-6 whitespace-nowrap">
                    <span className="text-[rgb(var(--studio-muted))]">정밀 세부 보정본</span>
                    <span className="font-semibold text-[rgb(var(--studio-primary))] tabular-nums text-right">
                      {product.retouchedCount}장
                      {!!product.additionalRetouchedCount && <span className="text-[rgb(var(--studio-accent))] ml-0.5 sm:ml-1 font-normal text-[8px] sm:text-xs">(+{product.additionalRetouchedCount}장)</span>}
                    </span>
                  </div>

                  {/* 고화질 원본 */}
                  <div className="flex justify-between items-center text-[rgb(var(--studio-body))] text-[9px] sm:text-xs h-6 whitespace-nowrap">
                    <span className="text-[rgb(var(--studio-muted))]">고화질 원본</span>
                    <span className="font-semibold text-[rgb(var(--studio-primary))] text-right">
                      {product.originalCount}
                      {!!product.additionalOriginalCount && <span className="text-[rgb(var(--studio-accent))] ml-0.5 sm:ml-1 font-normal text-[8px] sm:text-xs">(+{product.additionalOriginalCount}장)</span>}
                    </span>
                  </div>
                </div>)}

                {/* 상품 세부 구성 안내 (동일한 최소 높이로 바닥 맞춤) */}
                <div className="flex-1 flex flex-col justify-start min-h-[170px] sm:min-h-[220px] pt-1 sm:pt-2">
                  {!isPlus ? (
                    /* 기본 상품: 기본 포함 5대 핵심 구성 */
                    <div className="space-y-1.5 sm:space-y-2 text-[10px] sm:text-xs text-[rgb(var(--studio-deep))]">
                      <div className="font-semibold text-[9.5px] sm:text-[11px] uppercase tracking-wider text-[rgb(var(--studio-muted))] h-5 flex items-center">
                        {product.includedHeading || "기본 포함 구성"}
                      </div>
                      <div className="space-y-1 sm:space-y-1.5">
                        {product.includedItems.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2 bg-[rgb(var(--studio-background))]/60 rounded-lg sm:rounded-xl border border-[rgb(var(--studio-border))]/60 text-[8.5px] sm:text-xs leading-tight h-[28px] sm:h-[34px]">
                            <Check className="w-3 h-3 text-[rgb(var(--studio-accent))] shrink-0" />
                            <span className="truncate">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* 상위 상품: 기본 상품 기본 포함 + 상위 상품만의 추가 혜택 */
                    <div className="space-y-1.5 sm:space-y-2 text-[10px] sm:text-xs text-[rgb(var(--studio-deep))]">
                      {/* 모바일 전용: 기본 상품과 1:1 대칭을 이루는 5대 정렬 알약 리스트 */}
                      <div className="sm:hidden space-y-1.5">
                        <div className="font-semibold text-[9.5px] uppercase tracking-wider text-[rgb(var(--studio-muted))] h-5 flex items-center">
                          <span>{product.premiumHeading || product.name + " 구성"}</span>
                        </div>
                        <div className="space-y-1">
                          {(product.mobilePlusItems || product.includedItems).map((item, index) => (
                          <div key={index} className={`flex items-center gap-1 p-1.5 bg-[rgb(var(--studio-background))] rounded-lg border text-[8.5px] leading-tight h-[28px] ${index === 0 ? 'border-[rgb(var(--studio-line))]' : index === 1 ? 'border-[rgb(var(--studio-accent))]/40' : 'border-[rgb(var(--studio-border))]'}`}>
                            <Check className={`w-3 h-3 shrink-0 ${index === 1 ? 'text-[rgb(var(--studio-accent))]' : 'text-[rgb(var(--studio-muted))]'}`} />
                            <span className={index < 2 ? "font-semibold text-[rgb(var(--studio-primary))] truncate" : "truncate"}>{item}</span>
                          </div>
                        ))}
                        </div>
                      </div>

                      {/* 데스크톱(PC/태블릿) 전용: 상세 설명 혜택 카드 */}
                      <div className="hidden sm:block space-y-2.5">
                        {/* 기본 상품 포함 확인 배너 */}
                        <div className="p-2 bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-line))] rounded-xl flex items-center gap-2">
                          <Check className="w-4 h-4 text-[rgb(var(--studio-muted))] shrink-0" />
                          <span className="text-xs font-semibold text-[rgb(var(--studio-primary))] break-keep leading-tight">
                            {product.baseIncludedNotice}
                          </span>
                        </div>

                        {/* 추가 제공 혜택 */}
                        <div className="space-y-1.5">
                          <div className="flex items-center text-[11px] font-bold text-[rgb(var(--studio-muted))] uppercase tracking-wider h-5">
                            <span>{product.upgradeHeading || product.name}</span>
                          </div>
                          {product.plusBenefits?.map((benefit, idx) => (
                            <div
                              key={idx}
                              className="p-2 bg-[rgb(var(--studio-background))] rounded-xl border border-[rgb(var(--studio-border))] space-y-0.5"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-xs text-[rgb(var(--studio-primary))] break-keep leading-tight">
                                  {benefit.title}
                                </span>
                                {benefit.badge && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-[rgb(var(--studio-border))] text-[rgb(var(--studio-body))] rounded-full shrink-0">
                                    {benefit.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-[rgb(var(--studio-body))] leading-tight break-keep">
                                {benefit.detail}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 하단 CTA 버튼 (맨 아래 바닥에 수평 칼정렬) */}
              <div className="mt-3 sm:mt-6 pt-2.5 sm:pt-4 border-t border-[rgb(var(--studio-surface))]">
                <button
                  type="button"
                  onClick={() => onSelectProductAndApply(product.id)}
                  className={`w-full h-8 sm:h-12 rounded-xl text-[10px] sm:text-sm font-semibold transition-colors flex items-center justify-center gap-1 sm:gap-2 shadow-sm ${
                    isPlus
                      ? 'bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))] hover:bg-[rgb(var(--studio-hover))]'
                      : 'bg-[rgb(var(--studio-background))] text-[rgb(var(--studio-primary))] border border-[rgb(var(--studio-line))] hover:bg-[rgb(var(--studio-pale-border))]'
                  }`}
                >
                  <span className="sm:hidden">{product.name} 선택</span>
                  <span className="hidden sm:inline">{product.name}으로 계약정보 작성하기</span>
                  <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. 추가 촬영 옵션 안내 */}
      <div className="bg-white border border-[rgb(var(--studio-border))] rounded-3xl p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-[rgb(var(--studio-surface))]">
          <PlusCircle className="w-5 h-5 text-[rgb(var(--studio-muted))]" />
          <h3 className="text-base sm:text-lg font-semibold text-[rgb(var(--studio-primary))]">
            추가 촬영 옵션
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {OPTIONS_CONFIG.map((opt) => (
            <div key={opt.id} className="p-4 bg-[rgb(var(--studio-background))] rounded-2xl border border-[rgb(var(--studio-border))] space-y-2.5">
              <div className="flex justify-between items-center pb-2 border-b border-[rgb(var(--studio-border))]/60">
                <span className="font-bold text-sm text-[rgb(var(--studio-primary))]">{opt.name}</span>
                <span className="font-bold text-sm text-[rgb(var(--studio-primary))] tabular-nums">+{formatKRW(opt.price)}</span>
              </div>
              <div className="text-center text-xs text-[rgb(var(--studio-body))] leading-relaxed py-1 space-y-1">
                {opt.description.split('\n').map((line, idx) => (
                  <p key={idx} className={idx === 1 ? "text-[11.5px] text-[rgb(var(--studio-muted))] font-medium" : "text-[rgb(var(--studio-primary))]"}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. 할인 및 페이백 혜택 안내 */}
      <div className="bg-white border border-[rgb(var(--studio-border))] rounded-3xl p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-[rgb(var(--studio-surface))]">
          <Tag className="w-5 h-5 text-[rgb(var(--studio-muted))]" />
          <h3 className="text-base sm:text-lg font-semibold text-[rgb(var(--studio-primary))]">
            할인 및 페이백 혜택 총정리
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* 즉시 할인 */}
          <div className="p-4 bg-[rgb(var(--studio-background))] rounded-2xl border border-[rgb(var(--studio-border))] space-y-2">
            <span className="text-[10px] font-bold text-[rgb(var(--studio-muted))] uppercase tracking-wider">
              계약금액 즉시 할인
            </span>
            <div className="space-y-2 pt-1">
              {getDiscounts(undefined, 'catalog').filter(item => item.type === 'immediate').map(item => (<div key={item.id} className="flex justify-between items-center">
                <span className="font-medium text-[rgb(var(--studio-primary))]">{getDiscountLabel(item.id, 'catalog')}</span>
                <span className="font-bold text-[rgb(var(--studio-accent))] tabular-nums">{item.eligibility.kind === 'partner' ? '코드별 할인' : '-' + formatKRW(item.amount)}</span>
              </div>))}


            </div>
          </div>

          {/* 추후 페이백 */}
          <div className="p-4 bg-[rgb(var(--studio-background))] rounded-2xl border border-[rgb(var(--studio-border))] space-y-2">
            <span className="text-[10px] font-bold text-[rgb(var(--studio-muted))] uppercase tracking-wider">
              사후 후기 페이백 혜택
            </span>
            <div className="space-y-2 pt-1">
              {getDiscounts(undefined, 'catalog').filter(item => item.type === 'cashback').map(item => (<div key={item.id} className="flex justify-between items-center">
                <span className="font-medium text-[rgb(var(--studio-primary))]">{getDiscountLabel(item.id, 'catalog')}</span>
                <span className="font-bold text-[rgb(var(--studio-body))] tabular-nums">{formatKRW(item.amount)} 페이백</span>
              </div>))}

              <p className="text-[11px] text-[rgb(var(--studio-muted))] pt-1 border-t border-[rgb(var(--studio-border))]">
                {getClientContent().cashbackPaymentNotice}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 하단 전체 액션 */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={() => onSelectProductAndApply(getDefaultProductId())}
          className="px-8 py-4 bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))] rounded-2xl text-sm font-semibold hover:bg-[rgb(var(--studio-hover))] transition-colors inline-flex items-center gap-2 shadow-md"
        >
          <span>계약정보 작성하러 가기</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
