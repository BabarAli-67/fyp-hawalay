import { Link } from 'react-router-dom';

export function SettingsRow({ icon, label, onClick, to, disabled = false }) {
  const className = `w-full flex items-center justify-between p-md transition-colors active:scale-[0.99] ${
    disabled
      ? 'opacity-60 cursor-not-allowed'
      : 'hover:bg-surface-container cursor-pointer'
  }`;

  const content = (
    <>
      <div className="flex items-center gap-md">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        <span className="font-body-lg text-body-lg text-on-surface">{label}</span>
      </div>
      <span className="material-symbols-outlined text-outline">chevron_right</span>
    </>
  );

  if (to && !disabled) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled} aria-disabled={disabled}>
      {content}
    </button>
  );
}
