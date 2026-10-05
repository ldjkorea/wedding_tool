import { OwnerConsole } from '@/components/admin/OwnerConsole';
export const dynamic = 'force-dynamic';
export const metadata = { title: '운영 설정', robots: { index: false, follow: false, nocache: true } };
export default function StudioControlPage() { return <OwnerConsole />; }
