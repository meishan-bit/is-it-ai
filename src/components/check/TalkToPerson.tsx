import { CHECK } from '@/lib/check/types-content';
import CheckIcon from './CheckIcon';
import PhoneText from './PhoneText';

/** On every Check It screen, in the same place, never covered. The number is a fictional placeholder (decided Nov 20). */
export default function TalkToPerson() {
  return (
    <section className="ck-talk" aria-labelledby="ck-talk-h">
      <h2 id="ck-talk-h">{CHECK.talk.heading}</h2>
      <a className="btn btn-secondary" href={CHECK.sample_number.tel}>
        <CheckIcon name="phone" /> <span><PhoneText text={CHECK.talk.button} /></span>
      </a>
      <p>{CHECK.talk.note}</p>
    </section>
  );
}
