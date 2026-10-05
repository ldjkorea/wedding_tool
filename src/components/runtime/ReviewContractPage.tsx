'use client';
import { getStudioConfig, getDemoConfig } from '@/services/configuration';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/ui/Header';
import { RepresentativeReviewView } from '@/components/review/RepresentativeReviewView';
import { ContractFormData, PriceCalculationResult, ContractSnapshot } from '@/types/contract';
import { AlertTriangle, Loader2 } from 'lucide-react';


function ReviewPageContent() {
  const studio = getStudioConfig();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const ownerContractId = searchParams.get('ownerContract');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contractData, setContractData] = useState<{
    contractId: string;
    data: ContractFormData;
    pricing: PriceCalculationResult;
    isAlreadySent: boolean;
    sentAt?: string;
    contractNumber?: string;
    snapshot?: ContractSnapshot;
    revision: number;
    isPreviewMode?: boolean;
  } | null>(null);

  useEffect(() => {
    // 서버로 GET 요청하여 토큰 복호화 및 데이터 조회 (주의: 절대 발송 처리 안 됨!)
    const fetchContractDetails = async () => {
      try {
        const url = ownerContractId ? `/api/owner-control/contract?id=${encodeURIComponent(ownerContractId)}` : token ? `/api/review-contract?token=${encodeURIComponent(token)}` : '/api/review-contract';
        const res = await fetch(url);
        const result = await res.json();

        if (!res.ok || !result.success) {
          throw new Error(result.error || '계약 정보를 불러올 수 없습니다.');
        }

        setContractData({
          contractId: result.contractId,
          data: result.data,
          pricing: result.pricing,
          isAlreadySent: result.isAlreadySent,
          sentAt: result.sentAt,
          contractNumber: result.contractNumber,
          snapshot: result.snapshot,
          revision: result.revision,
          isPreviewMode: result.isPreviewMode,
        });
      } catch (err: any) {
        setError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchContractDetails();
  }, [token, ownerContractId]);

  return (
    <div className="min-h-screen flex flex-col bg-[rgb(var(--studio-background))]">
      {/* 간결한 브랜드 헤더 */}
      <Header
        title="계약서 발송 확인"
        subtitle="접수된 신규 계약정보를 확인하고 최종 계약서를 발송합니다."
      />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-[rgb(var(--studio-muted))]">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-xs">보안 토큰을 검증하고 계약정보를 불러오는 중입니다...</p>
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto my-12 p-6 bg-white border border-red-200 rounded-2xl shadow-sm text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[rgb(var(--studio-primary))]">확인 링크 접근 오류</h3>
            <p className="text-xs text-[rgb(var(--studio-body))] leading-relaxed">{error}</p>
          </div>
        ) : contractData ? (
          <>
            {contractData.isPreviewMode && (
              <div className="mb-6 p-4 bg-[rgb(var(--studio-surface))] border border-[rgb(var(--studio-line))] rounded-xl flex items-center justify-between text-xs text-[rgb(var(--studio-body))]">
                <div className="flex items-center gap-2.5">
                  <span className="px-2 py-0.5 bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))] font-bold rounded text-[11px] shrink-0">
                    화면 테스트 모드
                  </span>
                  <span>
                    이메일 승인 링크 없이 <strong>/review</strong> 주소로 직접 접속하셨습니다. 화면 기능 점검 및 PDF 계약서 다운로드 테스트를 위해 <strong>{getDemoConfig().previewCoupleLabel}</strong> 고객님의 계약 데이터로 표시됩니다.
                  </span>
                </div>
              </div>
            )}
            <RepresentativeReviewView
              token={token || 'preview-mode-token'}
              ownerContractId={ownerContractId || undefined}
              contractId={contractData.contractId}
              initialData={contractData.data}
              initialPricing={contractData.pricing}
              isAlreadySent={contractData.isAlreadySent}
              sentAt={contractData.sentAt}
              contractNumber={contractData.contractNumber}
              initialSnapshot={contractData.snapshot}
              initialRevision={contractData.revision}
            />
          </>
        ) : null}
      </main>

      {/* 푸터 */}
      <footer className="border-t border-[rgb(var(--studio-border))] py-6 text-center text-xs text-[rgb(var(--studio-muted))]">
        <p>{studio.bookingName} &bull; {studio.representativeName} 대표 전용 승인 페이지</p>
      </footer>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[rgb(var(--studio-background))] text-[rgb(var(--studio-muted))]">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      }
    >
      <ReviewPageContent />
    </Suspense>
  );
}
