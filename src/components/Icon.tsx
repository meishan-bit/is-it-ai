export type IconName = 'listen' | 'listen-stop' | 'listen-off' | 'play' | 'pause' | 'back' | 'close' | 'book' | 'chart' | 'check' | 'next';

/** Small inline SVG icons: they always render (no emoji font needed) and always sit next to a text label. */
export default function Icon({ name }: { name: IconName }) {
  let shape: React.ReactNode;
  switch (name) {
    case 'listen':
      shape = (<><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16.5 8.5a5 5 0 010 7" /><path d="M19.2 5.8a8.5 8.5 0 010 12.4" /></>);
      break;
    case 'listen-stop':
      shape = (<><path d="M4 9v6h4l5 4V5L8 9H4z" /><rect x="16" y="9" width="5" height="6" rx="1" /></>);
      break;
    case 'listen-off':
      shape = (<><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M17 9l5 6M22 9l-5 6" /></>);
      break;
    case 'play':
      shape = <path d="M8 5v14l11-7z" fill="currentColor" />;
      break;
    case 'pause':
      shape = <path d="M8 5v14M16 5v14" />;
      break;
    case 'back':
      shape = <path d="M19 12H5M12 5l-7 7 7 7" />;
      break;
    case 'close':
      shape = <path d="M6 6l12 12M18 6L6 18" />;
      break;
    case 'book':
      shape = (<><path d="M4 5a2 2 0 012-2h13v15H6a2 2 0 00-2 2V5z" /><path d="M4 20a2 2 0 002 1h13v-3" /></>);
      break;
    case 'chart':
      shape = <path d="M5 20v-8M12 20V5M19 20v-5M3 20h18" />;
      break;
    case 'check':
      shape = <path d="M5 13l4 4L19 7" />;
      break;
    default:
      shape = <path d="M5 12h14M12 5l7 7-7 7" />;
  }
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="1.25em"
      height="1.25em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: 'none' }}
    >
      {shape}
    </svg>
  );
}
