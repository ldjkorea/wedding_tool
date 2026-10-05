import { getStudioConfig } from '@/services/configuration';
import React, { useState } from 'react';
import { Mail, Check, X } from 'lucide-react';


interface SubmissionSuccessViewProps {
  email: string;
  onHome?: () => void;
}

export const SubmissionSuccessView: React.FC<SubmissionSuccessViewProps> = ({
  email,
}) => {
  const studio = getStudioConfig();
  const [closedNotice, setClosedNotice] = useState(false);

  const handleCloseWindow = () => {
    if (typeof window !== 'undefined') {
      window.close();
      // 브라우저 탭 보안 정책상 직접 닫히지 않는 경우(새 창이 아닌 직접 접속 탭 등)를 위한 안내
      setTimeout(() => {
        setClosedNotice(true);
      }, 200);
    }
  };

  return (
    <div className="bg-[#FFFFFF] border border-[rgb(var(--studio-border))] rounded-3xl p-7 sm:p-10 text-center shadow-sm max-w-lg mx-auto space-y-6 animate-fade-in my-8">
      {/* 체크 아이콘 */}
      <div className="w-16 h-16 rounded-full bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-line))] flex items-center justify-center mx-auto text-[rgb(var(--studio-muted))]">
        <Check className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-widest text-[rgb(var(--studio-muted))] uppercase">
          {studio.displayName}
        </p>
        <h2 className="text-xl sm:text-2xl font-serif font-bold text-[rgb(var(--studio-primary))]">
          계약 신청이 정상 접수되었습니다
        </h2>
        <p className="text-xs sm:text-sm text-[rgb(var(--studio-body))] leading-relaxed max-w-md mx-auto pt-1 break-keep">
          대표가 작성해 주신 내용을 확인한 후, 입력하신 이메일(<strong className="text-[rgb(var(--studio-primary))]">{email}</strong>)로 공식 계약서를 <span className="whitespace-nowrap">신속하게 발송해 드립니다.</span>
        </p>
      </div>

      {/* 안내 박스 */}
      <div className="bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-border))] rounded-2xl p-4 text-xs text-[rgb(var(--studio-muted))] text-left space-y-2">
        <div className="flex items-start gap-2">
          <Mail className="w-4 h-4 text-[rgb(var(--studio-muted))] mt-0.5 shrink-0" />
          <span className="break-keep leading-relaxed">
            대표 승인 및 계약서 발송 시 이메일로 알림 및 PDF 계약서가 <span className="whitespace-nowrap">함께 전달됩니다.</span>
          </span>
        </div>
        <p className="text-[11px] text-[rgb(var(--studio-subtle))] pl-6 break-keep leading-relaxed">
          * 계약금 입금 및 예식 스케줄 최종 확정은 발송된 공식 계약서 수령 후 진행됩니다.
        </p>
      </div>

      {/* 창 닫기 버튼 */}
      <div className="pt-2 space-y-2">
        <button
          type="button"
          onClick={handleCloseWindow}
          className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))] rounded-xl text-xs sm:text-sm font-semibold hover:bg-[rgb(var(--studio-hover))] transition-colors shadow-sm cursor-pointer"
        >
          <X className="w-4 h-4" />
          <span>창 닫기</span>
        </button>
        {closedNotice && (
          <p className="text-xs text-[rgb(var(--studio-muted))] animate-fade-in pt-1 break-keep leading-relaxed">
            인터넷 창이 자동으로 닫히지 않는 경우, 브라우저 상단의 창(탭) 닫기를 <span className="whitespace-nowrap">눌러주시면 됩니다.</span>
          </p>
        )}
      </div>
    </div>
  );
};
