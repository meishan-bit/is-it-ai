import Link from 'next/link';
import { versionLabel } from '@/lib/version';

export default function Footer() {
  return (
    <footer className="site">
      <p className="training">Training examples. Every message, call and pop-up in this app is made up.</p>
      <p>
        <Link href="/about">About this app and your privacy</Link>
      </p>
      <p className="no-print" aria-label="App version">{versionLabel()}</p>
    </footer>
  );
}
