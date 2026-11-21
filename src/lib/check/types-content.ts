import checkJson from '../../../content/check.json';
import type { CheckContentLite } from './types';

/** content/check.json as the app uses it. Import this only from the app (not from node tests, which read the JSON directly). */
export const CHECK = checkJson;
export const CHECK_CONTENT_LITE: CheckContentLite = {
  general_step: checkJson.general_step.text,
  still_personal: checkJson.still_personal,
  learn: checkJson.learn,
};
export const fill = (s: string, vars: Record<string, string | number>): string =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
