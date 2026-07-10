export function MatchCardSkeleton() {
  return (
    <div
      className="animate-pulse bg-surface-container-lowest rounded-xl premium-shadow overflow-hidden"
      role="status"
      aria-label="Loading match"
    >
      <div className="h-48 w-full bg-surface-container" />
      <div className="p-md space-y-2">
        <div className="h-5 w-2/3 rounded bg-surface-container" />
        <div className="h-3 w-1/2 rounded bg-surface-container" />
        <div className="h-3 w-3/4 rounded bg-surface-container" />
      </div>
    </div>
  );
}
