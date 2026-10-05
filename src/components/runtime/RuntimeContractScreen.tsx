'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { getBaseClientConfiguration, getThemeStyle, installBrowserConfiguration } from '@/services/configuration';
import type { PublicStudioSettings } from '@/types/studioSettings';

const Customer = dynamic(() => import('./CustomerContractPage'), { ssr: false });
const Review = dynamic(() => import('./ReviewContractPage'), { ssr: false });
/** One client per deployment/document; server state is always request scoped. */
export function RuntimeContractScreen({ screen, settings, binding }: { screen: 'customer' | 'review'; settings: PublicStudioSettings; binding: string }) {
  const [readyBinding, setReadyBinding] = useState<string | null>(null);
  useEffect(() => {
    installBrowserConfiguration({ ...getBaseClientConfiguration(), ...settings }, binding);
    document.documentElement.setAttribute('style', Object.entries(getThemeStyle(settings.studioConfig)).map(([key, value]) => key + ':' + value).join(';'));
    setReadyBinding(binding);
  }, [settings, binding]);
  if (readyBinding !== binding) return <div className="p-8 text-center" role="status">계약 정보를 불러오고 있습니다.</div>;
  return screen === 'customer' ? <Customer key={binding} /> : <Review key={binding} />;
}
