import { usePwaInstall } from '../../context/PwaInstallContext.jsx';

const OVERLAY = 'fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/40';
const PANEL =
  'w-full max-w-md rounded-2xl bg-surface p-lg shadow-xl border border-outline-variant/30 max-h-[85vh] overflow-y-auto';

function IosSteps() {
  return (
    <ol className="list-decimal list-inside space-y-2 font-body-md text-body-md text-on-surface-variant">
      <li>Tap the <strong className="text-on-surface">Share</strong> button in Safari&apos;s toolbar.</li>
      <li>Scroll down and tap <strong className="text-on-surface">Add to Home Screen</strong>.</li>
      <li>Tap <strong className="text-on-surface">Add</strong> to install Hawalay.</li>
    </ol>
  );
}

function DesktopSteps() {
  return (
    <ol className="list-decimal list-inside space-y-2 font-body-md text-body-md text-on-surface-variant">
      <li>
        Look for the <strong className="text-on-surface">install</strong> icon in your browser&apos;s address bar
        (or open the browser menu).
      </li>
      <li>
        Choose <strong className="text-on-surface">Install Hawalay</strong> or{' '}
        <strong className="text-on-surface">Install app</strong>.
      </li>
      <li>Open Hawalay from your desktop or app launcher.</li>
    </ol>
  );
}

function AndroidSteps() {
  return (
    <ol className="list-decimal list-inside space-y-2 font-body-md text-body-md text-on-surface-variant">
      <li>Open the browser menu (three dots).</li>
      <li>
        Tap <strong className="text-on-surface">Install app</strong> or{' '}
        <strong className="text-on-surface">Add to Home screen</strong>.
      </li>
      <li>Confirm to install Hawalay.</li>
    </ol>
  );
}

function getPlatformSteps(isIosSafari) {
  if (isIosSafari) return { title: 'Install on iPhone or iPad', Steps: IosSteps };
  if (/Android/i.test(navigator.userAgent)) return { title: 'Install on Android', Steps: AndroidSteps };
  return { title: 'Install on desktop', Steps: DesktopSteps };
}

export function InstallInstructionsModal() {
  const { showInstructions, setShowInstructions, isIosSafari } = usePwaInstall();

  if (!showInstructions) return null;

  const { title, Steps } = getPlatformSteps(isIosSafari);

  return (
    <div
      className={OVERLAY}
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-instructions-title"
      onClick={() => setShowInstructions(false)}
    >
      <div className={PANEL} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-md">
          <h2 id="install-instructions-title" className="font-h2 text-h2 text-on-surface">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => setShowInstructions(false)}
            className="w-10 h-10 shrink-0 flex items-center justify-center text-on-surface-variant hover:opacity-80"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant mb-md">
          Install Hawalay for quick access, offline reporting, and automatic sync when you&apos;re back online.
        </p>
        <Steps />
        <button
          type="button"
          onClick={() => setShowInstructions(false)}
          className="mt-lg w-full py-md rounded-full bg-primary text-on-primary font-h3 text-h3 active:scale-95 transition-all"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
