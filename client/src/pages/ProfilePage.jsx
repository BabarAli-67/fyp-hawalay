import { Link } from 'react-router-dom';

/**
 * user_profle.html — 1:1 body structure (header, main, bottom nav).
 */
export default function ProfilePage() {
  return (
    <div className="bg-background text-on-surface min-h-screen pb-32">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile h-16 bg-surface/70 backdrop-blur-lg shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary-container shadow-sm">
            <img
              alt="User Profile"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuB6pXOF-iyI-6Ti9RXxdcrJ9uwskpqV0-7Xkb6R7t7MkQVeqno-rAszLrNGWMf_Eq6DCNNjYa1rgkX6hRjbI6Z-4RFOVzUIrmWkfJ_5TjVm4HJ6LdtJf2Shj15SJnf-kfWNqmHXrTOW9NC0Tv2bZJ_CV5aVV9826NmSr7YcfKKbENB6tPOog5Dn9eRWxxfubMOo7W3O_3YQ0BjHT7wAzzeKLfogXXaPRhN6d4yTCeSlu-kH_QuKPfs4_2Bso-RLablyVLAT2QEVojc"
            />
          </div>
          <span className="font-h2 text-h2 font-bold text-primary">EthicalFinder</span>
        </div>
        <button type="button" className="material-symbols-outlined text-primary hover:opacity-80 transition-opacity active:scale-95 duration-200">
          settings
        </button>
      </header>
      <main className="mt-20 px-margin-mobile">
        <section className="flex flex-col items-center text-center mb-lg">
          <div className="relative mb-md">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg">
              <img
                alt="Sarah Jenkins Profile"
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAju3oHIV5HpwjLiXv0Cp3vcxUAC1FmkS2TDq7b9EZ-GIykLHFw222Lf9o5EC6F5wizJrwL7SjhGibdo3XSd2m-6y2RrRnBcVpg80Y0HnKqRGmT6bytCRRUyLgkz7r4fhlHG3N8BpNUMHaYkHSsvdH4t23hChFdfb7q86oCPwWJQorP29nad_JhG15GuKxalLv71ZPxVutBN_oSn5NVbOt0gzJQvNjjWP3c-T2G-5jLrQeJCAPxoSzlpwxBLNAXCeM183G53-Z9CWQ"
              />
            </div>
            <div className="absolute -bottom-2 right-2 bg-primary text-on-primary text-[10px] font-bold px-3 py-1 rounded-full border-2 border-white shadow-sm flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                verified
              </span>
              TRUSTED
            </div>
          </div>
          <h1 className="font-h1 text-h1 text-on-surface">Sarah Jenkins</h1>
          <p className="text-on-surface-variant font-body-md">Community Guardian since Jan 2023</p>
        </section>
        <section className="grid grid-cols-3 gap-3 mb-xl">
          <div className="bg-surface-container-low p-md rounded-xl text-center shadow-sm border-b-4 border-transparent active:scale-98 transition-all">
            <p className="font-h2 text-h2 text-primary font-bold">2</p>
            <p className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">Lost</p>
          </div>
          <div className="bg-primary-container/10 p-md rounded-xl text-center shadow-sm border-b-4 border-primary active:scale-98 transition-all">
            <p className="font-h2 text-h2 text-primary font-bold">1</p>
            <p className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">Found</p>
          </div>
          <div className="bg-surface-container-low p-md rounded-xl text-center shadow-sm border-b-4 border-transparent active:scale-98 transition-all">
            <p className="font-h2 text-h2 text-primary font-bold">3</p>
            <p className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">Returns</p>
          </div>
        </section>
        <section className="mb-lg">
          <div className="flex items-center gap-xl border-b border-outline-variant/30 mb-md">
            <button type="button" className="pb-base border-b-2 border-primary font-h3 text-h3 text-primary">
              My Reports
            </button>
            <button type="button" className="pb-base border-b-2 border-transparent font-h3 text-h3 text-on-surface-variant">
              Match History
            </button>
          </div>
          <div className="space-y-4">
            <div className="bg-surface-container-lowest p-md rounded-xl shadow-sm border-l-4 border-primary-container flex gap-4">
              <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container">
                <img
                  alt="Found Wallet"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuC-zvsXqDiGfp2bayJ2d85VPW8c0W0dgu3gYaNG7UGrd8OmRRsTlKOWONbBlgnpJ6mlJbzvpq_2G22BfD8hMSf5jJVnaMhNbog6niyaQ6KI76uCTMYXXZ2rebO7bQ1wCORHDna0TEnD9yhJPXxmQfEQe0ZrSNDWinzDnEJCe_1XJv7rAQkKn0OKxQ0Zs7jFCQU3XL7lPtv1NcU9mXYr65HvgzAnWwStgu3N6k4k2pavAUezOmiQYwCHbpxso0iQG772nQlcn5OFtXI"
                />
              </div>
              <div className="flex-grow">
                <div className="flex justify-between items-start">
                  <h3 className="font-h3 text-h3 text-on-surface">Leather Wallet</h3>
                  <span className="bg-secondary-container text-on-secondary-container text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-tighter">
                    Matched
                  </span>
                </div>
                <p className="font-caption text-caption text-on-surface-variant mb-2">Central Park South Area</p>
                <div className="flex items-center gap-1 text-primary">
                  <span className="material-symbols-outlined text-[16px]">verified_user</span>
                  <span className="font-label-sm text-label-sm">Awaiting handover</span>
                </div>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-md rounded-xl shadow-sm border-l-4 border-outline-variant flex gap-4">
              <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container">
                <img
                  alt="Lost Keys"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAeYUlvTAY4_4PcSpef5VLzE3cHs8Hvsx79jXg4tqL0QbQTSeDh3DyJagk-1tXIFIm9J7hKalO_w_BVp5kIdRqAjDlCslklgf9dFD2NKRhDdXDBepIFfDGKRrgt0VLWeUUWgbsqk_8pdSN5PVcmdsY-AOLtkqqBuoXv93PtCLdYyZfLNkRwpANainTbjfalkGk5QOulUDsWgY1se9VzVTydsANosnGcTiD77X0X83ONCVsPeAPHDo-nEDyZWUDKRSDE4d9rmcLP4zk"
                />
              </div>
              <div className="flex-grow">
                <div className="flex justify-between items-start">
                  <h3 className="font-h3 text-h3 text-on-surface">House Keys</h3>
                  <span className="bg-surface-variant text-on-surface-variant text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-tighter">
                    Searching
                  </span>
                </div>
                <p className="font-caption text-caption text-on-surface-variant mb-2">Near Liberty Cafe</p>
                <div className="flex items-center gap-1 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[16px]">sync</span>
                  <span className="font-label-sm text-label-sm">Scanned by 4 users</span>
                </div>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-md rounded-xl shadow-sm border-l-4 border-primary flex gap-4 opacity-75">
              <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container">
                <img
                  alt="Returned Watch"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDyCTVL_y0Bi0weIP4VgI5wlqTG_D4SDPd49GCSSj57nX22XDqOXRa6U4voiQI0NeHskDkw3mFyd1Mh9gZKImAmKiu_fI06PhlkQjsih0qvgXoIfNsdMlhAspi9MbTGJ0oBM9SpU8lOjfDkah0_AvPqIon7tCTZxLM7a8DHhvGWph-E4BTpb5DoPBhOP3IGPuugijKr3jim1owqu4jlWiCDJuBgx8dmSSP3Qq9SxYknSXdMgh-4wKtTGAtPFlrUATU7wgvVyZS6dD0"
                />
              </div>
              <div className="flex-grow">
                <div className="flex justify-between items-start">
                  <h3 className="font-h3 text-h3 text-on-surface">Silver Watch</h3>
                  <span className="bg-primary text-on-primary text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-tighter">
                    Returned
                  </span>
                </div>
                <p className="font-caption text-caption text-on-surface-variant mb-2">Grand Central Station</p>
                <div className="flex items-center gap-1 text-primary">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span className="font-label-sm text-label-sm">Closed on Oct 12</span>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="mb-xl">
          <h2 className="font-h3 text-h3 text-on-surface-variant mb-md px-1">Settings &amp; Security</h2>
          <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm">
            <button
              type="button"
              className="w-full flex items-center justify-between p-md hover:bg-surface-container transition-colors active:scale-[0.99]"
            >
              <div className="flex items-center gap-md">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined">notifications</span>
                </div>
                <span className="font-body-lg text-body-lg text-on-surface">Notifications</span>
              </div>
              <span className="material-symbols-outlined text-outline">chevron_right</span>
            </button>
            <div className="h-[1px] bg-outline-variant/20 mx-md"></div>
            <button
              type="button"
              className="w-full flex items-center justify-between p-md hover:bg-surface-container transition-colors active:scale-[0.99]"
            >
              <div className="flex items-center gap-md">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined">shield</span>
                </div>
                <span className="font-body-lg text-body-lg text-on-surface">Privacy</span>
              </div>
              <span className="material-symbols-outlined text-outline">chevron_right</span>
            </button>
            <div className="h-[1px] bg-outline-variant/20 mx-md"></div>
            <button
              type="button"
              className="w-full flex items-center justify-between p-md hover:bg-surface-container transition-colors active:scale-[0.99]"
            >
              <div className="flex items-center gap-md">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined">help</span>
                </div>
                <span className="font-body-lg text-body-lg text-on-surface">Help &amp; Support</span>
              </div>
              <span className="material-symbols-outlined text-outline">chevron_right</span>
            </button>
          </div>
        </section>
      </main>
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-safe h-20 bg-surface/70 backdrop-blur-xl shadow-lg rounded-t-xl">
        <Link
          to="/dashboard"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-high/50 transition-all rounded-xl p-2 active:scale-98"
        >
          <span className="material-symbols-outlined">home</span>
          <span className="font-label-sm text-label-sm">Home</span>
        </Link>
        <Link
          to="/matches"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-high/50 transition-all rounded-xl p-2 active:scale-98"
        >
          <span className="material-symbols-outlined">search</span>
          <span className="font-label-sm text-label-sm">Search</span>
        </Link>
        <Link to="/report" className="flex flex-col items-center justify-center -mt-8">
          <div className="w-14 h-14 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform">
            <span className="material-symbols-outlined text-[32px]">add_circle</span>
          </div>
          <span className="font-label-sm text-label-sm text-primary font-bold mt-1">Report</span>
        </Link>
        <Link
          to="/notifications"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-high/50 transition-all rounded-xl p-2 active:scale-98"
        >
          <span className="material-symbols-outlined">notifications</span>
          <span className="font-label-sm text-label-sm">Alerts</span>
        </Link>
        <div className="flex flex-col items-center justify-center text-primary font-bold hover:bg-surface-container-high/50 transition-all rounded-xl p-2 active:scale-98">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            person
          </span>
          <span className="font-label-sm text-label-sm">Profile</span>
        </div>
      </nav>
    </div>
  );
}
