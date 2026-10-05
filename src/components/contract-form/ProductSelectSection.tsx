import { getProducts, getStudioConfig, getClientContent } from '@/services/configuration';
import React from 'react';
import { Camera, Check, Sparkles, BookOpen, Layers } from 'lucide-react';
import { formatKRW } from '@/lib/pricing';


interface ProductSelectSectionProps {
  selectedProductId: string;
  onSelect: (productId: string) => void;
  errors?: Record<string, string>;
}

export const ProductSelectSection: React.FC<ProductSelectSectionProps> = ({
  selectedProductId,
  onSelect,
  errors = {},
}) => {
  const PRODUCTS_CONFIG = getProducts();
  return (
    <div className="space-y-6">
      <div className="border-b border-[rgb(var(--studio-surface))] pb-3">
        <h3 className="text-base sm:text-lg font-semibold text-[rgb(var(--studio-primary))] flex items-center gap-2">
          <Camera className="w-5 h-5 text-[rgb(var(--studio-muted))]" />
          <span>3. 상품 선택</span>
        </h3>
        <p className="text-xs sm:text-sm text-[rgb(var(--studio-muted))] mt-1 break-keep leading-relaxed">
          {getStudioConfig().studioName}의 본식스냅 패키지를 <span className="whitespace-nowrap">선택해 주세요.</span>
        </p>
      </div>

      {/* 기본 상품 · 상위 상품 전 상품 공통 포함 사항 배너 */}
      <div className="p-4 sm:p-4.5 bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-line))] rounded-2xl space-y-2 text-xs sm:text-sm text-[rgb(var(--studio-body))] shadow-sm">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[rgb(var(--studio-primary))] break-keep">
          <Layers className="w-4 h-4 text-[rgb(var(--studio-muted))] shrink-0" />
          <span>{getClientContent().commonProductHeading}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-sm pt-1">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[rgb(var(--studio-muted))] shrink-0" />
            <span className="font-semibold text-[rgb(var(--studio-primary))] break-keep">{getClientContent().commonShootItems[0]}</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[rgb(var(--studio-muted))] shrink-0" />
            <span className="font-semibold text-[rgb(var(--studio-primary))] break-keep">{getClientContent().commonShootItems[1]}</span>
          </div>
        </div>
      </div>

      {/* 상품 선택 카드 (기본 상품 vs 상위 상품) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {PRODUCTS_CONFIG.map((product) => {
          const isSelected = selectedProductId === product.id;
          const isPlus = Boolean(product.isPlusPackage);

          return (
            <button
              key={product.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(product.id)}
              className={`w-full text-left cursor-pointer rounded-3xl p-5 sm:p-6 transition-all duration-300 relative flex flex-col justify-between select-none ${
                isSelected
                  ? 'bg-[#FFFFFF] border-2 border-[rgb(var(--studio-primary))] shadow-md ring-2 ring-[rgb(var(--studio-primary))]/10'
                  : 'bg-[#FFFFFF] border border-[rgb(var(--studio-border))] hover:border-[rgb(var(--studio-muted))] shadow-sm'
              }`}
            >
              <div className="space-y-4">
                {/* 상단 라디오 & 뱃지 */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      isPlus
                        ? 'bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))]'
                        : 'bg-[rgb(var(--studio-surface))] text-[rgb(var(--studio-body))] border border-[rgb(var(--studio-border))]'
                    }`}
                  >
                    {product.badge}
                  </span>

                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'border-[rgb(var(--studio-primary))] bg-[rgb(var(--studio-primary))]'
                        : 'border-[rgb(var(--studio-line))] bg-[#FFFFFF]'
                    }`}
                  >
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[rgb(var(--studio-background))]" />}
                  </div>
                </div>

                {/* 상품명 및 부제 */}
                <div>
                  <h4 className="text-xl sm:text-2xl font-serif font-bold text-[rgb(var(--studio-primary))]">
                    {product.name}
                  </h4>
                  <p className="text-sm sm:text-base font-semibold text-[rgb(var(--studio-muted))] mt-1">
                    {product.subtitle}
                  </p>
                </div>

                {/* 가격 */}
                <div className="text-2xl sm:text-3xl font-bold text-[rgb(var(--studio-primary))] pb-3 border-b border-[rgb(var(--studio-surface))] tabular-nums">
                  {formatKRW(product.basePrice)}
                </div>

                {/* 앨범 사양 핵심 비교 박스 (두 카드 완벽한 행별 줄맞춤) */}
                <div className="p-4 bg-[rgb(var(--studio-background))] rounded-2xl border border-[rgb(var(--studio-line))] space-y-3 text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5 text-[rgb(var(--studio-muted))] font-bold text-xs uppercase tracking-wide">
                    <BookOpen className="w-4 h-4 text-[rgb(var(--studio-muted))]" />
                    <span>앨범 제공 구성</span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="py-1.5 border-b border-[rgb(var(--studio-border))]">
                      <div className="font-semibold text-[rgb(var(--studio-primary))]">부부 앨범</div>
                      <div className="text-[rgb(var(--studio-body))] mt-1 whitespace-pre-line">{product.coupleAlbumSummary || product.albumSpec}</div>
                    </div>
                    <div className="py-1.5 border-b border-[rgb(var(--studio-border))]">
                      <div className="font-semibold text-[rgb(var(--studio-primary))]">부모님 앨범</div>
                      <div className="text-[rgb(var(--studio-body))] mt-1">{product.parentAlbumSummary}</div>
                    </div>
                    {product.plusBenefits?.map(benefit => (
                      <div key={benefit.title} className="p-2.5 rounded-xl text-xs text-[rgb(var(--studio-body))] border border-[rgb(var(--studio-accent))]/50">
                        {benefit.detail}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 하단 선택 안내 */}
              <div className="pt-4 mt-2">
                <div
                  className={`w-full py-2.5 rounded-xl text-center text-xs sm:text-sm font-semibold transition-colors ${
                    isSelected
                      ? 'bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))]'
                      : 'bg-[rgb(var(--studio-background))] text-[rgb(var(--studio-muted))] border border-[rgb(var(--studio-line))]'
                  }`}
                >
                  {isSelected ? '선택됨' : '선택하기'}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {errors.productId && (
        <p className="text-xs text-red-500 font-medium">{errors.productId}</p>
      )}
    </div>
  );
};
