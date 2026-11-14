import pkg from '../../package.json';
import { CONTENT_VERSION } from './content';

/** App version comes from package.json. Content version comes from content/meta.json. They move independently. */
export const APP_VERSION: string = pkg.version;
export { CONTENT_VERSION };
export const GIT_COMMIT: string = process.env.NEXT_PUBLIC_GIT_COMMIT || 'dev';
export const BUILD_DATE: string = process.env.NEXT_PUBLIC_BUILD_DATE || '';

export function versionLabel(): string {
  return `v${APP_VERSION} · content ${CONTENT_VERSION} · ${GIT_COMMIT}`;
}
