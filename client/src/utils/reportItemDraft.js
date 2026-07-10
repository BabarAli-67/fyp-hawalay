import { DRAFT_STORE_NAME, openDB } from './indexedDB.js';

/**
 * @typedef {object} ReportItemDraftForm
 * @property {string} reportType
 * @property {string} title
 * @property {string} brand
 * @property {string} category
 * @property {string} userSelectedCategory
 * @property {boolean} categoryMismatchAcknowledged
 * @property {string} condition
 * @property {string} date
 * @property {string} description
 * @property {string[]} featureChips
 * @property {string} locationName
 * @property {[number, number] | null} locationCoordinates
 * @property {string} secondaryLocationName
 * @property {[number, number] | null} secondaryLocationCoordinates
 * @property {boolean} showSecondaryLocation
 * @property {object | null} analyzeSnapshot
 * @property {number[] | null} embeddingVector
 * @property {boolean | null} embeddingAvailable
 * @property {string | null} ocrError
 * @property {string | null} aiInfoMessage
 * @property {boolean} aiAutofillApplied
 * @property {{ titleEdited: boolean, brandEdited: boolean, categoryEdited: boolean, conditionEdited: boolean, descriptionEdited: boolean, featuresEdited: boolean }} editedFlags
 */

/**
 * @typedef {object} ReportItemDraftRecord
 * @property {string} userId
 * @property {number} savedAt
 * @property {ReportItemDraftForm} form
 * @property {Blob | null} [imageBlob]
 * @property {string | null} [imageFilename]
 * @property {string | null} [imageMimeType]
 * @property {boolean} [hadImage]
 * @property {boolean} [imageOmitted]
 */

/**
 * @param {string | undefined | null} userId
 * @returns {Promise<ReportItemDraftRecord | null>}
 */
export async function loadReportItemDraft(userId) {
  if (!userId) return null;

  try {
    const db = await openDB();
    const record = await db.get(DRAFT_STORE_NAME, userId);
    return record ?? null;
  } catch {
    return null;
  }
}

/**
 * @param {string} userId
 * @param {ReportItemDraftForm} form
 * @param {File | null} imageFile
 * @returns {Promise<boolean>}
 */
export async function saveReportItemDraft(userId, form, imageFile) {
  if (!userId) return false;

  const baseRecord = {
    userId,
    savedAt: Date.now(),
    form,
    hadImage: Boolean(imageFile),
    imageBlob: imageFile ?? null,
    imageFilename: imageFile?.name ?? null,
    imageMimeType: imageFile?.type ?? null,
    imageOmitted: false,
  };

  try {
    const db = await openDB();
    await db.put(DRAFT_STORE_NAME, baseRecord);
    return true;
  } catch {
    if (!imageFile) return false;

    try {
      const db = await openDB();
      await db.put(DRAFT_STORE_NAME, {
        ...baseRecord,
        imageBlob: null,
        imageFilename: null,
        imageMimeType: null,
        imageOmitted: true,
      });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * @param {string | undefined | null} userId
 */
export async function clearReportItemDraft(userId) {
  if (!userId) return;

  try {
    const db = await openDB();
    await db.delete(DRAFT_STORE_NAME, userId);
  } catch {
    // Non-fatal — draft may already be gone.
  }
}

/**
 * @param {number | null | undefined} timestamp
 * @returns {string | null}
 */
export function formatDraftSavedAt(timestamp) {
  if (!timestamp) return null;

  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 10) return 'Draft saved just now';
  if (seconds < 60) return 'Draft saved a few seconds ago';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `Draft saved ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  return 'Draft saved';
}
