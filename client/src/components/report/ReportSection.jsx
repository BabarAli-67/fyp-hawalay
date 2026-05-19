/**
 * Card wrapper for grouped report form sections (mobile-first Stitch layout).
 */
export function ReportSection({ title, subtitle, children, className = '' }) {
  return (
    <section
      className={`rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-md space-y-md ${className}`.trim()}
    >
      <div>
        <h3 className="font-h3 text-h3 text-on-surface">{title}</h3>
        {subtitle ? <p className="font-caption text-on-surface-variant mt-xs">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
