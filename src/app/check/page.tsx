import CheckFlow from '@/components/check/CheckFlow';
import CheckGate from '@/components/check/CheckGate';

export const metadata = { title: 'Check a message · Is It AI?' };

export default function Page() {
  return (
    <CheckGate>
      <CheckFlow />
    </CheckGate>
  );
}
