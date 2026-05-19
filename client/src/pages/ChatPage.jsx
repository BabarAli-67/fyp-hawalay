import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CHAT_PEER_AVATAR, MOCK_CHAT_MESSAGES } from '../constants/mockData.js';

function formatTime(d) {
  try {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * real_time_chat.html — full-screen chat header, thread, sticky composer (no Socket.io).
 */
export default function ChatPage() {
  const { id } = useParams();
  const [messages, setMessages] = useState(() => MOCK_CHAT_MESSAGES.map((m) => ({ ...m })));
  const [draft, setDraft] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  function handleSend(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { _id: `local-${Date.now()}`, senderId: 'me', text, createdAt: new Date() },
    ]);
    setDraft('');
  }

  return (
    <div key={id} className="bg-surface text-on-surface font-body-md selection:bg-primary-container min-h-screen flex flex-col">
      <header className="fixed top-0 left-0 w-full z-50 flex items-center px-margin-mobile h-16 bg-surface/70 dark:bg-inverse-surface/70 glass-header shadow-sm border-b border-outline-variant/20">
        <div className="flex items-center gap-3 w-full">
          <Link
            to="/dashboard"
            className="active:scale-95 transition-transform duration-200 text-on-surface-variant"
            aria-label="Back"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="relative">
            <img
              alt="David Miller"
              className="w-10 h-10 rounded-full border-2 border-primary-container object-cover"
              src={CHAT_PEER_AVATAR}
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-primary-fixed-dim border-2 border-surface rounded-full" />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="font-h3 text-label-sm font-bold text-on-surface truncate">David Miller</h3>
            <span className="font-caption text-primary text-[11px] font-semibold uppercase tracking-wider">
              Online
            </span>
          </div>
          <div className="ml-auto flex items-center gap-4 shrink-0">
            <button type="button" className="text-on-surface-variant active:scale-95 transition-transform">
              <span className="material-symbols-outlined">call</span>
            </button>
            <button type="button" className="text-on-surface-variant active:scale-95 transition-transform">
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          </div>
        </div>
      </header>

      <main
        ref={listRef}
        className="flex-1 flex flex-col pt-20 pb-28 px-gutter-mobile min-h-0 overflow-y-auto space-y-lg"
      >
        <div className="flex justify-center">
          <span className="bg-surface-container-high text-on-surface-variant px-3 py-1 rounded-full font-caption text-[11px] font-bold uppercase tracking-widest">
            Today
          </span>
        </div>

        {messages.map((msg) => {
          const mine = msg.senderId === 'me';
          return (
            <div
              key={msg._id}
              className={`flex flex-col max-w-[85%] space-y-1 ${mine ? 'items-end self-end' : 'items-start'}`}
            >
              <div
                className={`p-md rounded-2xl message-shadow ${
                  mine
                    ? 'bg-primary text-on-primary rounded-tr-none'
                    : 'bg-surface-container-highest text-on-surface rounded-tl-none'
                }`}
              >
                <p className="font-body-md">{msg.text}</p>
              </div>
              <div className={`flex items-center gap-1 ${mine ? 'mr-1 justify-end' : 'ml-1'}`}>
                <span className="font-caption text-[10px] text-outline">{formatTime(msg.createdAt)}</span>
                {mine ? (
                  <span
                    className="material-symbols-outlined text-[14px] text-primary-fixed-dim"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    done_all
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}

        <div className="bg-secondary-container/30 border border-secondary-container rounded-xl p-md flex items-start gap-3">
          <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
            verified_user
          </span>
          <div>
            <h4 className="font-label-sm text-on-secondary-container">Safety Verified</h4>
            <p className="font-caption text-on-secondary-container/80">
              Hawalay recommends meeting in public locations for item exchanges.
            </p>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 w-full z-50 p-4 bg-surface/70 glass-header flex flex-col gap-2 border-t border-outline-variant/20">
        <form onSubmit={handleSend} className="flex items-center gap-3">
          <button
            type="button"
            className="w-12 h-12 flex items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant active:scale-95 transition-all"
            aria-label="Attach"
          >
            <span className="material-symbols-outlined">add_circle</span>
          </button>
          <div className="flex-1 relative flex items-center">
            <input
              className="w-full h-12 bg-surface-container-lowest border-none rounded-full px-6 pr-12 text-on-surface placeholder:text-outline-variant focus:ring-2 focus:ring-primary/20 shadow-inner"
              placeholder="Type a message..."
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Message"
            />
            <button
              type="button"
              className="absolute right-4 text-on-surface-variant active:scale-90 transition-transform"
              aria-label="Camera"
            >
              <span className="material-symbols-outlined">photo_camera</span>
            </button>
          </div>
          <button
            type="submit"
            className="w-12 h-12 flex items-center justify-center rounded-full bg-primary text-on-primary shadow-lg shadow-primary/30 active:scale-90 transition-all"
            aria-label="Send"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              send
            </span>
          </button>
        </form>
        <div className="h-safe" />
      </footer>
    </div>
  );
}
