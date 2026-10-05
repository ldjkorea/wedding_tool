import { getStudioConfig } from '@/services/configuration';
import React from 'react';
import { OwnerEntry } from './OwnerEntry';


interface HeaderProps {
  title?: string;
  subtitle?: string;
  ownerEntry?: boolean;
  dirty?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title = '본식스냅 계약정보 작성',
  subtitle = '상담이 완료된 고객님께 전달드리는 페이지입니다.',
  ownerEntry = false,
  dirty = false,
}) => {
  const studio = getStudioConfig();
  return (
    <header className="border-b border-[rgb(var(--studio-border))] bg-[rgb(var(--studio-background))]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex flex-col items-center text-center">
        <p className="text-[10px] sm:text-[11px] font-semibold tracking-[0.3em] text-[rgb(var(--studio-muted))] uppercase mb-1 font-sans">
          {studio.photographyLabel}
        </p>
        <h1 aria-label={studio.displayName} className="text-2xl sm:text-3xl font-serif tracking-[0.2em] text-[rgb(var(--studio-primary))] font-bold">
          {ownerEntry ? <OwnerEntry dirty={dirty}>{studio.displayName}</OwnerEntry> : studio.displayName}
        </h1>
        {title && (
          <div className="mt-2 text-center">
            <h2 className="text-sm sm:text-base font-semibold text-[rgb(var(--studio-primary))] tracking-tight">{title}</h2>
            {subtitle && (
              <p className="text-xs text-[rgb(var(--studio-muted))] mt-0.5 max-w-sm break-keep leading-relaxed">{subtitle}</p>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
