import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const MENU_ITEMS = [
  { id: 'edit', icon: 'edit', label: 'Edit Profile' },
  { id: 'avatar', icon: 'photo_camera', label: 'Change Profile Photo' },
  { id: 'privacy', icon: 'shield', label: 'Privacy', navigateTo: '/privacy' },
  { id: 'logout', icon: 'logout', label: 'Logout', action: 'logout' },
  { id: 'help', icon: 'help', label: 'Help & Support', disabled: true },
];

function MenuItem({ item, onSelect }) {
  const baseClass =
    'w-full flex items-center gap-sm px-md py-sm text-left font-body-md text-on-surface transition-colors min-h-[44px]';
  const enabledClass = 'hover:bg-surface-container-high active:bg-surface-container cursor-pointer';
  const disabledClass = 'opacity-50 cursor-not-allowed';

  const content = (
    <>
      <span className="material-symbols-outlined text-[20px] text-primary shrink-0">{item.icon}</span>
      <span className="truncate">{item.label}</span>
    </>
  );

  if (item.disabled) {
    return (
      <div className={`${baseClass} ${disabledClass}`} role="menuitem" aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      role="menuitem"
      className={`${baseClass} ${enabledClass}`}
      onClick={() => onSelect(item.id)}
    >
      {content}
    </button>
  );
}

/**
 * Profile header settings gear — dropdown for account actions (replaces inline settings list).
 */
export function ProfileSettingsMenu({ user, onOpenModal, onLogoutRequest }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function handleSelect(actionId) {
    setOpen(false);
    const item = MENU_ITEMS.find((row) => row.id === actionId);
    if (!item || item.disabled) return;

    if (item.action === 'logout') {
      onLogoutRequest?.();
      return;
    }

    if (item.navigateTo) {
      navigate(item.navigateTo);
      return;
    }

    onOpenModal?.(actionId);
  }

  const visibleItems = MENU_ITEMS;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-all duration-200 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label="Settings and security"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="material-symbols-outlined text-[24px]">settings</span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            aria-label="Settings and security"
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute right-0 top-[calc(100%+8px)] z-40 w-[min(280px,calc(100vw-40px))] overflow-hidden rounded-xl border border-outline-variant/25 bg-surface-container-lowest shadow-lg py-xs"
          >
            {visibleItems.map((item, index) => (
              <div key={item.id}>
                {index > 0 ? <div className="h-px bg-outline-variant/15 mx-sm" /> : null}
                <MenuItem item={item} onSelect={handleSelect} />
              </div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
