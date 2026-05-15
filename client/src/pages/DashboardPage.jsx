import { Link, useLocation, useOutletContext } from 'react-router-dom';

/**
 * dashboard.html — 1:1 main column + bottom navigation (header supplied by AppLayout).
 */
export default function DashboardPage() {
  const { user } = useOutletContext();
  const location = useLocation();
  const homeActive = location.pathname === '/dashboard';
  const displayName = user?.name ?? 'Sarah';

  return (
    <div className="bg-background text-on-background min-h-screen pb-24">
      <div className="px-margin-mobile space-y-lg">
        <section className="mt-4">
          <h2 className="font-h1 text-h1 text-on-surface">Hello, {displayName}</h2>
          <p className="font-body-md text-on-surface-variant">Your ethical stewardship dashboard is ready.</p>
        </section>
        <section className="grid grid-cols-2 gap-md">
          <Link
            to="/report"
            className="bg-primary shadow-sm rounded-xl p-md flex flex-col justify-between aspect-square active:scale-95 transition-transform duration-200 cursor-pointer"
          >
            <div className="bg-white/20 w-10 h-10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-white">search</span>
            </div>
            <span className="text-white font-h3 text-h3 leading-tight">Report Lost</span>
          </Link>
          <Link
            to="/report"
            className="bg-primary-container shadow-sm rounded-xl p-md flex flex-col justify-between aspect-square active:scale-95 transition-transform duration-200 cursor-pointer"
          >
            <div className="bg-on-primary-container/10 w-10 h-10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary-container">add_circle</span>
            </div>
            <span className="text-on-primary-container font-h3 text-h3 leading-tight">Report Found</span>
          </Link>
          <div className="bg-surface-container shadow-sm rounded-xl p-md flex flex-col justify-between aspect-square active:scale-95 transition-transform duration-200 cursor-pointer border border-outline-variant/30">
            <div className="bg-on-surface-variant/10 w-10 h-10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant">document_scanner</span>
            </div>
            <span className="text-on-surface font-h3 text-h3 leading-tight">Scan Item</span>
          </div>
          <div className="bg-surface-container shadow-sm rounded-xl p-md flex flex-col justify-between aspect-square active:scale-95 transition-transform duration-200 cursor-pointer border border-outline-variant/30">
            <div className="bg-on-surface-variant/10 w-10 h-10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant">history</span>
            </div>
            <span className="text-on-surface font-h3 text-h3 leading-tight">My Activities</span>
          </div>
        </section>
        <section className="space-y-md">
          <div className="flex justify-between items-center">
            <h3 className="font-h3 text-h3 text-on-surface">Smart Matches</h3>
            <span className="bg-tertiary-container/20 text-tertiary font-label-sm px-2 py-1 rounded-full">2 New</span>
          </div>
          <div className="flex flex-col gap-sm">
            <Link
              to="/matches"
              className="glass-card border border-primary-container/30 p-md rounded-xl flex gap-md items-center shadow-sm"
            >
              <div className="w-12 h-12 rounded-lg bg-primary-container/20 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  auto_awesome
                </span>
              </div>
              <div className="flex-1">
                <p className="font-h3 text-h3 text-on-surface-variant leading-none mb-1">Potential Match Found</p>
                <p className="font-caption text-caption text-outline">
                  A Leather Wallet matches your &quot;Lost&quot; report in Downtown.
                </p>
              </div>
              <span className="material-symbols-outlined text-outline-variant">chevron_right</span>
            </Link>
          </div>
        </section>
        <section className="space-y-md pb-8">
          <div className="flex justify-between items-center">
            <h3 className="font-h3 text-h3 text-on-surface">Recent Activity</h3>
            <button type="button" className="text-primary font-label-sm">
              View All
            </button>
          </div>
          <div className="flex overflow-x-auto gap-md pb-4 custom-scrollbar -mx-margin-mobile px-margin-mobile">
            <div className="min-w-[280px] bg-surface rounded-xl border border-outline-variant/20 shadow-sm overflow-hidden flex flex-col">
              <div className="h-32 w-full relative">
                <img
                  alt="Wallet"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCZrL5Cl5XhiVEW3MXKAjkerNh0TVIgKViTKhiN5e7T16HjVzJ3uBKM3g9hoAttrh8sAwzyEKazjKwxpOh9vpf3VcOElQ7iRLUk5HOlkZBbPVLYbGY73epMcwieqcZ6MhcB91sEYtWmq3PLgTvqFZWmXrQh1skIL-FBCFpHadJsjzMjVIgsdxjNDH08CWOufSBwGf4snmDgyWGpZwFsXCdge1JmMOd4pGquSicrdsL1redrUQgdQyxt3yBlf2Dod4EVYoEfz7nFgHs"
                />
                <div className="absolute top-2 right-2 px-2 py-1 bg-primary/90 text-white text-[10px] font-bold rounded-md backdrop-blur-sm">
                  FOUND
                </div>
              </div>
              <div className="p-md space-y-xs">
                <h4 className="font-h3 text-h3 text-on-surface">Leather Wallet</h4>
                <div className="flex items-center gap-xs text-outline">
                  <span className="material-symbols-outlined text-[16px]">location_on</span>
                  <span className="text-caption">Central Plaza</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></div>
                    <span className="text-caption font-medium text-tertiary">Pending Match</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="min-w-[280px] bg-surface rounded-xl border border-outline-variant/20 shadow-sm overflow-hidden flex flex-col">
              <div className="h-32 w-full relative">
                <img
                  alt="Keys"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuC4LleA5fLFaEKl6xh2dqqhpXhYOLTLSf8A9lpnwzwmHHJf-6-HwmS6U3WOK1f-j549YYgmfFtSQa1fC3UrHvG0VEb-VTOsRbKQFsh9xoaKg7fyhscnle8HpQ28khvvQv7iZWmglUw05IsjomGDTCavuABIZeMT2xy6eRfSBtqoRSlLhgdtj83KbERrmFHo22hu3vrc_wN7B8bAB86i0lzLVP8B9MJPbZror7KOF406neWZVAL9-N4b02L04cJD-0QBQ7Wj8dL8rW0"
                />
                <div className="absolute top-2 right-2 px-2 py-1 bg-outline text-white text-[10px] font-bold rounded-md backdrop-blur-sm">
                  LOST
                </div>
              </div>
              <div className="p-md space-y-xs">
                <h4 className="font-h3 text-h3 text-on-surface">Car Keys (Toyota)</h4>
                <div className="flex items-center gap-xs text-outline">
                  <span className="material-symbols-outlined text-[16px]">location_on</span>
                  <span className="text-caption">City Library</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-outline"></div>
                    <span className="text-caption font-medium text-outline">Searching</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-safe h-20 bg-surface/70 backdrop-blur-xl rounded-t-xl shadow-lg">
        <Link
          to="/dashboard"
          className={`flex flex-col items-center justify-center active:scale-98 transition-all duration-200 cursor-pointer px-3 py-1 rounded-xl ${
            homeActive ? 'text-primary font-bold' : 'text-on-surface-variant hover:bg-surface-container-high/50'
          }`}
          aria-current={homeActive ? 'page' : undefined}
        >
          <span
            className="material-symbols-outlined"
            style={homeActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            home
          </span>
          <span className="font-label-sm text-label-sm">Home</span>
        </Link>
        <Link
          to="/matches"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-high/50 rounded-xl transition-all duration-200 cursor-pointer px-3 py-1"
        >
          <span className="material-symbols-outlined">search</span>
          <span className="font-label-sm text-label-sm">Search</span>
        </Link>
        <Link
          to="/report"
          className="flex flex-col items-center justify-center relative -mt-8"
        >
          <div className="w-14 h-14 bg-primary rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform duration-200">
            <span className="material-symbols-outlined text-white text-[32px]">add</span>
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant mt-2">Report</span>
        </Link>
        <Link
          to="/notifications"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-high/50 rounded-xl transition-all duration-200 cursor-pointer px-3 py-1"
        >
          <span className="material-symbols-outlined">notifications</span>
          <span className="font-label-sm text-label-sm">Alerts</span>
        </Link>
        <Link
          to="/profile"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-high/50 rounded-xl transition-all duration-200 cursor-pointer px-3 py-1"
        >
          <span className="material-symbols-outlined">person</span>
          <span className="font-label-sm text-label-sm">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
