function StatCell({ label, value, loading }) {
  return (
    <div className="rounded-xl bg-surface-container-lowest border border-outline-variant/20 px-md py-sm text-center min-w-0">
      <p className="font-h2 text-h2 text-primary tabular-nums leading-none mb-1">
        {loading ? '—' : value.toLocaleString()}
      </p>
      <p className="font-caption text-caption text-on-surface-variant leading-tight">{label}</p>
    </div>
  );
}

export function CommunityImpactCard({ stats, loading, error, onRetry }) {
  return (
    <section
      className="w-full rounded-2xl border border-primary/15 bg-gradient-to-br from-primary-container/10 to-surface-container-low p-md md:p-lg shadow-sm"
      aria-labelledby="community-impact-heading"
    >
      <div className="flex items-center gap-sm mb-md">
        <span
          className="material-symbols-outlined text-primary text-[22px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
          aria-hidden
        >
          public
        </span>
        <h3 id="community-impact-heading" className="font-h3 text-h3 text-on-surface">
          Community Impact
        </h3>
      </div>

      {error ? (
        <div className="text-center py-sm">
          <p className="font-body-md text-on-surface-variant mb-sm">{error}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="font-label-sm text-primary hover:underline"
            >
              Try again
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-sm md:gap-md">
            <StatCell label="Items Lost" value={stats.itemsLost} loading={loading} />
            <StatCell label="Items Found" value={stats.itemsFound} loading={loading} />
            <StatCell label="Items Reunited" value={stats.itemsReunited} loading={loading} />
            <StatCell label="Active Helpers" value={stats.activeHelpers} loading={loading} />
          </div>
          <p className="text-center font-body-md text-on-surface-variant pt-md md:pt-lg px-sm">
            Together, we&apos;re making a difference! 💚
          </p>
        </>
      )}
    </section>
  );
}
