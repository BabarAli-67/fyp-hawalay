/**
 * Shown when AI-suggested category differs from the user's manual selection.
 */
export function CategoryMismatchBanner({
  userCategory,
  suggestedCategory,
  detectedClassName,
  onKeepCurrent,
  onUseSuggested,
  compact = false,
}) {
  if (!suggestedCategory || suggestedCategory === userCategory) {
    return null;
  }

  const objectLabel = detectedClassName
    ? detectedClassName.replace(/_/g, ' ')
    : 'this item';

  const isDocumentHint =
    suggestedCategory === 'Documents' &&
    detectedClassName &&
    !detectedClassName.includes('_') &&
    detectedClassName.includes(' ');

  return (
    <div
      className="rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 px-md py-sm space-y-sm"
      role="alert"
    >
      <p className="font-label-sm text-amber-950 dark:text-amber-100">
        {isDocumentHint ? (
          <>
            This looks like an <strong>{objectLabel}</strong>. We suggest category{' '}
            <strong>&quot;{suggestedCategory}&quot;</strong> instead of{' '}
            <strong>&quot;{userCategory}&quot;</strong>.
          </>
        ) : (
          <>
            It looks like you selected the wrong category. We think{' '}
            <strong>{objectLabel}</strong> belongs in{' '}
            <strong>&quot;{suggestedCategory}&quot;</strong>, not{' '}
            <strong>&quot;{userCategory}&quot;</strong>.
          </>
        )}
      </p>
      {!compact ? (
        <p className="font-caption text-amber-900/90 dark:text-amber-200/90">
          Please update the category if you can — otherwise matching and search may miss your
          report.
        </p>
      ) : null}
      <p className="font-caption text-amber-900/80 dark:text-amber-200/80">
        Would you like to update the category?
      </p>
      <div className="flex flex-col sm:flex-row gap-sm">
        <button
          type="button"
          onClick={onKeepCurrent}
          className="flex-1 h-10 rounded-lg border border-amber-600/40 text-amber-950 dark:text-amber-100 font-label-sm hover:bg-amber-100/80 dark:hover:bg-amber-900/40 transition-colors"
        >
          Keep Current Category
        </button>
        <button
          type="button"
          onClick={onUseSuggested}
          className="flex-1 h-10 rounded-lg bg-primary text-on-primary font-label-sm hover:opacity-90 transition-opacity"
        >
          Use Suggested Category
        </button>
      </div>
    </div>
  );
}

/**
 * Persistent reminder after user dismisses the banner but keeps a mismatched category.
 */
export function CategoryMismatchReminder({ userCategory, suggestedCategory, detectedClassName }) {
  if (!suggestedCategory || suggestedCategory === userCategory) {
    return null;
  }

  const objectLabel = detectedClassName
    ? detectedClassName.replace(/_/g, ' ')
    : 'this item';

  return (
    <div
      className="rounded-lg border border-amber-500/30 bg-amber-50/80 dark:bg-amber-950/20 px-md py-sm"
      role="status"
    >
      <p className="font-caption text-amber-950 dark:text-amber-100">
        Category mismatch: you selected <strong>{userCategory}</strong>, but AI detected{' '}
        <strong>{objectLabel}</strong> as <strong>{suggestedCategory}</strong>. Please edit the
        category on step 1 before submitting — otherwise matching and search may miss your item.
      </p>
    </div>
  );
}
