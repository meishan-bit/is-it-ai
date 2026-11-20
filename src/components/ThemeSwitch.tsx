'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';

type Theme = 'light' | 'dark';
const KEY = 'isitai.v1.theme';

/** The theme showing now: the person's saved choice, otherwise the phone's setting. */
function currentTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === 'light' || set === 'dark') return set;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Light / Dark switch, on Home only (fix #14). Two labelled 52px buttons; the chosen one is filled and ticked, so the
 * state never relies on colour alone. The choice is remembered on this device; if storage fails, the phone decides.
 */
export default function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => setTheme(currentTheme()), []);

  function choose(t: Theme) {
    document.documentElement.dataset.theme = t;
    try {
      window.localStorage.setItem(KEY, t);
    } catch {
      /* private mode: the choice lasts until the page closes */
    }
    setTheme(t);
  }

  if (theme === null) return null; // known only in the browser; avoids showing the wrong button as chosen
  return (
    <fieldset className="theme-switch">
      <legend>Screen colours</legend>
      <div className="btn-row two" style={{ margin: 0 }}>
        {(['light', 'dark'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className="btn btn-secondary"
            style={{ minHeight: 52 }}
            aria-pressed={theme === t}
            onClick={() => choose(t)}
          >
            {theme === t && <Icon name="check" />} {t === 'light' ? 'Light' : 'Dark'}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
