import { StudioControl } from '@/components/admin/StudioControl';
export const dynamic = 'force-dynamic';
export const metadata = { title: '총관리자 설정', robots: { index: false, follow: false, nocache: true } };
export default function MasterPage() { return <StudioControl />; }
