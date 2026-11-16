import ScreenHeader from '@/components/ScreenHeader';
import { APP_VERSION, BUILD_DATE, CONTENT_VERSION, GIT_COMMIT } from '@/lib/version';

export const metadata = { title: 'About · Is It AI?' };

export default function Page() {
  return (
    <div className="page">
      <ScreenHeader listenText="About this app and your privacy. Every example is made up. No names are saved." />
      <h1>About this app</h1>
      <div className="card">
        <h2>What it is</h2>
        <p style={{ marginBottom: 0 }}>
          Is It AI? helps adults 60 and over practise spotting scams that use AI, such as cloned voices, fake videos and
          polished fake messages. It was made as a student project for the Digital Transformation Technologies course
          (DTO 5839, Group 6).
        </p>
      </div>
      <div className="card">
        <h2>Every example is made up</h2>
        <p style={{ marginBottom: 0 }}>
          Names, banks and phone numbers are invented. People, voices and photos are fully synthetic and do not copy any real person.
          Anything made with AI is labelled “Made with AI for training”.
        </p>
      </div>
      <div className="card">
        <h2>Your privacy</h2>
        <ul className="flags">
          <li>No names, emails or phone numbers are asked for or saved.</li>
          <li>Your answers are saved on your own device so you can see your progress.</li>
          <li>They may also be sent to the project database under a random code (or the session code from your helper), with how long each answer took and the kind of device you use (phone, tablet or computer).</li>
          <li>Research sessions are run with your consent.</li>
        </ul>
      </div>
      <p className="muted">
        Version {APP_VERSION} · content {CONTENT_VERSION} · build {GIT_COMMIT}{BUILD_DATE ? ` · ${BUILD_DATE}` : ''}
      </p>
    </div>
  );
}
