import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo.jsx';

const SECTIONS = [
  {
    id: 'intro',
    icon: 'shield',
    title: 'Privacy Policy for Hawalay',
    paragraphs: [
      'At Hawalay, protecting user privacy is one of our highest priorities. Hawalay is a lost-and-found platform that helps people report, search, and recover belongings. We collect and process only the information needed to run the service.',
      'This policy describes how the Hawalay PWA handles your data based on the features currently implemented in the application.',
      'Last updated: June 2026',
    ],
  },
  {
    id: 'account',
    icon: 'person',
    title: 'Account information',
    paragraphs: [
      'When you register, Hawalay stores your name, email address, and account credentials. Local accounts use a hashed password; Google sign-in uses Google OAuth and does not store your Google password.',
      'Email verification (one-time passcode) may be used to confirm your address before your account is marked as verified.',
      'Your profile can include an optional bio and profile photo. Profile data is stored on Hawalay servers and used to identify you within the app.',
      'Authentication uses JSON Web Tokens (JWT). Tokens are kept in your browser local storage so you stay signed in between visits.',
    ],
  },
  {
    id: 'reports',
    icon: 'inventory_2',
    title: 'Lost & found reports',
    paragraphs: [
      'When you submit a report, Hawalay stores the details you provide: report type (lost or found), item title, category, brand, condition, date, description, distinctive features, and uploaded photos.',
      'Submitted reports appear in community browse and search features so other signed-in users can discover them. Report status (for example active or claimed) can be updated from your profile.',
      'Images attached to reports are stored securely on Hawalay servers and are associated with your account as the report owner.',
    ],
  },
  {
    id: 'ai',
    icon: 'auto_awesome',
    title: 'Image & AI processing',
    paragraphs: [
      'Photos you upload on the report form are sent to Hawalay\'s AI service for analysis. Processing may include:',
      '• OCR and document field extraction for identity cards and similar documents (YOLO-based detection).',
      '• General object detection to suggest item categories.',
      '• Image captioning and distinctive-feature extraction.',
      '• Semantic embedding generation (Google Gemini embedding models, with CLIP-based fusion where applicable) to power smart matching.',
      'AI-generated suggestions (description, features, brand, category hints) are shown in the form for you to review and edit before submission. Analyze results and embeddings may be stored with your report to support search and matching.',
      'AI processing runs when you upload or change a report photo; restored form drafts can retain prior analysis so you do not need to re-run it after an accidental exit.',
    ],
  },
  {
    id: 'location',
    icon: 'location_on',
    title: 'Location information',
    paragraphs: [
      'Hawalay uses location to pin where an item was lost or found. With your permission, the app reads GPS coordinates from your device when you open the report form.',
      'You can adjust primary and optional secondary locations on an interactive map (OpenStreetMap tiles via Leaflet). Place names may be resolved using the OpenStreetMap Nominatim reverse-geocoding service directly from your browser.',
      'Coordinates and location names are stored with your report and used for nearby matching and map display. They are shared only as part of the report information visible to other users browsing or matching items—not as a separate public location feed.',
    ],
  },
  {
    id: 'matching',
    icon: 'travel_explore',
    title: 'Matching & search',
    paragraphs: [
      'Hawalay compares lost and found reports using categories, locations, text details, and AI-generated embeddings to surface potential matches.',
      'When the matching service finds a candidate, you may receive an in-app notification and see matches on your dashboard, Smart Matches page, and profile match history.',
      'Match scores and metadata are stored to help you review and act on results.',
    ],
  },
  {
    id: 'chat',
    icon: 'chat',
    title: 'Messaging',
    paragraphs: [
      'When you and another user are connected through a match, Hawalay provides in-app chat so you can coordinate return of an item.',
      'Messages are stored on Hawalay servers, linked to the match conversation, and are accessible only to participants in that chat. Read status may be tracked so you can see unread counts.',
    ],
  },
  {
    id: 'notifications',
    icon: 'notifications',
    title: 'In-app notifications',
    paragraphs: [
      'Hawalay maintains an in-app notification inbox for events such as match alerts and system messages. Notifications are tied to your account and can be marked read from the notifications page.',
      'Real-time updates may be delivered while you are using the app via a live connection (WebSocket) for matches and chat activity.',
    ],
  },
  {
    id: 'offline',
    icon: 'cloud_sync',
    title: 'Offline use & device storage',
    paragraphs: [
      'Hawalay is a Progressive Web App. When you are offline, report submissions can be queued locally in IndexedDB and synced automatically when connectivity returns (via the service worker background sync).',
      'While you fill out a report, form progress may be auto-saved as a draft in IndexedDB on your device so you can resume after refresh or navigation.',
      'Your browser may also store: sign-in tokens, theme preference (light/dark), recently viewed item IDs, and cached chat data—to improve performance and continuity. Signing out clears authentication data from local storage.',
    ],
  },
  {
    id: 'security',
    icon: 'lock',
    title: 'Data security',
    paragraphs: [
      'Hawalay uses HTTPS for communication between the client, Express API, and AI processing service. API requests from the app include your authentication token; protected routes reject unauthenticated access.',
      'Passwords are hashed before storage. Internal service calls between backend components can use a shared secret.',
      'We apply access controls so users can manage their own profile, reports, matches, and conversations according to features available in the app.',
    ],
  },
  {
    id: 'control',
    icon: 'tune',
    title: 'Your control',
    paragraphs: [
      'You can edit your profile (name, bio, photo) from the Profile page.',
      'You can update report status (for example mark as claimed) from your profile reports list.',
      'You can sign out at any time from the navigation bar or Profile settings; you will be asked to confirm before your session ends.',
      'If you have questions about data handled by Hawalay, contact your platform administrator or project team—the app does not currently provide a self-service account deletion flow in the UI.',
    ],
  },
];

