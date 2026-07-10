/**
 * Non-blocking AI error banner — user can continue filling the form manually.
 */
export function AiErrorBanner({ message, onDismiss }) {
  if (!message) return null;

  return (
    <div
      className="rounded-xl border border-outline-variant/30 bg-error-container/40 px-md py-md space-y-sm"
      role="alert"
    >
      <div className="flex items-start gap-sm">
        <span className="material-symbols-outlined text-error shrink-0 text-[22px]">error</span>
        <div className="flex-1 min-w-0">
          <p className="font-label-sm text-on-error-container">AI analysis issue</p>
          <p className="font-body-md text-on-error-container mt-xs">{message}</p>
          <p className="font-caption text-on-error-container/90 mt-sm">
            You can edit all fields below manually or upload a different photo to try again.
          </p>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-on-error-container/80 hover:text-on-error-container p-xs"
            aria-label="Dismiss AI error"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
