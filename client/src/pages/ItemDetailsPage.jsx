import { Link, useNavigate } from 'react-router-dom';

/**
 * item_details.html — 1:1 body structure (header, main, footer). Bottom nav omitted per HTML comment.
 */
export default function ItemDetailsPage() {
  const navigate = useNavigate();
  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen pb-32">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile h-16 bg-surface/70 backdrop-blur-lg shadow-sm">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="active:scale-95 transition-transform duration-200"
        >
          <span className="material-symbols-outlined text-primary">arrow_back</span>
        </button>
        <h1 className="font-h3 text-h3 text-on-surface font-bold">EthicalFinder</h1>
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-on-surface-variant hover:opacity-80 transition-opacity cursor-pointer">
            share
          </span>
          <span className="material-symbols-outlined text-on-surface-variant hover:opacity-80 transition-opacity cursor-pointer">
            settings
          </span>
        </div>
      </header>
      <main className="pt-16">
        <section className="relative w-full h-[397px] overflow-hidden">
          <div className="flex h-full w-full overflow-x-auto snap-x snap-mandatory hide-scrollbar">
            <div className="flex-none w-full h-full snap-center">
              <img
                className="w-full h-full object-cover"
                alt=""
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCeJayg60FRLuaFR4VfMaPlvjOibyschSfPu4W5-dayvDCFaIXjfHj7xVmNk_M7JxHQDTIKF1G-_A4LJ8RscAOPM0pZhub-uloUAe1iVNmB8FdAUfIADfLxpC7sddHSADJaGAKFWtKbRzymC4TGkQ6XAMV8UyNpa_gaMzuFogHluFts5z3UujSHvcdOpY0XHnvbTKlyutsO6Y1PpahXo_OUr63JzdQmOKzISUUPDiu5NOYVmmMisUEU-FvDN7IdivRqtU9QqpJsB6k"
              />
            </div>
            <div className="flex-none w-full h-full snap-center">
              <img
                className="w-full h-full object-cover"
                alt=""
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuA0Bb4TiEMhFu_jFB3oQAja-g8uRg-Zz1sLpu7c4fSkP2N84lZ9HTz6E6Ww9YSJLggn1Mbtb2g83NgnyfF4Bzh_kYvwTZxIEThZKFG_vhD5nhtNPPcuiol1WbEG2KYT5_t1c6wHw4hMXHpoMK-Jqso0kUYE7LVrMBYR8Mt2QX4zfsmpxfuH3UlERmTD3DWrOuzs0HkeD8aQ8X9GGMYHU5lyCBjRsf8hWCpg3xFu-FAEcOoqMQ_jpIII1Hk7pDkevvigcSHoGxEPy-M"
              />
            </div>
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            <div className="w-8 h-1 rounded-full bg-white"></div>
            <div className="w-2 h-1 rounded-full bg-white/40"></div>
            <div className="w-2 h-1 rounded-full bg-white/40"></div>
          </div>
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            <span className="px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-caption font-bold shadow-sm">
              Verified
            </span>
            <span className="px-3 py-1 rounded-full bg-tertiary-container text-on-tertiary-container text-caption font-bold shadow-sm">
              Matching
            </span>
          </div>
        </section>
        <div className="px-margin-mobile -mt-6 relative z-10">
          <div className="bg-surface-container-lowest rounded-xl p-lg shadow-sm border border-outline-variant/30">
            <div className="flex justify-between items-start mb-sm">
              <div>
                <h2 className="font-h1 text-h1 text-on-surface">Silver MacBook Pro</h2>
                <div className="flex items-center gap-1 text-on-surface-variant mt-1">
                  <span className="material-symbols-outlined text-[18px]">location_on</span>
                  <span className="font-label-sm">Grand Central, NY</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-caption text-on-surface-variant">Found on</span>
                <span className="font-h3 text-primary">Oct 24, 2023</span>
              </div>
            </div>
            <div className="mt-lg p-md rounded-lg bg-primary-fixed/10 border border-primary-fixed-dim/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-fixed-dim flex items-center justify-center">
                  <span
                    className="material-symbols-outlined text-on-primary-container"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    auto_awesome
                  </span>
                </div>
                <div>
                  <p className="font-label-sm text-on-surface">AI Match Confidence</p>
                  <p className="font-h3 text-primary-container">98% Match</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-primary-fixed-dim">verified</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-md mt-lg">
            <div className="col-span-2 bg-surface-container-low rounded-xl p-md border border-outline-variant/20">
              <h3 className="font-h3 text-h3 mb-sm">Description</h3>
              <p className="text-on-surface-variant font-body-md leading-relaxed">
                Found near the main information kiosk. The laptop is a silver 14-inch model in a gray protective sleeve. No
                visible external damage. It appears to be a recent model with M2 chip.
              </p>
              <div className="mt-md flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-surface-variant text-on-surface-variant text-caption">Electronics</span>
                <span className="px-3 py-1 rounded-full bg-surface-variant text-on-surface-variant text-caption">Apple</span>
                <span className="px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant text-caption">Urgent</span>
              </div>
            </div>
            <div className="col-span-2 bg-surface-container-lowest rounded-xl p-md flex items-center justify-between border border-outline-variant/30 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-secondary-container">
                  <img
                    className="w-full h-full object-cover"
                    alt=""
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCZxIAjK2iuxJMwKQQq44TmWSvVh3b21vOHebjWziaXyL6Sf1W7jYm8hI9bsYt2SfERL8Kmh5ZStW9LXWvSpqSpbX9-VgmH-T4vBK-mL9oeb9KCqryEzATDMLoKtvMJhIMTXvnTGmy_gcueVj3_6Rt6GG6e4GrgJSvuYVBFVii2kNMaNzwY5LZObishJGG7ln-6aAUnJto8UHYmPO1rMkSF4qUDeeu4xJOhb1psePYnNKwfWe_Z-5bTUDLHVboJgxvgWRS1wkYQ750"
                  />
                </div>
                <div>
                  <p className="text-caption text-on-surface-variant uppercase tracking-wider">Finder</p>
                  <h4 className="font-h3 text-on-surface">Marcus Chen</h4>
                  <div className="flex items-center gap-1 text-tertiary">
                    <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      star
                    </span>
                    <span className="font-label-sm">4.9 Stewardship Rating</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="w-12 h-12 rounded-full bg-secondary-fixed-dim flex items-center justify-center active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-on-secondary-fixed">chat_bubble</span>
              </button>
            </div>
            <div className="col-span-2 h-40 rounded-xl overflow-hidden relative border border-outline-variant/30">
              <img
                className="w-full h-full object-cover"
                alt=""
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBRbJMKN0BQNUXcQYFYoZfFEkVsJMlOHjfZ7GPiPmLmd0OjqCH4YXExjPMPUp-2QTc8k9rLaC-Pxopdua6RahBoT1jAudOoOvXwEaGeyEBOn-ZtiRcGjFUe1ONrPLXXT2UGjalcKZMkmSr4o1SARSGvbLnqheIytKaeeunVGyEQW8rw3wY54Md8OIpqR3yrvq-GNkusbh4yVnhMs6qxGPh3N3QF450CccGdGYFjHaSmRyUcf96KVH16BOYWeOIz53hjiBQkeODdpOI"
              />
              <div className="absolute inset-0 bg-primary/10 pointer-events-none"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center shadow-lg animate-pulse">
                  <span className="material-symbols-outlined">location_on</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <footer className="fixed bottom-0 left-0 w-full z-50 bg-surface/70 backdrop-blur-xl border-t border-outline-variant/20 px-margin-mobile py-4 pb-safe flex items-center gap-4">
        <button
          type="button"
          className="flex-none w-14 h-14 rounded-xl bg-surface-container-highest flex items-center justify-center text-on-surface-variant active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined">bookmark</span>
        </button>
        <button
          type="button"
          className="flex-1 h-14 bg-primary text-on-primary rounded-xl font-h3 flex items-center justify-center gap-3 shadow-lg active:scale-98 transition-all duration-200"
        >
          <span className="material-symbols-outlined">verified_user</span>
          Claim This Item
        </button>
      </footer>
    </div>
  );
}
