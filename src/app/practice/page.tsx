import PracticeFlow from '@/components/PracticeFlow';
import PreTestGate from '@/components/PreTestGate';

export const metadata = { title: 'Practise · Is It AI?' };

export default function Page() {
  return (
    <PreTestGate>
      <PracticeFlow />
    </PreTestGate>
  );
}
