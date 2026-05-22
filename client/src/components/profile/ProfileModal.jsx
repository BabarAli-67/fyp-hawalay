import { useEffect } from 'react';

/**
 * Lightweight modal shell — backdrop click and Escape close.
 */
export function ProfileModal({ title, children, onClose, footer }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-margin-mobile"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl border border-outline-variant/20"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-md py-md border-b border-outline-variant/20 bg-surface/95 backdrop-blur-sm">
          <h2 id="profile-modal-title" className="font-h2 text-h2 text-on-surface">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="px-md py-lg">{children}</div>
        {footer ? (
          <div className="sticky bottom-0 px-md py-md border-t border-outline-variant/20 bg-surface/95 backdrop-blur-sm">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
