import { APP_VERSION, BUILD_DATE, CONTENT_VERSION, GIT_COMMIT } from '@/lib/version';

export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ app: APP_VERSION, content: CONTENT_VERSION, commit: GIT_COMMIT, built: BUILD_DATE });
}
