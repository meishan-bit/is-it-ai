import Link from 'next/link';
import { notFound } from 'next/navigation';
import PreTestGate from '@/components/PreTestGate';
import ScreenHeader from '@/components/ScreenHeader';
import { GLOSSARY, practiceItemsFor } from '@/lib/content';

export const dynamicParams = false;

export function generateStaticParams() {
  return GLOSSARY.map((g) => ({ slug: g.slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const term = GLOSSARY.find((g) => g.slug === slug);
  if (!term) notFound();
  const practice = practiceItemsFor(term);
  const isAll = term.practice_items.includes('ALL');
  const speech = `${term.term}. ${term.definition} A real example: ${term.example} What to do: ${term.what_to_do}`;

  return (
    <PreTestGate>
      <div className="page">
        <ScreenHeader listenText={speech} />
        <h1>{term.term}</h1>
        <div className="card">
          <h2>What it means</h2>
          <p style={{ marginBottom: 0 }}>{term.definition}</p>
        </div>
        <div className="card">
          <h2>A real example</h2>
          <p>{term.example}</p>
          <p className="muted" style={{ marginBottom: 0 }}>
            Source:{' '}
            {term.example_sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && ', '}
                <a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>
              </span>
            ))}
          </p>
        </div>
        <div className="todo">
          <h3>What to do</h3>
          <p>{term.what_to_do}</p>
        </div>
        <div className="btn-row">
          {practice.length > 0 && (
            <Link href={isAll ? '/practice' : `/practice?only=${practice.join(',')}`} className="btn">
              Practise {isAll ? 'now' : 'examples about this'}
            </Link>
          )}
          <Link href="/learn" className="btn btn-secondary">All words</Link>
        </div>
      </div>
    </PreTestGate>
  );
}
