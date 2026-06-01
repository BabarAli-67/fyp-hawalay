/**
 * Normalize an offline_queue IndexedDB record for UI display.
 */
export function parseQueueItem(record) {
  let fields = {};
  if (record?.body) {
    try {
      fields = JSON.parse(record.body);
    } catch {
      fields = {};
    }
  }

  const attempts = Number(record?.attempts) || 0;
  const maxAttempts = Number(record?.maxAttempts) || 5;

  const imageBase64 = record?.imageBase64 ?? null;
  const mimeType = record?.mimeType || 'image/jpeg';
  let imageSrc = null;
  if (imageBase64) {
    imageSrc = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:${mimeType};base64,${imageBase64}`;
  }

  return {
    id: record?.id,
    title: fields.title?.trim() || 'Untitled report',
    locationName: fields.locationName?.trim() || 'Location not set',
    reportType: fields.reportType === 'found' ? 'found' : 'lost',
    queuedAt: record?.queuedAt ?? null,
    attempts,
    maxAttempts,
    lastError: record?.lastError ?? null,
    lastAttemptAt: record?.lastAttemptAt ?? null,
    syncFailed: attempts >= maxAttempts,
    imageSrc,
  };
}

export function formatQueuedTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
