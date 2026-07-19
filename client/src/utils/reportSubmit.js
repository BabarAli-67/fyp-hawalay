import axiosInstance from '../api/axiosInstance.js';
import { addToQueue } from './indexedDB.js';

export function isValidGeoCoordinates(coords) {
  return (
    Array.isArray(coords) &&
    coords.length === 2 &&
    coords.every((n) => Number.isFinite(Number(n)))
  );
}

export function resolveCoordinates() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not read image file'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Append optional report fields for POST /api/items (wizard + single-page forms).
 */
export function appendExtendedReportFields(target, fields) {
  const {
    brand,
    colors,
    distinctiveFeatures,
    contactPreference,
    secondaryCoordinates,
    secondaryLocationName,
    description,
    caption,
    ocrText,
    embeddingVector,
    analyzeSnapshot,
    descriptionMode,
    aiDescription,
    distinctiveFeaturesMode,
    aiDistinctiveFeatures,
    userCategory,
  } = fields;

  if (brand?.trim()) target.brand = brand.trim();
  if (colors?.length) target.colors = JSON.stringify(colors);
  const effectiveFeatures =
    distinctiveFeaturesMode === 'ai' && aiDistinctiveFeatures?.trim()
      ? aiDistinctiveFeatures.trim()
      : distinctiveFeatures?.trim();
  if (effectiveFeatures) target.distinctiveFeatures = effectiveFeatures;
  if (contactPreference) target.contactPreference = contactPreference;
  if (isValidGeoCoordinates(secondaryCoordinates)) {
    target.secondaryLocation = JSON.stringify({
      type: 'Point',
      coordinates: [Number(secondaryCoordinates[0]), Number(secondaryCoordinates[1])],
    });
    if (secondaryLocationName?.trim()) {
      target.secondaryLocationName = secondaryLocationName.trim();
    }
  }
  const effectiveDescription =
    descriptionMode === 'ai' && aiDescription?.trim() ? aiDescription.trim() : description?.trim();
  if (effectiveDescription) target.description = effectiveDescription;
  if (caption?.trim()) target.caption = caption.trim();
  if (ocrText?.trim()) target.ocrText = ocrText.trim();
  if (embeddingVector) target.embeddingVector = JSON.stringify(embeddingVector);
  if (analyzeSnapshot?.raw) {
    target.analyzeResult = JSON.stringify(analyzeSnapshot.raw);
  }
  if (userCategory?.trim()) {
    target.userCategory = userCategory.trim();
  }
}

export function appendToFormData(formData, obj) {
  for (const [key, value] of Object.entries(obj)) {
    if (value != null && value !== '') formData.append(key, value);
  }
}

const LOCATION_REQUIRED_MESSAGE =
  'Tap the map to pin a location or allow location access when prompted.';

/**
 * Submit a lost/found report online or queue offline (same contract as service worker replay).
 */
export async function submitItemReport({
  reportType,
  title,
  category,
  locationName,
  date,
  locationCoordinates,
  secondaryLocationCoordinates,
  secondaryLocationName,
  imageFile,
  extended,
  isOnline,
}) {
  let coordinates = locationCoordinates;
  if (!isValidGeoCoordinates(coordinates)) {
    coordinates = await resolveCoordinates();
  }
  if (!isValidGeoCoordinates(coordinates)) {
    return {
      ok: false,
      fieldErrors: { locationName: LOCATION_REQUIRED_MESSAGE },
    };
  }

  const coreFields = {
    reportType,
    title: String(title).trim(),
    category,
    locationName: String(locationName).trim(),
    date,
    location: JSON.stringify({ type: 'Point', coordinates }),
  };

  if (!isOnline) {
    let imageBase64 = null;
    let mimeType = null;
    let filename = null;
    if (imageFile) {
      imageBase64 = await fileToBase64(imageFile);
      mimeType = imageFile.type;
      filename = imageFile.name;
    }

    const allFields = { ...coreFields };
    appendExtendedReportFields(allFields, {
      ...extended,
      secondaryCoordinates: secondaryLocationCoordinates,
      secondaryLocationName,
    });

    const token = localStorage.getItem('auth_token');
    const apiBase = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
    const endpoint = apiBase ? `${apiBase}/api/items` : '/api/items';
    await addToQueue({
      id: crypto.randomUUID(),
      endpoint,
      method: 'POST',
      authHeader: token ? `Bearer ${token}` : '',
      body: JSON.stringify(allFields),
      imageBase64,
      mimeType,
      filename,
      queuedAt: Date.now(),
      attempts: 0,
    });

    // Queue persistence is the success condition. Do not hold the form open
    // while waiting for serviceWorker.ready, which may stay pending offline.
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.ready
        .then((registration) => registration.sync?.register?.('sync-lost-found-items'))
        .catch(() => {
          // Background Sync or SW not available yet; the online listener retries.
        });
    }

    return { ok: true, offline: true };
  }

  const formFields = { ...coreFields };
  appendExtendedReportFields(formFields, {
    ...extended,
    secondaryCoordinates: secondaryLocationCoordinates,
    secondaryLocationName,
  });

  const formData = new FormData();
  appendToFormData(formData, formFields);
  if (imageFile) formData.append('image', imageFile);

  const { data } = await axiosInstance.post('/api/items', formData);
  return { ok: true, itemId: data.itemId };
}

export function mapSubmitError(err) {
  const body = err?.response?.data;
  if (body?.errors && Array.isArray(body.errors)) {
    const fieldErrors = {};
    for (const item of body.errors) {
      if (item?.field) fieldErrors[item.field] = item.message;
    }
    return { fieldErrors, genericError: null };
  }
  return {
    fieldErrors: null,
    genericError:
      typeof body?.error === 'string' ? body.error : 'Could not submit report. Please try again.',
  };
}
