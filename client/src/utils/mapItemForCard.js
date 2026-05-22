const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/** Normalize API item document for ItemCard / profile lists. */
export function mapItemForCard(item) {
  return {
    _id: item._id,
    title: item.title,
    reportType: item.reportType,
    category: item.category,
    locationName: item.locationName,
    date: item.date ? new Date(item.date).toISOString().slice(0, 10) : '',
    status: item.status ?? 'active',
    imageUrl:
      item.imageFileId && API_BASE ? `${API_BASE}/api/items/${item._id}/image` : null,
  };
}

export function computeProfileStats(items) {
  let lost = 0;
  let found = 0;
  let returns = 0;
  for (const item of items) {
    if (item.reportType === 'lost') lost += 1;
    if (item.reportType === 'found') found += 1;
    if (item.status === 'claimed') returns += 1;
  }
  return { lost, found, returns };
}