function PolicySection({ section }) {
  const isIntro = section.id === 'intro';

  return (
    <section aria-labelledby={`privacy-${section.id}`} className="space-y-sm">
      <div className="flex items-start gap-sm">
        <span
          className={`material-symbols-outlined shrink-0 ${isIntro ? 'text-primary text-[28px]' : 'text-primary text-[22px] mt-0.5'}`}
        >
          {section.icon}
        </span>
        <h2
          id={`privacy-${section.id}`}
          className={isIntro ? 'font-h1 text-h1 text-on-surface' : 'font-h2 text-h2 text-on-surface'}
        >
          {section.title}
        </h2>
      </div>
      <div className="space-y-sm pl-0 sm:pl-9">
        {section.paragraphs.map((paragraph) => (
          <p key={paragraph} className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}

/**
 * Hawalay-specific privacy policy — reflects actual PWA features and data flows.
 */
export default function PrivacyPolicyPage() {
  return (
    <div className="bg-background text-on-background min-h-screen pb-16">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile h-16 bg-surface/70 backdrop-blur-lg shadow-sm border-b border-outline-variant/10">
        <Link
          to="/profile"
          className="flex items-center justify-center w-10 h-10 rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors active:scale-95"
          aria-label="Back to profile"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <div className="flex items-center gap-2">
          <Logo size="sm" />
          <h1 className="font-h2 text-h2 font-bold text-primary">Hawalay</h1>
        </div>
        <div className="w-10" aria-hidden="true" />
      </header>

      <main className="pt-24 px-margin-mobile max-w-2xl mx-auto space-y-xl pb-8">
        {SECTIONS.map((section, index) => (
          <div key={section.id}>
            {index > 0 ? <div className="h-px bg-outline-variant/20 mb-xl" aria-hidden="true" /> : null}
            <PolicySection section={section} />
          </div>
        ))}
      </main>
    </div>
  );
}
