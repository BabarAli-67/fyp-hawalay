import { toast } from 'react-toastify';
import { usePwaInstall } from '../../context/PwaInstallContext.jsx';

const ICON_BTN =
  'w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors active:scale-95 duration-200';

const PILL_BTN =
  'flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-container text-on-primary-container font-label-sm text-label-sm hover:opacity-90 active:scale-95 transition-all shrink-0';

/**
 * Global install control — shown on every page until the app is installed.
 * Uses native prompt when available; otherwise opens platform instructions.
 */
export function InstallAppButton({ variant = 'icon', className = '' }) {
  const { canInstall, install } = usePwaInstall();

  if (!canInstall) return null;

  async function handleClick() {
    const result = await install();
    if (result.outcome === 'accepted') {
      toast.success('Hawalay installed.');
    } else if (result.outcome === 'dismissed') {
      toast.info('Install cancelled — you can install anytime from this button.');
    }
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`${PILL_BTN} ${className}`.trim()}
        aria-label="Install Hawalay app"
      >
        <span className="material-symbols-outlined text-[18px]">download</span>
        Install
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${ICON_BTN} ${className}`.trim()}
      aria-label="Install Hawalay app"
      title="Install app"
    >
      <span className="material-symbols-outlined" data-icon="download">
        download
      </span>
    </button>
  );
}
