import { OwnerBookings } from '@/components/admin/OwnerBookings';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: '사장님 예약현황',
  robots: { index: false, follow: false, nocache: true },
};
export default function Page() {
  return <OwnerBookings />;
}
