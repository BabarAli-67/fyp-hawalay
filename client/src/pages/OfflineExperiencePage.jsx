import { Link } from 'react-router-dom';

/**
 * offline_pwa_experience.html — 1:1 body structure (header, main, bottom nav).
 */
export default function OfflineExperiencePage() {
  return (
    <div className="bg-background text-on-surface min-h-screen pb-24">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile h-16 bg-surface/70 dark:bg-inverse-surface/70 backdrop-blur-lg shadow-sm">
        <h1 className="font-h2 text-h2 font-bold text-primary dark:text-primary-fixed-dim">EthicalFinder</h1>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="material-symbols-outlined text-primary dark:text-primary-fixed-dim active:scale-95 transition-transform"
          >
            settings
          </button>
          <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center overflow-hidden border border-outline-variant">
            <img
              alt="User Avatar"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCQYkJZ-uUQKKrdLPK-QSDf9S9vqdJ1QFC0qDTx_41bWFQGuWz8AwA-kGX_B8PikN5dklBQDA8IdIHWozVdsy1IqTYOT-hWaVJhgU8uBu81-7R5TpL8rcsioCI6v_C_sWGrbmT96IBPZyB0EgmWmnwBp0FL7aHhXKZxhs3fqxXQkGB5DJlXGSRz_CbTxKVuRfb6Ac09Sblj43M3KiMbmH6Jx-T2G9_5FAu3U5s1ZSnf6jKxXJXRXaYJB59BBSEQocHFVhwqK3z9Y5w"
            />
          </div>
        </div>
      </header>
      <main className="pt-24 px-margin-mobile max-w-lg mx-auto">
        <section className="flex flex-col items-center text-center mb-xl">
          <div className="w-full max-w-[280px] aspect-square mb-lg rounded-full bg-secondary-container/30 flex items-center justify-center overflow-hidden">
            <img
              className="w-4/5 h-4/5 object-contain"
              alt=""
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBOn7pGDjp01tn05zUtjBORJaexMv-s6sKu-qx2pkaay_HJasvYYKD8OB3UU3fS1PTgabjb0SOqRk4KSU1r8kpU-_ajXI8MTZltSoCmwwKDfMuVnj3_SBG_Hge7_XiVfTJsxjE81Upd4dg3PZZkJjeQmfSpLbv6IBwPMd6v4NweImGqAW0dMPzAvk3YTjAwmQFtwjw04-iAepyBPj74Jmbcyv6kkOV-S4blkll7toZhdmyj6bSjAFLv7R9d3CzGqbJdIx7QAhCv8o0"
            />
          </div>
          <h2 className="font-h1 text-h1 text-on-surface mb-xs">Taking a Breath</h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-[300px]">
            You&apos;re currently offline. Your reports are safe and will sync as soon as you&apos;re back.
          </p>
          <button
            type="button"
            className="mt-lg px-xl py-md bg-primary text-on-primary rounded-full font-h3 text-h3 shadow-sm active:scale-95 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>
              refresh
            </span>
            Retry Connection
          </button>
        </section>
        <section className="mb-xl p-lg rounded-xl glass-panel border border-primary/10 shadow-sm flex items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-h3 text-h3 text-primary mb-1">Access Everywhere</h3>
            <p className="font-caption text-caption text-on-surface-variant">
              Install EthicalFinder to use features without an internet connection.
            </p>
          </div>
          <button type="button" className="bg-secondary-container text-on-secondary-container font-label-sm text-label-sm px-md py-sm rounded-lg active:scale-95 transition-all">
            Install
          </button>
        </section>
        <section className="mb-xl">
          <div className="flex items-center justify-between mb-md">
            <h3 className="font-h2 text-h2 flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary">cloud_sync</span>
              Sync Pending
            </h3>
            <span className="bg-tertiary-container text-on-tertiary-container text-caption font-caption px-xs py-1 rounded-full">
              2 items
            </span>
          </div>
          <div className="space-y-md">
            <div className="p-md rounded-xl bg-surface-container border border-outline-variant flex items-center gap-md">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface-variant">
                <img
                  className="w-full h-full object-cover"
                  alt=""
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAN2Cr5WNaB6K4hUGXJolONKFewENKQ7U990MDtw_cha_oj0gqsKX0VrEwxfTg3K-zLqAXACYkLXS71Jx_jNcAzZmj2E6Xo1bysM2XS6aFL0FR2NXj_UadW6fSudIoyNX0s4CA1rHcyXxksDoxIzQ3Rq52MdIJPRPTp2JaaA16E6jVB2K6ReuvKb71GLgHJHQeTmd92RUCQl8jMm-i2aG3_QR0E3G80UP0YWELhkPVAGZBYRpqMCSxuatuesc9uT9B7jm7RgXhYILc"
                />
              </div>
              <div className="flex-1">
                <p className="font-h3 text-h3 text-on-surface">Silver Keychain</p>
                <p className="font-caption text-caption text-on-surface-variant">Reported at Central Park • 10:45 AM</p>
              </div>
              <span className="material-symbols-outlined text-outline-variant">schedule</span>
            </div>
            <div className="p-md rounded-xl bg-surface-container border border-outline-variant flex items-center gap-md">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface-variant">
                <img
                  className="w-full h-full object-cover"
                  alt=""
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCsSJocsIFzJyL3MEKzR9wiF2w3Ahl-uHeggfs40zi2J6wa6eLjSJqhnh36XtYyRpqEW_lRgptxSl7KSSyecHEONwoKsUnOHX3tYD3PL0hriTXscBh5Z6cgdyz3zQ9df0TU9hjyH2Z28JFlk4503BB7nuKiBZsTIQq5iaY9xu0ng1EmYZnInyo4gCYi2J2ddnNGprjWZf1CjX4fC87-ah2FeiPGAVOygE8vvH57agUbr9EkyBChp2jZvvQWDDsjd9uVUrJ1WJNMMBw"
                />
              </div>
              <div className="flex-1">
                <p className="font-h3 text-h3 text-on-surface">Leather Wallet</p>
                <p className="font-caption text-caption text-on-surface-variant">Reported at Metro Station • 11:20 AM</p>
              </div>
              <span className="material-symbols-outlined text-outline-variant">schedule</span>
            </div>
          </div>
        </section>
        <section className="mb-xl">
          <h3 className="font-h2 text-h2 mb-md">Offline Available</h3>
          <div className="grid grid-cols-2 gap-md">
            <div className="aspect-square rounded-xl bg-surface-container-low p-md flex flex-col justify-between border border-primary/5 active:scale-98 transition-all">
              <span className="material-symbols-outlined text-primary text-3xl">map</span>
              <div>
                <p className="font-h3 text-h3">Local Map</p>
                <p className="font-caption text-caption text-on-surface-variant">5.2MB Cached</p>
              </div>
            </div>
            <div className="aspect-square rounded-xl bg-surface-container-low p-md flex flex-col justify-between border border-primary/5 active:scale-98 transition-all">
              <span className="material-symbols-outlined text-primary text-3xl">history</span>
              <div>
                <p className="font-h3 text-h3">My History</p>
                <p className="font-caption text-caption text-on-surface-variant">Recent 20 items</p>
              </div>
            </div>
            <div className="aspect-square rounded-xl bg-surface-container-low p-md flex flex-col justify-between border border-primary/5 active:scale-98 transition-all">
              <span className="material-symbols-outlined text-primary text-3xl">verified_user</span>
              <div>
                <p className="font-h3 text-h3">ID Vault</p>
                <p className="font-caption text-caption text-on-surface-variant">Encrypted &amp; Local</p>
              </div>
            </div>
            <div className="aspect-square rounded-xl bg-surface-container-low p-md flex flex-col justify-between border border-primary/5 active:scale-98 transition-all">
              <span className="material-symbols-outlined text-primary text-3xl">support_agent</span>
              <div>
                <p className="font-h3 text-h3">Help Guide</p>
                <p className="font-caption text-caption text-on-surface-variant">Emergency protocols</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-safe h-20 bg-surface/70 dark:bg-inverse-surface/70 backdrop-blur-xl shadow-lg rounded-t-xl">
        <Link
          to="/dashboard"
          className="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant hover:bg-surface-container-high/50 dark:hover:bg-surface-variant/20 rounded-xl px-2 py-1 transition-all duration-200"
        >
          <span className="material-symbols-outlined">home</span>
          <span className="font-label-sm text-label-sm">Home</span>
        </Link>
        <Link
          to="/matches"
          className="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant hover:bg-surface-container-high/50 dark:hover:bg-surface-variant/20 rounded-xl px-2 py-1 transition-all duration-200"
        >
          <span className="material-symbols-outlined">search</span>
          <span className="font-label-sm text-label-sm">Search</span>
        </Link>
        <Link
          to="/report"
          className="flex flex-col items-center justify-center text-primary dark:text-primary-fixed-dim font-bold transition-all duration-200"
        >
          <span className="material-symbols-outlined scale-125 mb-1" style={{ fontVariationSettings: "'FILL' 1" }}>
            add_circle
          </span>
          <span className="font-label-sm text-label-sm">Report</span>
        </Link>
        <Link
          to="/notifications"
          className="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant hover:bg-surface-container-high/50 dark:hover:bg-surface-variant/20 rounded-xl px-2 py-1 transition-all duration-200"
        >
          <span className="material-symbols-outlined">notifications</span>
          <span className="font-label-sm text-label-sm">Alerts</span>
        </Link>
        <Link
          to="/profile"
          className="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant hover:bg-surface-container-high/50 dark:hover:bg-surface-variant/20 rounded-xl px-2 py-1 transition-all duration-200"
        >
          <span className="material-symbols-outlined">person</span>
          <span className="font-label-sm text-label-sm">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
