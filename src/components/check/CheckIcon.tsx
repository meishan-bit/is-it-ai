export type CheckIconName = 'search' | 'camera' | 'clipboard' | 'phone' | 'triangle-filled' | 'triangle-outline' | 'info' | 'lock';

/** Small inline icons for Check It. Always beside a text label, hidden from screen readers. */
export default function CheckIcon({ name }: { name: CheckIconName }) {
  let shape: React.ReactNode;
  let fill = 'none';
  switch (name) {
    case 'search':
      shape = (<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5" /></>);
      break;
    case 'camera':
      shape = (<><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>);
      break;
    case 'clipboard':
      shape = (<><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v3H9zM8.5 12h7M8.5 16h5" /></>);
      break;
    case 'phone':
      shape = <path d="M6 3h4l2 5-2.5 1.5a11 11 0 005 5L16 12l5 2v4a2 2 0 01-2 2A16 16 0 014 5a2 2 0 012-2z" />;
      break;
    case 'triangle-filled':
      shape = <path d="M12 3L22 20H2z" />;
      fill = 'currentColor';
      break;
    case 'triangle-outline':
      shape = <path d="M12 4L21 19H3z" />;
      break;
    case 'info':
      shape = (<><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><circle cx="12" cy="7.5" r="0.6" fill="currentColor" /></>);
      break;
    default:
      shape = (<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>);
  }
  return (
    <svg aria-hidden="true" focusable="false" width="1.25em" height="1.25em" viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
      {shape}
    </svg>
  );
}
