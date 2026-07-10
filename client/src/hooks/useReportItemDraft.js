import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearReportItemDraft,
  formatDraftSavedAt,
  loadReportItemDraft,
  saveReportItemDraft,
} from '../utils/reportItemDraft.js';

const SAVE_DEBOUNCE_MS = 600;

/**
 * Auto-save and restore the Report Item form draft (IndexedDB-backed).
 *
 * @param {object} options
 * @param {string | undefined | null} options.userId
 * @param {object} options.formSnapshot Serializable form fields (no File objects).
 * @param {File | null} options.imageFile
 * @param {(draft: import('../utils/reportItemDraft.js').ReportItemDraftRecord) => { hadLocation?: boolean, imageRestoreFailed?: boolean }} options.onRestore
 * @param {boolean} [options.isBlocked] Skip saves while submitting or analyzing.
 */
export function useReportItemDraft({ userId, formSnapshot, imageFile, onRestore, isBlocked = false }) {
  const [draftReady, setDraftReady] = useState(false);
  const [draftHadLocation, setDraftHadLocation] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [draftSavedLabel, setDraftSavedLabel] = useState(null);
  const [imageRestoreNotice, setImageRestoreNotice] = useState(null);

  const skipSaveRef = useRef(true);
  const onRestoreRef = useRef(onRestore);

  useEffect(() => {
    onRestoreRef.current = onRestore;
  }, [onRestore]);

  useEffect(() => {
    if (!userId) {
      setDraftReady(true);
      return undefined;
    }

    let cancelled = false;

    (async () => {
      const draft = await loadReportItemDraft(userId);
      if (cancelled) return;

      if (draft?.form) {
        const result = onRestoreRef.current(draft) ?? {};
        const hadLocation = Boolean(
          result.hadLocation ?? draft.form.locationCoordinates?.length === 2,
        );
        setDraftHadLocation(hadLocation);

        const imageMissing = Boolean(draft.hadImage && !draft.imageBlob);
        if (result.imageRestoreFailed || imageMissing || draft.imageOmitted) {
          setImageRestoreNotice(
            'Your photo could not be restored. Please upload it again to run AI analysis.',
          );
        }

        setLastSavedAt(draft.savedAt ?? null);
        setDraftSavedLabel(formatDraftSavedAt(draft.savedAt));
      }

      skipSaveRef.current = false;
      setDraftReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!lastSavedAt) return undefined;

    setDraftSavedLabel(formatDraftSavedAt(lastSavedAt));
    const intervalId = window.setInterval(() => {
      setDraftSavedLabel(formatDraftSavedAt(lastSavedAt));
    }, 15_000);

    return () => window.clearInterval(intervalId);
  }, [lastSavedAt]);

  useEffect(() => {
    if (!userId || !draftReady || skipSaveRef.current || isBlocked) return undefined;

    const timer = window.setTimeout(async () => {
      const saved = await saveReportItemDraft(userId, formSnapshot, imageFile);
      if (saved) {
        const now = Date.now();
        setLastSavedAt(now);
        setDraftSavedLabel(formatDraftSavedAt(now));
      }
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [userId, draftReady, isBlocked, formSnapshot, imageFile]);

  const clearDraft = useCallback(async () => {
    skipSaveRef.current = true;
    await clearReportItemDraft(userId);
    setLastSavedAt(null);
    setDraftSavedLabel(null);
    setImageRestoreNotice(null);
    skipSaveRef.current = false;
  }, [userId]);

  return {
    draftReady,
    draftHadLocation,
    lastSavedAt,
    draftSavedLabel,
    imageRestoreNotice,
    clearDraft,
  };
}
