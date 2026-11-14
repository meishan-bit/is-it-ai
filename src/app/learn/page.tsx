import Link from 'next/link';
import PreTestGate from '@/components/PreTestGate';
import ScreenHeader from '@/components/ScreenHeader';
import { GLOSSARY } from '@/lib/content';

export const metadata = { title: 'Learn the words · Is It AI?' };

export default function Page() {
  return (
    <PreTestGate>
      <div className="page">
        <ScreenHeader listenText="Learn the words. Choose a word to hear what it means and what to do." />
        <h1>Learn the words</h1>
        <p className="lead">Choose a word to see what it means, a real example from Canada, and what to do.</p>
        <nav className="term-list" aria-label="Words">
          {GLOSSARY.map((g) => (
            <Link key={g.slug} href={`/learn/${g.slug}`} className="btn btn-secondary">
              {g.term}
            </Link>
          ))}
        </nav>
      </div>
    </PreTestGate>
  );
}
