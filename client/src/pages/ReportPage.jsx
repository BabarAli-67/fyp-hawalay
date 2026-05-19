import { useCallback, useEffect, useId, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axiosInstance from '../api/axiosInstance.js';
import { Logo } from '../components/Logo.jsx';
import { AiPipelinePanel } from '../components/report/AiPipelinePanel.jsx';
import { ColorTagInput } from '../components/report/ColorTagInput.jsx';
import { LocationFieldGroup } from '../components/report/LocationFieldGroup.jsx';
import { ModeToggle } from '../components/report/ModeToggle.jsx';
import { ReportSection } from '../components/report/ReportSection.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { useOfflineQueue } from '../hooks/useOfflineQueue.js';
import { addToQueue } from '../utils/indexedDB.js';
import { formatCoordinatesLabel, reverseGeocodeCoordinates } from '../utils/reverseGeocode.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);

const CATEGORIES = [
  { value: 'Electronics', label: 'Electronics' },
  { value: 'Clothing', label: 'Clothing' },
  { value: 'Documents', label: 'Documents' },
  { value: 'Accessories', label: 'Accessories' },
  { value: 'Other', label: 'Other' },
];

const BRAND_SUGGESTIONS = ['Apple', 'Samsung', 'Nike', 'Lenovo', 'Sony', 'HP', 'Dell', 'Adidas'];

const DESCRIPTION_MODES = [
  { value: 'manual', label: 'Write yourself' },
  { value: 'ai', label: 'Generate from image' },
];

const FEATURES_MODES = [
  { value: 'manual', label: 'Write yourself' },
  { value: 'ai', label: 'Extract from image (Coming Soon)' },
];

function getDefaultDate() {
  return new Date().toISOString().slice(0, 10);
}

function resolveCoordinates() {
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

/** Pin on map + fill location name from reverse geocode (or coordinate fallback). */
async function applyGeolocationToLocation(coords, setCoordinates, setLocationName) {
  setCoordinates(coords);
  setLocationName('Finding address…');

  const placeName = await reverseGeocodeCoordinates(coords);
  if (placeName) {
    setLocationName(placeName);
    return;
  }
  setLocationName(formatCoordinatesLabel(coords));
}

function fileToBase64(file) {
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

/** Shared fields for online FormData and offline queue JSON. */
function appendExtendedReportFields(target, fields) {
  const {
    brand,
    colors,
    distinctiveFeatures,
    contactPreference,
    secondaryCoordinates,
    secondaryLocationName,
    description,
    embeddingVector,
  } = fields;

  if (brand?.trim()) target.brand = brand.trim();
  if (colors?.length) target.colors = JSON.stringify(colors);
  if (distinctiveFeatures?.trim()) target.distinctiveFeatures = distinctiveFeatures.trim();
  if (contactPreference) target.contactPreference = contactPreference;
  if (secondaryCoordinates) {
    target.secondaryLocation = JSON.stringify({
      type: 'Point',
      coordinates: secondaryCoordinates,
    });
    if (secondaryLocationName?.trim()) {
      target.secondaryLocationName = secondaryLocationName.trim();
    }
  }
  if (description?.trim()) target.description = description.trim();
  if (embeddingVector) target.embeddingVector = JSON.stringify(embeddingVector);
}

function appendToFormData(formData, obj) {
  for (const [key, value] of Object.entries(obj)) {
    if (value != null && value !== '') formData.append(key, value);
  }
}

/**
 * report_lost_item.html — report form wired to POST /api/items.
 */
export default function ReportPage() {
  const formId = useId();
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const initialReportType = routeLocation.state?.reportType === 'found' ? 'found' : 'lost';

  const [reportType, setReportType] = useState(initialReportType);
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [colors, setColors] = useState([]);
  const [category, setCategory] = useState('Electronics');
  const [locationName, setLocationName] = useState('');
  const [locationCoordinates, setLocationCoordinates] = useState(null);
  const [secondaryLocationName, setSecondaryLocationName] = useState('');
  const [secondaryLocationCoordinates, setSecondaryLocationCoordinates] = useState(null);
  const [date, setDate] = useState(() => getDefaultDate());
  const [description, setDescription] = useState('');
  const [descriptionMode, setDescriptionMode] = useState('manual');
  const [distinctiveFeatures, setDistinctiveFeatures] = useState('');
  const [distinctiveFeaturesMode, setDistinctiveFeaturesMode] = useState('manual');
  const [contactPreference, setContactPreference] = useState('in_app_chat');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [embeddingVector, setEmbeddingVector] = useState(null);
  const [captionFromAi, setCaptionFromAi] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [genericError, setGenericError] = useState(null);
  const [aiInfoMessage, setAiInfoMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isLocatingPrimary, setIsLocatingPrimary] = useState(false);
  const [isLocatingSecondary, setIsLocatingSecondary] = useState(false);
  const { isOnline } = useOfflineQueue();

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handlePrimaryMapSelect = useCallback(({ coordinates }) => {
    setLocationCoordinates(coordinates);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.locationName;
      return next;
    });
  }, []);

  const handleSecondaryMapSelect = useCallback(({ coordinates }) => {
    setSecondaryLocationCoordinates(coordinates);
  }, []);

  async function handlePrimaryUseMyLocation() {
    setIsLocatingPrimary(true);
    try {
      const coords = await resolveCoordinates();
      if (!coords) {
        setFieldErrors((prev) => ({
          ...prev,
          locationName:
            'Could not access device location. Allow location in your browser, use HTTPS or localhost, then try again.',
        }));
        return;
      }
      await applyGeolocationToLocation(coords, setLocationCoordinates, setLocationName);
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.locationName;
        return next;
      });
    } finally {
      setIsLocatingPrimary(false);
    }
  }

  async function handleSecondaryUseMyLocation() {
    setIsLocatingSecondary(true);
    try {
      const coords = await resolveCoordinates();
      if (!coords) {
        toast.warn('Could not access device location for secondary pin.');
        return;
      }
      await applyGeolocationToLocation(
        coords,
        setSecondaryLocationCoordinates,
        setSecondaryLocationName,
      );
    } finally {
      setIsLocatingSecondary(false);
    }
  }

  async function processImageWithAi(file) {
    const formData = new FormData();
    formData.append('image', file);
    const { data } = await axiosInstance.post('/api/items/process-image', formData);
    return data;
  }

  async function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.image;
      return next;
    });
    setAiInfoMessage(null);
    setCaptionFromAi(false);

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setFieldErrors((prev) => ({ ...prev, image: 'Only JPEG and PNG images are allowed.' }));
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setFieldErrors((prev) => ({ ...prev, image: 'Image must be smaller than 5MB.' }));
      return;
    }

    setImageFile(file);
    setImagePreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });

    setIsProcessingImage(true);
    try {
      const data = await processImageWithAi(file);
      // TODO: When full AI stack is live, respect descriptionMode === 'ai' only for auto-fill.
      if (data?.caption) {
        setDescription(String(data.caption));
        setCaptionFromAi(true);
      }
      if (Array.isArray(data?.embedding_vector)) {
        setEmbeddingVector(data.embedding_vector);
      } else if (Array.isArray(data?.embeddingVector)) {
        setEmbeddingVector(data.embeddingVector);
      }
    } catch (err) {
      const body = err?.response?.data;
      const status = err?.response?.status;
      if (status === 503 && body?.fallback) {
        setAiInfoMessage(
          descriptionMode === 'ai'
            ? 'AI caption generation coming soon — describe manually'
            : 'AI unavailable — describe manually',
        );
      } else if (typeof body?.error === 'string') {
        setFieldErrors((prev) => ({ ...prev, image: body.error }));
      } else {
        setFieldErrors((prev) => ({
          ...prev,
          image: 'Could not process image. You can still describe the item manually.',
        }));
      }
    } finally {
      setIsProcessingImage(false);
    }
  }

  function validateForm() {
    const next = {};
    if (!title.trim()) next.title = 'Title is required';
    if (!category) next.category = 'Category is required';
    if (!locationName.trim()) next.locationName = 'Location name is required';
    if (!date) next.date = 'Date is required';
    if (!reportType) next.reportType = 'Report type is required';
    return next;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setGenericError(null);

    const nextErrors = validateForm();
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});

    let coordinates = locationCoordinates;
    if (!coordinates) {
      coordinates = await resolveCoordinates();
    }
    if (!coordinates) {
      setFieldErrors({
        locationName: 'Tap the map to pin a location, use “My location”, or allow location on submit.',
      });
      return;
    }

    setIsSubmitting(true);

    const extended = {
      brand,
      colors,
      distinctiveFeatures,
      contactPreference,
      secondaryCoordinates: secondaryLocationCoordinates,
      secondaryLocationName,
      description,
      embeddingVector,
    };

    try {
      if (!isOnline) {
        let imageBase64 = null;
        let mimeType = null;
        let filename = null;
        if (imageFile) {
          imageBase64 = await fileToBase64(imageFile);
          mimeType = imageFile.type;
          filename = imageFile.name;
        }

        const allFields = {
          reportType,
          title: title.trim(),
          category,
          locationName: locationName.trim(),
          date,
          location: JSON.stringify({ type: 'Point', coordinates }),
        };
        appendExtendedReportFields(allFields, extended);

        const token = localStorage.getItem('auth_token');
        await addToQueue({
          id: crypto.randomUUID(),
          endpoint: '/api/items',
          method: 'POST',
          authHeader: token ? `Bearer ${token}` : '',
          body: JSON.stringify(allFields),
          imageBase64,
          mimeType,
          filename,
          queuedAt: Date.now(),
          attempts: 0,
        });

        try {
          const registration = await navigator.serviceWorker.ready;
          await registration.sync.register('sync-lost-found-items');
        } catch {
          // Background Sync or SW not available yet (Flow 6)
        }

        toast.info("Saved offline. Will submit when you're back online.");
        return;
      }

      const formFields = {
        reportType,
        title: title.trim(),
        category,
        locationName: locationName.trim(),
        date,
        location: JSON.stringify({ type: 'Point', coordinates }),
      };
      appendExtendedReportFields(formFields, extended);

      const formData = new FormData();
      appendToFormData(formData, formFields);
      if (imageFile) formData.append('image', imageFile);

      await axiosInstance.post('/api/items', formData);

      toast.success('Report submitted!');
      navigate('/dashboard');
    } catch (err) {
      const body = err?.response?.data;
      if (body?.errors && Array.isArray(body.errors)) {
        const mapped = {};
        for (const item of body.errors) {
          if (item?.field) mapped[item.field] = item.message;
        }
        setFieldErrors(mapped);
      } else {
        setGenericError(
          typeof body?.error === 'string' ? body.error : 'Could not submit report. Please try again.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const heading = reportType === 'lost' ? 'Report Lost Item' : 'Report Found Item';
  const contactLabel =
    contactPreference === 'show_email'
      ? 'Show my email to matched users'
      : 'In-app chat when available';

  return (
    <div className="bg-background text-on-background min-h-screen pb-32">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile h-16 bg-surface/70 backdrop-blur-lg shadow-sm">
        <Link to="/dashboard" className="active:scale-95 transition-transform duration-200" aria-label="Close">
          <span className="material-symbols-outlined text-on-surface-variant">close</span>
        </Link>
        <div className="flex items-center gap-2">
          <Logo size="sm" />
          <h1 className="font-h2 text-h2 font-bold text-primary">Hawalay</h1>
        </div>
        <div className="w-6" />
      </header>

      <form id={formId} onSubmit={handleSubmit} className="pt-24 px-margin-mobile space-y-lg max-w-2xl mx-auto">
        <div className="mb-md">
          <div className="flex items-center justify-between px-2 mb-xs">
            <span className="text-label-sm font-label-sm text-primary uppercase tracking-widest">Step 1 of 1</span>
            <span className="text-label-sm font-label-sm text-on-surface-variant">Details</span>
          </div>
          <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
            <div className="bg-primary h-full w-full rounded-full transition-all duration-500" />
          </div>
        </div>

        <section>
          <h2 className="font-h1 text-h1 text-on-surface mb-xs">{heading}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Provide as much detail as possible to help our ethical community assist you.
          </p>
        </section>

        {genericError ? (
          <div
            className="rounded-lg border border-outline-variant/30 bg-error-container px-md py-sm"
            role="alert"
          >
            <span className="font-label-sm text-on-error-container">{genericError}</span>
          </div>
        ) : null}

        {aiInfoMessage ? (
          <div
            className="rounded-lg border border-outline-variant/30 bg-primary-container px-md py-sm"
            role="status"
          >
            <span className="font-label-sm text-on-primary-container">{aiInfoMessage}</span>
          </div>
        ) : null}

        <ReportSection title="Basic Information" subtitle="What was lost or found?">
          <div className="space-y-sm">
            <span className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">
              Report type
            </span>
            <div className="flex rounded-xl overflow-hidden border border-outline-variant bg-surface-container-low">
              <button
                type="button"
                onClick={() => setReportType('lost')}
                className={`flex-1 py-sm font-label-sm transition-colors ${
                  reportType === 'lost'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                Lost
              </button>
              <button
                type="button"
                onClick={() => setReportType('found')}
                className={`flex-1 py-sm font-label-sm transition-colors ${
                  reportType === 'found'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                Found
              </button>
            </div>
            <p className={`font-caption text-error ${fieldErrors.reportType ? '' : 'hidden'}`} role="status">
              {fieldErrors.reportType}
            </p>
          </div>

          <div className="flex items-center justify-between gap-sm">
            <span className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">
              Item status
            </span>
            <span
              className="inline-flex items-center px-sm py-xs rounded-full bg-tertiary-container text-on-tertiary-container font-label-sm capitalize"
              aria-readonly="true"
            >
              active
            </span>
          </div>

          <div className="relative">
            <input
              className="peer w-full h-14 pt-4 px-md bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg transition-all outline-none"
              id={`${formId}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder=" "
              autoComplete="off"
            />
            <label
              className="absolute left-md top-4 text-body-md text-on-surface-variant peer-focus:top-1 peer-focus:text-caption peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:text-caption transition-all"
              htmlFor={`${formId}-title`}
            >
              Title
            </label>
            <p className={`mt-1 font-caption text-error ${fieldErrors.title ? '' : 'hidden'}`} role="status">
              {fieldErrors.title}
            </p>
          </div>

          <div className="relative">
            <input
              className="peer w-full h-14 pt-4 px-md bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg transition-all outline-none"
              id={`${formId}-brand`}
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder=" "
              list={`${formId}-brand-suggestions`}
              autoComplete="off"
            />
            <datalist id={`${formId}-brand-suggestions`}>
              {BRAND_SUGGESTIONS.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
            <label
              className="absolute left-md top-4 text-body-md text-on-surface-variant peer-focus:top-1 peer-focus:text-caption peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:text-caption transition-all"
              htmlFor={`${formId}-brand`}
            >
              Brand
            </label>
            <p className="mt-1 font-caption text-on-surface-variant">e.g. Apple, Samsung, Nike, Lenovo</p>
          </div>

          <div className="space-y-xs">
            <label className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">
              Color(s)
            </label>
            <ColorTagInput id={`${formId}-colors`} value={colors} onChange={setColors} />
          </div>

          <div className="space-y-sm">
            <label
              className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider"
              htmlFor={`${formId}-category`}
            >
              Category
            </label>
            <select
              id={`${formId}-category`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-14 px-md bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg transition-all outline-none font-body-md"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className={`font-caption text-error ${fieldErrors.category ? '' : 'hidden'}`} role="status">
              {fieldErrors.category}
            </p>
          </div>

          <div className="relative">
            <input
              className="peer w-full h-14 pt-4 px-md bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg transition-all outline-none"
              id={`${formId}-date`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <label
              className="absolute left-md top-1 text-caption text-primary transition-all"
              htmlFor={`${formId}-date`}
            >
              {reportType === 'lost' ? 'Date lost' : 'Date found'}
            </label>
            <p className={`mt-1 font-caption text-error ${fieldErrors.date ? '' : 'hidden'}`} role="status">
              {fieldErrors.date}
            </p>
          </div>
        </ReportSection>

        <ReportSection
          title="Location Information"
          subtitle="Primary location is required. Add a secondary area if the item may have moved."
        >
          <p className="font-caption text-on-surface-variant -mt-sm">
            Free OpenStreetMap — no API key required.
          </p>
          <LocationFieldGroup
            formId={formId}
            label="Primary location"
            locationName={locationName}
            onLocationNameChange={(e) => setLocationName(e.target.value)}
            coordinates={locationCoordinates}
            onMapSelect={handlePrimaryMapSelect}
            onUseMyLocation={handlePrimaryUseMyLocation}
            isLocating={isLocatingPrimary}
            error={fieldErrors.locationName}
          />
          <LocationFieldGroup
            formId={formId}
            label="Secondary location"
            optional
            locationName={secondaryLocationName}
            onLocationNameChange={(e) => setSecondaryLocationName(e.target.value)}
            coordinates={secondaryLocationCoordinates}
            onMapSelect={handleSecondaryMapSelect}
            onUseMyLocation={handleSecondaryUseMyLocation}
            isLocating={isLocatingSecondary}
          />
        </ReportSection>

        <ReportSection title="Item Description" subtitle="Describe the item for matching.">
          <ModeToggle
            name="Description mode"
            value={descriptionMode}
            onChange={setDescriptionMode}
            options={DESCRIPTION_MODES}
          />
          {descriptionMode === 'ai' && !imageFile ? (
            <p className="font-caption text-on-surface-variant rounded-lg bg-surface-container-low px-sm py-xs">
              AI caption generation coming soon — upload a photo below or write the description yourself.
            </p>
          ) : null}
          <div className="relative">
            {isProcessingImage ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-t-lg bg-surface/70 backdrop-blur-sm">
                <Spinner />
              </div>
            ) : null}
            <textarea
              className="peer w-full pt-6 px-md bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg transition-all outline-none resize-y min-h-[96px] disabled:opacity-70"
              id={`${formId}-description`}
              placeholder=" "
              rows={4}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setCaptionFromAi(false);
              }}
              disabled={isProcessingImage}
              aria-busy={isProcessingImage}
            />
            <label
              className="absolute left-md top-4 text-body-md text-on-surface-variant peer-focus:top-1 peer-focus:text-caption peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:text-caption transition-all"
              htmlFor={`${formId}-description`}
            >
              Detailed description
            </label>
            <p className={`mt-1 font-caption text-error ${fieldErrors.description ? '' : 'hidden'}`} role="status">
              {fieldErrors.description}
            </p>
          </div>
          {captionFromAi ? (
            <p className="font-caption text-primary">Caption suggested from your photo — you can edit anytime.</p>
          ) : null}
        </ReportSection>

        <ReportSection title="Distinctive Features" subtitle="Marks, damage, stickers, engravings, etc.">
          <ModeToggle
            name="Distinctive features mode"
            value={distinctiveFeaturesMode}
            onChange={setDistinctiveFeaturesMode}
            options={FEATURES_MODES}
          />
          {distinctiveFeaturesMode === 'ai' ? (
            <div
              className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-md py-md space-y-sm"
              role="status"
            >
              <p className="font-label-sm text-on-surface">AI feature extraction coming soon</p>
              <p className="font-caption text-on-surface-variant">
                OCR and vision models will suggest distinctive traits from your photo. For now, switch to “Write
                yourself” or enter details below after we enable this step.
              </p>
              <textarea
                className="w-full min-h-[72px] px-md py-sm bg-surface-container-highest border border-outline-variant rounded-lg text-on-surface-variant font-body-md resize-y opacity-60 cursor-not-allowed"
                disabled
                placeholder="AI feature extraction coming soon"
                aria-disabled="true"
              />
            </div>
          ) : (
            <textarea
              className="w-full min-h-[96px] px-md py-sm bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg outline-none resize-y font-body-md"
              id={`${formId}-distinctive`}
              value={distinctiveFeatures}
              onChange={(e) => setDistinctiveFeatures(e.target.value)}
              placeholder="e.g. cracked corner, engraved name, red sticker on back"
            />
          )}
        </ReportSection>

        <ReportSection title="AI Assistance" subtitle="Pipeline preview — models connect in a later release.">
          <AiPipelinePanel
            hasImage={Boolean(imageFile)}
            captionReady={captionFromAi && Boolean(description.trim())}
            embeddingReady={Array.isArray(embeddingVector) && embeddingVector.length > 0}
          />
        </ReportSection>

        <ReportSection title="Contact Preferences" subtitle="How matched users can reach you.">
          <fieldset className="space-y-sm">
            <legend className="sr-only">Contact preference</legend>
            <label className="flex items-start gap-sm cursor-pointer">
              <input
                type="radio"
                name={`${formId}-contact`}
                value="in_app_chat"
                checked={contactPreference === 'in_app_chat'}
                onChange={() => setContactPreference('in_app_chat')}
                className="mt-1 accent-primary"
              />
              <span className="font-body-md text-on-surface">
                Allow matched users to contact me via in-app chat
                <span className="block font-caption text-on-surface-variant">Default — for future Socket.io chat</span>
              </span>
            </label>
            <label className="flex items-start gap-sm cursor-pointer">
              <input
                type="radio"
                name={`${formId}-contact`}
                value="show_email"
                checked={contactPreference === 'show_email'}
                onChange={() => setContactPreference('show_email')}
                className="mt-1 accent-primary"
              />
              <span className="font-body-md text-on-surface">
                Show my email instead
                <span className="block font-caption text-on-surface-variant">Displayed on match cards when enabled</span>
              </span>
            </label>
          </fieldset>
        </ReportSection>

        <ReportSection title="Image Upload" subtitle="Optional — improves AI caption and future matching.">
          <div className="relative group">
            <div className="w-full h-48 rounded-xl overflow-hidden shadow-sm border-2 border-primary-container bg-surface-container-low">
              {imagePreview ? (
                <img alt="" className="w-full h-full object-cover" src={imagePreview} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-on-surface-variant font-caption">
                  Upload a photo (optional)
                </div>
              )}
              {imagePreview ? (
                <div className="absolute inset-0 bg-primary/10 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <span className="bg-surface text-primary px-lg py-sm rounded-full font-label-sm flex items-center gap-xs shadow-lg">
                    <span className="material-symbols-outlined">edit</span>
                    Change Photo
                  </span>
                </div>
              ) : null}
            </div>
            <label className="absolute inset-0 cursor-pointer rounded-xl" htmlFor={`${formId}-photo`}>
              <span className="sr-only">Upload image</span>
            </label>
            <input
              id={`${formId}-photo`}
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={handleImageChange}
              disabled={isProcessingImage}
            />
            <p className={`mt-1 font-caption text-error ${fieldErrors.image ? '' : 'hidden'}`} role="status">
              {fieldErrors.image}
            </p>
          </div>
        </ReportSection>

        <ReportSection title="Submission Summary" subtitle="Review before submitting.">
          <dl className="space-y-sm font-body-md text-on-surface">
            <div className="flex justify-between gap-md">
              <dt className="text-on-surface-variant">Type</dt>
              <dd className="capitalize text-right">{reportType}</dd>
            </div>
            <div className="flex justify-between gap-md">
              <dt className="text-on-surface-variant">Title</dt>
              <dd className="text-right truncate max-w-[60%]">{title.trim() || '—'}</dd>
            </div>
            {brand.trim() ? (
              <div className="flex justify-between gap-md">
                <dt className="text-on-surface-variant">Brand</dt>
                <dd className="text-right">{brand.trim()}</dd>
              </div>
            ) : null}
            {colors.length > 0 ? (
              <div className="flex justify-between gap-md">
                <dt className="text-on-surface-variant">Colors</dt>
                <dd className="text-right">{colors.join(', ')}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-md">
              <dt className="text-on-surface-variant">Category</dt>
              <dd>{category}</dd>
            </div>
            <div className="flex justify-between gap-md">
              <dt className="text-on-surface-variant">Primary location</dt>
              <dd className="text-right truncate max-w-[60%]">{locationName.trim() || '—'}</dd>
            </div>
            {secondaryLocationName.trim() || secondaryLocationCoordinates ? (
              <div className="flex justify-between gap-md">
                <dt className="text-on-surface-variant">Secondary location</dt>
                <dd className="text-right truncate max-w-[60%]">
                  {secondaryLocationName.trim() || (secondaryLocationCoordinates ? 'Pinned on map' : '—')}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-md">
              <dt className="text-on-surface-variant">Contact</dt>
              <dd className="text-right text-caption max-w-[65%]">{contactLabel}</dd>
            </div>
            <div className="flex justify-between gap-md">
              <dt className="text-on-surface-variant">Status</dt>
              <dd>
                <span className="inline-flex px-sm py-xs rounded-full bg-tertiary-container text-on-tertiary-container font-label-sm capitalize">
                  active
                </span>
              </dd>
            </div>
            <div className="flex justify-between gap-md">
              <dt className="text-on-surface-variant">Photo</dt>
              <dd>{imageFile ? 'Attached' : 'None'}</dd>
            </div>
            {!isOnline ? (
              <p className="font-caption text-primary pt-sm">You are offline — report will queue for sync.</p>
            ) : null}
          </dl>
        </ReportSection>
      </form>

      <footer className="fixed bottom-0 left-0 w-full bg-surface/80 backdrop-blur-xl px-margin-mobile py-md flex items-center gap-md shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-40">
        <Link
          to="/dashboard"
          className="flex-1 h-14 rounded-xl border border-outline text-on-surface font-label-sm active:scale-95 transition-transform duration-200 flex items-center justify-center"
        >
          Back
        </Link>
        <button
          type="submit"
          form={formId}
          disabled={isSubmitting}
          className="flex-[2] h-14 rounded-xl bg-primary text-on-primary font-label-sm shadow-lg active:scale-95 transition-transform duration-200 flex items-center justify-center gap-xs disabled:opacity-60"
        >
          {isSubmitting ? 'Submitting…' : 'Submit Report'}
          {!isSubmitting ? <span className="material-symbols-outlined">arrow_forward</span> : null}
        </button>
      </footer>
    </div>
  );
}
