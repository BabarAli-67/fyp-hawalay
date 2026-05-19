import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo.jsx';

/**
 * notification_screen.html — 1:1 body structure (header, main, bottom nav).
 */
export default function NotificationsPage() {
  return (
    <div className="bg-background text-on-surface min-h-screen pb-32">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile h-16 bg-surface/70 backdrop-blur-lg shadow-sm">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <h1 className="font-h2 text-h2 font-bold text-primary">Hawalay</h1>
        </div>
        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:opacity-80 transition-opacity active:scale-95 duration-200"
        >
          <span className="material-symbols-outlined" data-icon="settings">
            settings
          </span>
        </button>
      </header>
      <main className="pt-24 px-margin-mobile max-w-2xl mx-auto">
        <section className="mb-lg">
          <h2 className="font-h1 text-h1 text-on-surface mb-md">Alerts</h2>
          <div className="flex gap-xs overflow-x-auto pb-2 no-scrollbar">
            <button
              type="button"
              className="px-md py-xs bg-primary text-on-primary rounded-full font-label-sm whitespace-nowrap active:scale-95 transition-all"
            >
              All
            </button>
            <button
              type="button"
              className="px-md py-xs bg-surface-container text-on-surface-variant rounded-full font-label-sm whitespace-nowrap hover:bg-surface-container-high transition-all"
            >
              Matches
            </button>
            <button
              type="button"
              className="px-md py-xs bg-surface-container text-on-surface-variant rounded-full font-label-sm whitespace-nowrap hover:bg-surface-container-high transition-all"
            >
              Messages
            </button>
            <button
              type="button"
              className="px-md py-xs bg-surface-container text-on-surface-variant rounded-full font-label-sm whitespace-nowrap hover:bg-surface-container-high transition-all"
            >
              System
            </button>
          </div>
        </section>
        <div className="space-y-md">
          <div className="relative group p-md bg-surface-container-lowest rounded-xl shadow-sm border-l-4 border-primary-container flex gap-md items-start active:scale-[0.98] transition-all cursor-pointer">
            <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-primary-container/20 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[28px]" data-icon="travel_explore">
                travel_explore
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-h3 text-h3 text-on-surface truncate">Match Alert</h3>
                <span className="font-caption text-caption text-outline">2m ago</span>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant mb-md leading-relaxed">
                We found a potential match for your lost <span className="font-bold text-primary">Blue Leather Wallet</span> near
                Central Park.
              </p>
              <div className="flex items-center gap-md">
                <button type="button" className="font-label-sm text-primary hover:underline transition-all">
                  View Details
                </button>
                <button type="button" className="font-label-sm text-outline hover:text-on-surface-variant transition-all">
                  Mark as read
                </button>
              </div>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary-container"></div>
          </div>
          <div className="relative group p-md bg-surface-container-lowest rounded-xl shadow-sm flex gap-md items-start active:scale-[0.98] transition-all cursor-pointer">
            <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-secondary-container/20 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[28px]" data-icon="chat_bubble">
                chat_bubble
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-h3 text-h3 text-on-surface truncate">New Message</h3>
                <span className="font-caption text-caption text-outline">45m ago</span>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant mb-md leading-relaxed">
                Sarah Jenkins sent you a message regarding the <span className="font-bold">MacBook Pro</span> you reported found.
              </p>
              <div className="flex items-center gap-md">
                <button type="button" className="font-label-sm text-primary hover:underline transition-all">
                  Reply Now
                </button>
                <button type="button" className="font-label-sm text-outline hover:text-on-surface-variant transition-all">
                  Mark as read
                </button>
              </div>
            </div>
          </div>
          <div className="relative group p-md bg-surface-container-lowest rounded-xl shadow-sm border-l-4 border-primary flex gap-md items-start active:scale-[0.98] transition-all cursor-pointer">
            <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <span
                className="material-symbols-outlined text-[28px]"
                data-icon="verified"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-h3 text-h3 text-on-surface truncate">Claim Verified</h3>
                <span className="font-caption text-caption text-outline">3h ago</span>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant mb-md leading-relaxed">
                The ownership of the <span className="font-bold text-primary">DSLR Camera</span> has been verified. You can now
                arrange the handover.
              </p>
              <div className="flex items-center gap-md">
                <button type="button" className="font-label-sm text-primary hover:underline transition-all">
                  Handover Details
                </button>
                <button type="button" className="font-label-sm text-outline hover:text-on-surface-variant transition-all">
                  Mark as read
                </button>
              </div>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary"></div>
          </div>
          <div className="relative group p-md bg-surface-container-lowest rounded-xl shadow-sm flex gap-md items-start active:scale-[0.98] transition-all cursor-pointer">
            <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-surface-variant flex items-center justify-center text-outline">
              <span className="material-symbols-outlined text-[28px]" data-icon="info">
                info
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-h3 text-h3 text-on-surface truncate">Security Update</h3>
                <span className="font-caption text-caption text-outline">Yesterday</span>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant mb-md leading-relaxed">
                Your account security settings have been successfully updated. We&apos;ve added an extra layer of protection.
              </p>
              <div className="flex items-center gap-md">
                <button type="button" className="font-label-sm text-outline hover:text-on-surface-variant transition-all">
                  Mark as read
                </button>
              </div>
            </div>
          </div>
          <div className="relative group p-md bg-surface-container-lowest rounded-xl shadow-sm border-l-4 border-tertiary-container flex gap-md items-start active:scale-[0.98] transition-all cursor-pointer">
            <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-tertiary-container/20 flex items-center justify-center text-tertiary">
              <span
                className="material-symbols-outlined text-[28px]"
                data-icon="warning"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                warning
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-h3 text-h3 text-on-surface truncate">Urgent: Action Required</h3>
                <span className="font-caption text-caption text-outline">1d ago</span>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant mb-md leading-relaxed">
                A claim for your <span className="font-bold">Keys</span> is about to expire. Please verify the finder within 4
                hours.
              </p>
              <div className="flex items-center gap-md">
                <button type="button" className="font-label-sm text-tertiary hover:underline transition-all font-bold">
                  Review Claim
                </button>
                <button type="button" className="font-label-sm text-outline hover:text-on-surface-variant transition-all">
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-safe h-20 bg-surface/70 backdrop-blur-xl shadow-lg rounded-t-xl">
        <Link
          to="/dashboard"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-high/50 rounded-xl transition-all active:scale-98"
        >
          <span className="material-symbols-outlined" data-icon="home">
            home
          </span>
          <span className="font-label-sm text-label-sm">Home</span>
        </Link>
        <Link
          to="/matches"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-high/50 rounded-xl transition-all active:scale-98"
        >
          <span className="material-symbols-outlined" data-icon="search">
            search
          </span>
          <span className="font-label-sm text-label-sm">Search</span>
        </Link>
        <Link
          to="/report"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-high/50 rounded-xl transition-all active:scale-98"
        >
          <span className="material-symbols-outlined text-primary text-[32px]" data-icon="add_circle">
            add_circle
          </span>
          <span className="font-label-sm text-label-sm">Report</span>
        </Link>
        <div className="flex flex-col items-center justify-center text-primary font-bold transition-all active:scale-98">
          <span className="material-symbols-outlined" data-icon="notifications" style={{ fontVariationSettings: "'FILL' 1" }}>
            notifications
          </span>
          <span className="font-label-sm text-label-sm">Alerts</span>
        </div>
        <Link
          to="/profile"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-high/50 rounded-xl transition-all active:scale-98"
        >
          <span className="material-symbols-outlined" data-icon="person">
            person
          </span>
          <span className="font-label-sm text-label-sm">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
