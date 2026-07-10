/** Normalize API item document for ItemCard / profile lists. */
export function mapItemForCard(item) {
  const returnedAt = item.returnedAt ?? item.claimedAt ?? null;

  return {
    _id: item._id,
    title: item.title,
    reportType: item.reportType,
    category: item.category,
    locationName: item.locationName,
    date: item.date ? new Date(item.date).toISOString().slice(0, 10) : '',
    status: item.status ?? 'active',
    hasImage: Boolean(item.imageFileId),
    returnedAt: returnedAt ? new Date(returnedAt).toISOString() : null,
  };
}

/** Human-readable date for card rows. */
export function formatCardDate(value) {
  if (!value) return '—';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function computeProfileStats(items) {
  let lost = 0;
  let found = 0;
  let returns = 0;
  for (const item of items) {
    if (item.reportType === 'lost') lost += 1;
    if (item.reportType === 'found') found += 1;
    if (item.status === 'claimed' || item.status === 'returned') returns += 1;
  }
  return { lost, found, returns };
}
