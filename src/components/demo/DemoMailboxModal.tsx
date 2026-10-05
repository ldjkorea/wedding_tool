import React, { useState, useEffect } from 'react';
import { SentEmailRecord } from '@/types/backend';
import { Mail, RefreshCw, ExternalLink, X, Paperclip } from 'lucide-react';

export const DemoMailboxModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [emails, setEmails] = useState<SentEmailRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<SentEmailRecord | null>(null);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/demo/mailbox');
      const data = await res.json();
      if (data.success) {
        setEmails(data.mailbox || []);
      }
    } catch (e) {
      console.warn('데모 메일함 조회 오류:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEmails();
    }
  }, [isOpen]);

  return (
    <>
      {/* 플로팅 토글 버튼 */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-3 right-3 sm:bottom-6 sm:right-6 z-40 bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))] p-2 sm:p-3 rounded-full shadow-lg hover:scale-105 transition-all flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-medium border border-[rgb(var(--studio-border))] opacity-90 hover:opacity-100"
        title="데모 메일 수신함 확인"
      >
        <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[rgb(var(--studio-highlight))]" />
        <span className="hidden sm:inline">데모 메일함</span>
        {emails.length > 0 && (
          <span className="bg-[rgb(var(--studio-accent))] text-[rgb(var(--studio-background))] text-[9px] sm:text-[10px] w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center font-bold">
            {emails.length}
          </span>
        )}
      </button>

      {/* 모달 창 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-[rgb(var(--studio-border))] rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* 헤더 */}
            <div className="px-5 py-4 border-b border-[rgb(var(--studio-surface))] flex items-center justify-between bg-[rgb(var(--studio-background))]">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-[rgb(var(--studio-muted))]" />
                <h3 className="text-sm sm:text-base font-semibold text-[rgb(var(--studio-primary))]">
                  가상 이메일 수신함 (Demo Sandbox)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchEmails}
                  className="p-1.5 rounded-lg text-[rgb(var(--studio-muted))] hover:bg-[rgb(var(--studio-border))] transition-colors"
                  title="새로고침"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-[rgb(var(--studio-muted))] hover:bg-[rgb(var(--studio-border))] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {emails.length === 0 ? (
                <div className="text-center py-12 text-xs text-[rgb(var(--studio-muted))]">
                  아직 발송된 이메일이 없습니다.<br />
                  계약정보를 작성하고 제출하면 이곳에 도착합니다.
                </div>
              ) : selectedEmail ? (
                /* 메일 상세 보기 */
                <div className="space-y-4 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedEmail(null)}
                    className="text-[rgb(var(--studio-muted))] hover:text-[rgb(var(--studio-primary))] underline font-medium"
                  >
                    &larr; 목록으로 돌아가기
                  </button>

                  <div className="p-3 bg-[rgb(var(--studio-background))] rounded-xl border border-[rgb(var(--studio-border))] space-y-1">
                    <div className="font-semibold text-sm text-[rgb(var(--studio-primary))]">{selectedEmail.subject}</div>
                    <div className="text-[rgb(var(--studio-muted))]">수신인: {selectedEmail.to}</div>
                    <div className="text-[rgb(var(--studio-muted))]">발송시각: {new Date(selectedEmail.sentAt).toLocaleString('ko-KR')}</div>
                    {selectedEmail.hasAttachment && (
                      <div className="flex items-center gap-1 text-[rgb(var(--studio-accent))] font-medium pt-1">
                        <Paperclip className="w-3.5 h-3.5" />
                        <span>첨부파일: 본식스냅_촬영계약서.pdf</span>
                      </div>
                    )}
                  </div>

                  {/* 이메일 HTML 프리뷰 */}
                  <div
                    className="border border-[rgb(var(--studio-border))] rounded-xl p-4 overflow-x-auto bg-white max-h-[50vh]"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.html }}
                  />
                </div>
              ) : (
                /* 메일 목록 */
                emails.map((mail) => (
                  <div
                    key={mail.id}
                    onClick={() => setSelectedEmail(mail)}
                    className="cursor-pointer p-3.5 bg-[rgb(var(--studio-background))]/60 hover:bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-border))] rounded-xl transition-all space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px] text-[rgb(var(--studio-muted))]">
                      <span className="font-medium px-2 py-0.5 rounded bg-[rgb(var(--studio-border))] text-[rgb(var(--studio-primary))]">
                        {mail.type === 'rep_notification'
                          ? '대표 알림'
                          : mail.type === 'customer_contract'
                          ? '고객 계약서'
                          : '대표 발송완료'}
                      </span>
                      <span>{new Date(mail.sentAt).toLocaleTimeString('ko-KR')}</span>
                    </div>
                    <h4 className="font-semibold text-xs sm:text-sm text-[rgb(var(--studio-primary))]">
                      {mail.subject}
                    </h4>
                    <div className="flex justify-between items-center text-[11px] text-[rgb(var(--studio-body))]">
                      <span>수신: {mail.to}</span>
                      {mail.hasAttachment && (
                        <span className="flex items-center gap-1 text-[rgb(var(--studio-accent))]">
                          <Paperclip className="w-3 h-3" />
                          <span>PDF 첨부</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 푸터 */}
            <div className="px-5 py-3 border-t border-[rgb(var(--studio-surface))] bg-[rgb(var(--studio-background))] flex justify-between items-center text-[11px] text-[rgb(var(--studio-muted))]">
              <span>실제 Gmail 연결 시 Apps Script가 직접 발송합니다.</span>
              <button
                type="button"
                onClick={async () => {
                  await fetch('/api/demo/mailbox', { method: 'POST' });
                  fetchEmails();
                }}
                className="text-red-500 hover:underline"
              >
                메일함 비우기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
