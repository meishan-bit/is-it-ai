import PreTestGate from '@/components/PreTestGate';
import ProgressDashboard from '@/components/ProgressDashboard';

export const metadata = { title: 'My progress · Is It AI?' };

export default function Page() {
  return (
    <PreTestGate>
      <ProgressDashboard />
    </PreTestGate>
  );
}
