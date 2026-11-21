import { CHECK } from '@/lib/check/types-content';

/** Keeps the sample phone number on one line, so it never breaks in the middle of the digits. */
export default function PhoneText({ text }: { text: string }) {
  const num = CHECK.sample_number.display;
  const i = text.indexOf(num);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span style={{ whiteSpace: 'nowrap' }}>{num}</span>
      {text.slice(i + num.length)}
    </>
  );
}
