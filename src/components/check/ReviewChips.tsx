'use client';

import type { Chip } from '@/lib/check/chips';
import { CHECK } from '@/lib/check/types-content';

function ChipButton({ chip, onTap }: { chip: Chip; onTap: (c: Chip) => void }) {
  const state = chip.hidden ? CHECK.screens.chip_hidden : CHECK.screens.chip_showing;
  return (
    <button
      type="button"
      className="ck-chip"
      aria-pressed={chip.hidden}
      onClick={() => onTap(chip)}
      aria-label={`${chip.text}${chip.label ? `, ${chip.label}` : ''}. ${state}. Tap to ${chip.hidden ? 'show' : 'hide'}.`}
    >
      <span className="w" aria-hidden="true">{chip.text.replace(/-/g, '\u2011')}</span>
      {chip.label && <span className="lab" aria-hidden="true">({chip.label})</span>}
      <span className="st" aria-hidden="true">{state}</span>
    </button>
  );
}

/** Tap-to-hide chips: details we hid first, then every other word. Chips are 52 px tall with 12 px gaps (see check.css). */
export default function ReviewChips({ chips, onTap }: { chips: Chip[]; onTap: (c: Chip) => void }) {
  const auto = chips.filter((c) => c.auto);
  const rest = chips.filter((c) => !c.auto);
  return (
    <>
      <div className="ck-group">
        {auto.length > 0 ? (
          <>
            <h2>{CHECK.screens.review_group_auto}</h2>
            <div className="ck-chips">{auto.map((c) => <ChipButton key={c.id} chip={c} onTap={onTap} />)}</div>
          </>
        ) : (
          <p className="notice">{CHECK.screens.review_none_auto}</p>
        )}
      </div>
      <div className="ck-group">
        <h2>{CHECK.screens.review_group_rest}</h2>
        <div className="ck-chips">{rest.map((c) => <ChipButton key={c.id} chip={c} onTap={onTap} />)}</div>
      </div>
    </>
  );
}
