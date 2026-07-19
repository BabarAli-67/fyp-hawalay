import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { analyzeImage } from '../api/aiService.js';
import { Logo } from '../components/Logo.jsx';
import { AiAnalyzeProgress } from '../components/report/AiAnalyzeProgress.jsx';
import { AiErrorBanner } from '../components/report/AiErrorBanner.jsx';
import { AiExtractionPanel } from '../components/report/AiExtractionPanel.jsx';
import { CategoryMismatchBanner } from '../components/report/CategoryMismatchBanner.jsx';
import { DistinctiveFeaturesChipInput } from '../components/report/DistinctiveFeaturesChipInput.jsx';
import { LocationFieldGroup } from '../components/report/LocationFieldGroup.jsx';
import { ReportSection } from '../components/report/ReportSection.jsx';
import { validateReportItemSubmit } from '../components/report/reportStepValidation.js';
import {
  ALLOWED_IMAGE_TYPES,
  CATEGORIES,
  CONDITION_OPTIONS,
  MAX_IMAGE_BYTES,
} from '../components/report/reportFormConstants.js';
import { useOfflineQueue } from '../hooks/useOfflineQueue.js';
import { useReportItemDraft } from '../hooks/useReportItemDraft.js';
import { Spinner } from '../components/ui/Spinner.jsx';
import {
  pickBrandFromAnalyze,
  pickCategoryFromAnalyze,
  pickConditionFromAnalyze,
  pickTitleFromAnalyze,
  resolveAiDistinctiveFeatures,
  resolveAiDistinctiveFeatureChips,
  serializeFeatureChips,
} from '../utils/analyzeExtraction.js';
import { normalizeAnalyzeResponse } from '../utils/normalizeAnalyzeResponse.js';
import { formatCoordinatesLabel, reverseGeocodeCoordinates } from '../utils/reverseGeocode.js';
import { mapSubmitError, submitItemReport } from '../utils/reportSubmit.js';
import { useAuth } from '../context/AuthContext.jsx';

function getDefaultDate() {
  return new Date().toISOString().slice(0, 10);
}

function resolveCoordinatesWithStatus() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ coords: null, denied: true, reason: 'unsupported' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          coords: [pos.coords.longitude, pos.coords.latitude],
          denied: false,
          reason: null,
        }),
      (err) => {
        const denied = err?.code === 1;
        const reason =
          err?.code === 1 ? 'denied' : err?.code === 2 ? 'unavailable' : err?.code === 3 ? 'timeout' : 'error';
        resolve({ coords: null, denied, reason });
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}

async function applyGeolocationToLocation(coords, setCoordinates, setLocationName, requestRef) {
  setCoordinates(coords);
  setLocationName('Finding address…');

  const requestId = requestRef ? ++requestRef.current : 0;
  const placeName = await reverseGeocodeCoordinates(coords);
  if (requestRef && requestId !== requestRef.current) return;

  if (placeName) {
    setLocationName(placeName);
    return;
  }
  setLocationName(formatCoordinatesLabel(coords));
}

function applyReportItemAutofill(analyze, { brand, setters, guards }) {
  if (!analyze) return false;

  let applied = false;

  const suggestedTitle = pickTitleFromAnalyze(analyze);
  if (suggestedTitle && !guards.titleEdited) {
    setters.setTitle(suggestedTitle);
    applied = true;
  }

  const suggestedBrand = pickBrandFromAnalyze(analyze);
  if (suggestedBrand && !brand?.trim() && !guards.brandEdited) {
    setters.setBrand(suggestedBrand);
    applied = true;
  }

  const captionText = (analyze.caption || '').trim();
  if (captionText && !guards.descriptionEdited) {
    setters.setDescription(captionText);
    applied = true;
  }

  const featuresDraft = resolveAiDistinctiveFeatureChips(analyze);
  if (featuresDraft.length && !guards.featuresEdited) {
    setters.setFeatureChips(featuresDraft);
    applied = true;
  }

  const suggestedCategory = pickCategoryFromAnalyze(analyze);
  if (suggestedCategory && !guards.categoryEdited) {
    setters.setCategory(suggestedCategory);
    setters.setUserSelectedCategory(suggestedCategory);
    applied = true;
  }

  const suggestedCondition = pickConditionFromAnalyze(analyze);
  if (suggestedCondition && !guards.conditionEdited) {
    setters.setCondition(suggestedCondition);
    applied = true;
  }

  return applied;
}

function FloatingField({ id, label, children, hint, error }) {
  return (
    <div className="relative">
      {children}
      <label
        className="absolute left-md top-4 text-body-md text-on-surface-variant peer-focus:top-1 peer-focus:text-caption peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:text-caption transition-all"
        htmlFor={id}
      >
        {label}
      </label>
      {hint ? <p className="mt-1 font-caption text-on-surface-variant">{hint}</p> : null}
      {error ? (
        <p className="mt-1 font-caption text-error" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function ReportItemPage() {
  const formId = useId();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOnline } = useOfflineQueue();
  const titleEditedRef = useRef(false);
  const brandEditedRef = useRef(false);
  const categoryEditedRef = useRef(false);
  const conditionEditedRef = useRef(false);
  const descriptionEditedRef = useRef(false);
  const featuresEditedRef = useRef(false);
  const analyzeRequestRef = useRef(0);
  const submitLockRef = useRef(false);
  const primaryGeocodeReqRef = useRef(0);
  const secondaryGeocodeReqRef = useRef(0);
  const imageInputRef = useRef(null);
  /** Once the user taps the map, GPS auto-locate must not overwrite their pin. */
  const primaryPinnedByUserRef = useRef(false);
  const secondaryPinnedByUserRef = useRef(false);

  const [reportType, setReportType] = useState('lost');
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [userSelectedCategory, setUserSelectedCategory] = useState('Electronics');
  const [categoryMismatchAcknowledged, setCategoryMismatchAcknowledged] = useState(false);
  const [condition, setCondition] = useState('');
  const [date, setDate] = useState(() => getDefaultDate());
  const [description, setDescription] = useState('');
  const [featureChips, setFeatureChips] = useState([]);
  const [locationName, setLocationName] = useState('');
  const [locationCoordinates, setLocationCoordinates] = useState(null);
  const [secondaryLocationName, setSecondaryLocationName] = useState('');
  const [secondaryLocationCoordinates, setSecondaryLocationCoordinates] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [embeddingVector, setEmbeddingVector] = useState(null);
  const [embeddingAvailable, setEmbeddingAvailable] = useState(null);
  const [analyzeSnapshot, setAnalyzeSnapshot] = useState(null);
  const [ocrError, setOcrError] = useState(null);
  const [aiInfoMessage, setAiInfoMessage] = useState(null);
  const [aiAutofillApplied, setAiAutofillApplied] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [genericError, setGenericError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [isAutoLocating, setIsAutoLocating] = useState(true);
  const [geolocationWarning, setGeolocationWarning] = useState(null);
  const [showSecondaryLocation, setShowSecondaryLocation] = useState(false);
  const [draftAutoSaveEnabled, setDraftAutoSaveEnabled] = useState(true);
  const [offlineDraftSaved, setOfflineDraftSaved] = useState(false);

  const aiBusy = isProcessingImage || isProcessingOcr;

  const suggestedCategory = analyzeSnapshot?.suggestedCategory || null;
  const suggestedCategoryHint =
    analyzeSnapshot?.suggestedCategoryHint ||
    (analyzeSnapshot?.suggestedCategorySource === 'card_ocr_v1' ? 'identity document' : null);
  const detectedClassName = useMemo(() => {
    if (suggestedCategoryHint) return null;
    const objects = analyzeSnapshot?.objectDetection?.detectedObjects || [];
    if (!objects.length) return null;
    const top = [...objects].sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
    return top?.className || null;
  }, [analyzeSnapshot, suggestedCategoryHint]);
  const categoryMismatchLabel = suggestedCategoryHint || detectedClassName;

  const formSnapshot = useMemo(
    () => ({
      reportType,
      title,
      brand,
      category,
      userSelectedCategory,
      categoryMismatchAcknowledged,
      condition,
      date,
      description,
      featureChips,
      locationName,
      locationCoordinates,
      secondaryLocationName,
      secondaryLocationCoordinates,
      showSecondaryLocation,
      analyzeSnapshot,
      embeddingVector,
      embeddingAvailable,
      ocrError,
      aiInfoMessage,
      aiAutofillApplied,
      editedFlags: {
        titleEdited: titleEditedRef.current,
        brandEdited: brandEditedRef.current,
        categoryEdited: categoryEditedRef.current,
        conditionEdited: conditionEditedRef.current,
        descriptionEdited: descriptionEditedRef.current,
        featuresEdited: featuresEditedRef.current,
      },
    }),
    [
      reportType,
      title,
      brand,
      category,
      userSelectedCategory,
      categoryMismatchAcknowledged,
      condition,
      date,
      description,
      featureChips,
      locationName,
      locationCoordinates,
      secondaryLocationName,
      secondaryLocationCoordinates,
      showSecondaryLocation,
      analyzeSnapshot,
      embeddingVector,
      embeddingAvailable,
      ocrError,
      aiInfoMessage,
      aiAutofillApplied,
    ],
  );

  const applyDraftRestore = useCallback((draft) => {
    const form = draft.form;
    if (!form) return {};

    setReportType(form.reportType ?? 'lost');
    setTitle(form.title ?? '');
    setBrand(form.brand ?? '');
    setCategory(form.category ?? 'Electronics');
    setUserSelectedCategory(form.userSelectedCategory ?? form.category ?? 'Electronics');
    setCategoryMismatchAcknowledged(form.categoryMismatchAcknowledged ?? false);
    setCondition(form.condition ?? '');
    setDate(form.date ?? getDefaultDate());
    setDescription(form.description ?? '');
    setFeatureChips(form.featureChips ?? []);
    setLocationName(form.locationName ?? '');
    setLocationCoordinates(form.locationCoordinates ?? null);
    setSecondaryLocationName(form.secondaryLocationName ?? '');
    setSecondaryLocationCoordinates(form.secondaryLocationCoordinates ?? null);
    setShowSecondaryLocation(form.showSecondaryLocation ?? false);
    setAnalyzeSnapshot(form.analyzeSnapshot ?? null);
    setEmbeddingVector(form.embeddingVector ?? null);
    setEmbeddingAvailable(form.embeddingAvailable ?? null);
    setOcrError(form.ocrError ?? null);
    setAiInfoMessage(form.aiInfoMessage ?? null);
    setAiAutofillApplied(form.aiAutofillApplied ?? false);

    const flags = form.editedFlags ?? {};
    titleEditedRef.current = flags.titleEdited ?? false;
    brandEditedRef.current = flags.brandEdited ?? false;
    categoryEditedRef.current = flags.categoryEdited ?? false;
    conditionEditedRef.current = flags.conditionEdited ?? false;
    descriptionEditedRef.current = flags.descriptionEdited ?? false;
    featuresEditedRef.current = flags.featuresEdited ?? false;

    let imageRestoreFailed = false;
    if (draft.imageBlob) {
      try {
        const file = new File(
          [draft.imageBlob],
          draft.imageFilename || 'draft-photo.jpg',
          { type: draft.imageMimeType || draft.imageBlob.type || 'image/jpeg' },
        );
        setImageFile(file);
        setImagePreview((prev) => {
          if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
          return URL.createObjectURL(draft.imageBlob);
        });
      } catch {
        imageRestoreFailed = true;
        setImageFile(null);
        setImagePreview(null);
      }
    }

    return {
      hadLocation: Boolean(form.locationCoordinates?.length === 2),
      imageRestoreFailed,
    };
  }, []);

  const { draftReady, draftHadLocation, draftSavedLabel, imageRestoreNotice, clearDraft } =
    useReportItemDraft({
      userId: user?._id ?? user?.id,
      formSnapshot,
      imageFile,
      onRestore: applyDraftRestore,
      isBlocked: isSubmitting || aiBusy || !draftAutoSaveEnabled,
    });

  const reportCopy = useMemo(() => {
    const isLost = reportType === 'lost';
    return {
      pageTitle: isLost ? 'Report Lost Item' : 'Report Found Item',
      dateLabel: isLost ? 'Date Lost' : 'Date Found',
      reportTypeSubtitle: isLost
        ? 'You are reporting an item you lost.'
        : 'You are reporting an item you found.',
    };
  }, [reportType]);

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  useEffect(() => {
    if (!draftReady) return undefined;

    if (draftHadLocation) {
      // Restored draft already has a chosen pin — never run GPS overwrite.
      primaryPinnedByUserRef.current = true;
      setIsAutoLocating(false);
      return undefined;
    }

    let cancelled = false;

    async function autoLocateOnMount() {
      setIsAutoLocating(true);
      setGeolocationWarning(null);

      const result = await resolveCoordinatesWithStatus();
      if (cancelled) return;

      if (result.coords) {
        // GPS can take several seconds. If the user already tapped the map,
        // keep their pin and skip applying device coordinates.
        if (!primaryPinnedByUserRef.current) {
          await applyGeolocationToLocation(
            result.coords,
            setLocationCoordinates,
            setLocationName,
            primaryGeocodeReqRef,
          );
        }
        if (!secondaryPinnedByUserRef.current) {
          await applyGeolocationToLocation(
            result.coords,
            setSecondaryLocationCoordinates,
            setSecondaryLocationName,
            secondaryGeocodeReqRef,
          );
        }
        if (!primaryPinnedByUserRef.current) {
          setFieldErrors((prev) => {
            const next = { ...prev };
            delete next.locationName;
            return next;
          });
        }
      } else if (result.denied) {
        setGeolocationWarning(
          'Location access was denied. Allow location in your browser settings, or tap the maps below to pin locations manually.',
        );
      } else {
        setGeolocationWarning(
          'Could not detect your location. Tap the maps below to pin primary and secondary locations manually.',
        );
      }

      if (!cancelled) setIsAutoLocating(false);
    }

    autoLocateOnMount();

    return () => {
      cancelled = true;
    };
  }, [draftReady, draftHadLocation]);

  function handleCategoryChange(nextCategory) {
    if (!nextCategory || nextCategory === category) return;
    categoryEditedRef.current = true;
    setCategory(nextCategory);
    setUserSelectedCategory(nextCategory);
    // Acknowledge when user matches AI suggestion; otherwise re-show mismatch banner.
    setCategoryMismatchAcknowledged(
      Boolean(suggestedCategory) && nextCategory === suggestedCategory,
    );
  }

  function handleKeepCurrentCategory() {
    setCategoryMismatchAcknowledged(true);
  }

  function handleUseSuggestedCategory() {
    if (!suggestedCategory) return;
    setCategory(suggestedCategory);
    setUserSelectedCategory(suggestedCategory);
    setCategoryMismatchAcknowledged(true);
  }

  const handlePrimaryMapSelect = useCallback(({ coordinates }) => {
    primaryPinnedByUserRef.current = true;
    setIsAutoLocating(false);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.locationName;
      return next;
    });
    void applyGeolocationToLocation(
      coordinates,
      setLocationCoordinates,
      setLocationName,
      primaryGeocodeReqRef,
    );
  }, []);

  const handleSecondaryMapSelect = useCallback(({ coordinates }) => {
    secondaryPinnedByUserRef.current = true;
    void applyGeolocationToLocation(
      coordinates,
      setSecondaryLocationCoordinates,
      setSecondaryLocationName,
      secondaryGeocodeReqRef,
    );
  }, []);

  async function handleImageChange(e) {
    if (aiBusy) {
      e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.image;
      return next;
    });
    setAiInfoMessage(null);
    titleEditedRef.current = false;
    brandEditedRef.current = false;
    // Keep a manual category choice across re-uploads so AI cannot lock the field.
    // categoryEditedRef is only cleared when the user has never touched category.
    conditionEditedRef.current = false;
    descriptionEditedRef.current = false;
    featuresEditedRef.current = false;
    setEmbeddingAvailable(null);
    setEmbeddingVector(null);
    setAnalyzeSnapshot(null);
    setOcrError(null);
    setAiAutofillApplied(false);
    setCategoryMismatchAcknowledged(false);

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
    setIsProcessingOcr(true);
    const requestId = ++analyzeRequestRef.current;

    const formData = new FormData();
    formData.append('image', file);
    formData.append('document_type', 'auto');
    if (category) formData.append('category', category);
    if (locationName) formData.append('location', locationName);
    if (title.trim()) formData.append('title', title.trim());
    if (description.trim()) formData.append('description', description.trim());

    try {
      const data = await analyzeImage(formData);
      if (requestId !== analyzeRequestRef.current) return;

      const analyze = normalizeAnalyzeResponse(data);
      setAnalyzeSnapshot(analyze);

      if (analyze) {
        const hadAutofill = applyReportItemAutofill(analyze, {
          brand,
          setters: {
            setTitle,
            setBrand,
            setDescription,
            setFeatureChips,
            setCategory,
            setUserSelectedCategory,
            setCondition,
          },
          guards: {
            titleEdited: titleEditedRef.current,
            brandEdited: brandEditedRef.current,
            categoryEdited: categoryEditedRef.current,
            conditionEdited: conditionEditedRef.current,
            descriptionEdited: descriptionEditedRef.current,
            featuresEdited: featuresEditedRef.current,
          },
        });

        if (hadAutofill) {
          setAiAutofillApplied(true);
        }

        if (analyze.suggestedCategory) {
          const aiCategory = pickCategoryFromAnalyze(analyze);
          if (categoryEditedRef.current && aiCategory && aiCategory !== category) {
            setCategoryMismatchAcknowledged(false);
          } else {
            setCategoryMismatchAcknowledged(true);
          }
        }

        if (analyze.visionMessage) {
          setAiInfoMessage(analyze.visionMessage);
        } else if (analyze.caption?.trim() || resolveAiDistinctiveFeatures(analyze)) {
          setAiInfoMessage('AI filled item details below — edit anything before you submit.');
        } else if (analyze.ocr?.success) {
          setAiInfoMessage('Text extracted from image. Review and edit the fields below.');
        }

        if (analyze.embeddingVector) setEmbeddingVector(analyze.embeddingVector);
        setEmbeddingAvailable(analyze.embeddingAvailable);
      }
    } catch (err) {
      if (requestId !== analyzeRequestRef.current) return;
      const body = err?.response?.data;
      const status = err?.response?.status;
      setEmbeddingAvailable(false);

      if (status === 503 && body?.fallback) {
        setOcrError('AI service unavailable — you can still fill the form manually.');
        setAiInfoMessage('AI service unavailable — describe manually.');
      } else if (err?.code === 'ECONNABORTED') {
        setOcrError(
          'Analysis timed out — the server may still be busy. Wait and upload again, or describe manually.',
        );
      } else if (typeof body?.error === 'string') {
        setOcrError(body.error);
        setFieldErrors((prev) => ({ ...prev, image: body.error }));
      } else {
        setOcrError('Could not analyze image.');
      }
    } finally {
      if (requestId === analyzeRequestRef.current) {
        setIsProcessingOcr(false);
        setIsProcessingImage(false);
      }
    }
  }

  function handleRemovePhoto() {
    // Invalidate an in-flight analyze response so it cannot restore removed image data.
    analyzeRequestRef.current += 1;
    setIsProcessingImage(false);
    setIsProcessingOcr(false);
    setImageFile(null);
    setImagePreview(null);
    setEmbeddingVector(null);
    setEmbeddingAvailable(null);
    setAnalyzeSnapshot(null);
    setOcrError(null);
    setAiInfoMessage(null);
    setAiAutofillApplied(false);
    setCategoryMismatchAcknowledged(false);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.image;
      return next;
    });
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    handleSubmit();
  }

  async function handleSubmit() {
    // Synchronous lock — React state alone cannot stop multi-click races offline.
    if (submitLockRef.current || isSubmitting || aiBusy || offlineDraftSaved) {
      return;
    }
    submitLockRef.current = true;

    setGenericError(null);

    const validationErrors = validateReportItemSubmit({
      reportType,
      title,
      category,
      date,
      locationName,
      locationCoordinates,
      isProcessingImage: aiBusy,
    });

    if (Object.keys(validationErrors).length > 0) {
      submitLockRef.current = false;
      setFieldErrors(validationErrors);
      if (validationErrors.processing) {
        toast.warn(validationErrors.processing);
      } else {
        toast.warn('Please complete all required fields.');
      }
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const extended = {
      brand,
      distinctiveFeatures: serializeFeatureChips(featureChips),
      contactPreference: 'in_app_chat',
      description,
      caption: analyzeSnapshot?.caption || '',
      ocrText: analyzeSnapshot?.ocrText || '',
      embeddingVector,
      analyzeSnapshot,
      userCategory: userSelectedCategory,
    };

    try {
      const result = await submitItemReport({
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
      });

      if (!result.ok) {
        submitLockRef.current = false;
        setIsSubmitting(false);
        setFieldErrors(result.fieldErrors || {});
        toast.warn('Please complete all required fields.');
        return;
      }

      if (result.offline) {
        // IndexedDB queue save is complete. Replace the form immediately;
        // draft cleanup must not delay or suppress the confirmation screen.
        setDraftAutoSaveEnabled(false);
        setOfflineDraftSaved(true);
        setIsSubmitting(false);
        void clearDraft().catch(() => {
          // The queued report is already safe; stale form-draft cleanup can retry later.
        });
        return;
      }

      await clearDraft();
      setDraftAutoSaveEnabled(false);
      toast.success('Report submitted!');
      navigate(`/matches/ai/${result.itemId}`, { state: { reportSubmitted: true } });
    } catch (err) {
      submitLockRef.current = false;
      const { fieldErrors: submitFieldErrors, genericError: submitError } = mapSubmitError(err);
      if (submitFieldErrors) {
        setFieldErrors(submitFieldErrors);
      } else {
        setGenericError(submitError);
      }
      setIsSubmitting(false);
    }
  }

  if (offlineDraftSaved) {
    return (
      <div className="min-h-screen bg-background px-margin-mobile text-on-background">
        <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center py-xl text-center">
          <div className="mb-lg flex h-24 w-24 items-center justify-center rounded-full bg-primary-container/20">
            <span
              className="material-symbols-outlined text-[52px] text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              cloud_done
            </span>
          </div>

          <h1 className="font-h1 text-h1 text-on-surface">Report saved as draft.</h1>
          <p className="mt-sm max-w-sm font-body-md text-on-surface-variant">
            Your report is safely stored on this device and will be submitted automatically when
            you are back online.
          </p>

          <div className="mt-xl flex w-full flex-col gap-sm">
            <button
              type="button"
              onClick={() => navigate('/offline')}
              className="flex h-14 w-full items-center justify-center gap-xs rounded-xl bg-primary font-label-sm text-on-primary shadow-md transition-transform active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[20px]">draft</span>
              View saved drafts
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard', { replace: true })}
              className="flex h-14 w-full items-center justify-center gap-xs rounded-xl border border-outline-variant bg-surface-container-lowest font-label-sm text-on-surface transition-transform active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[20px]">home</span>
              Back to dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

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

      <form
        id={formId}
        onSubmit={handleFormSubmit}
        className="pt-24 px-margin-mobile space-y-lg max-w-2xl mx-auto"
      >
        <ReportSection title="Report type" subtitle={reportCopy.reportTypeSubtitle}>
          <div className="flex rounded-2xl overflow-hidden border-2 border-outline-variant bg-surface-container-low h-16">
            <button
              type="button"
              onClick={() => setReportType('found')}
              className={`flex-1 font-h3 text-h3 transition-colors ${
                reportType === 'found'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              Found
            </button>
            <button
              type="button"
              onClick={() => setReportType('lost')}
              className={`flex-1 font-h3 text-h3 transition-colors ${
                reportType === 'lost'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              Lost
            </button>
          </div>
        </ReportSection>

        <section>
          <h2 className="font-h1 text-h1 text-on-surface mb-xs">{reportCopy.pageTitle}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Upload a photo and let AI help fill in the details. Everything stays editable.
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

        <ReportSection
          title="Item photo"
          subtitle="Upload a clear photo — AI runs OCR, object detection, and captioning automatically."
        >
          <div className="relative group">
            <div className="w-full h-56 rounded-xl overflow-hidden shadow-sm border-2 border-primary-container bg-surface-container-low">
              {imagePreview ? (
                <img alt="Upload preview" className="w-full h-full object-cover" src={imagePreview} />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-[40px] text-primary">add_a_photo</span>
                  <span className="font-body-md">Tap to upload a photo</span>
                  <span className="font-caption">JPEG or PNG, up to 5MB</span>
                </div>
              )}
              {aiBusy ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-sm bg-surface/70 backdrop-blur-sm">
                  <Spinner />
                  <span className="font-caption text-on-surface-variant">Analyzing image…</span>
                </div>
              ) : null}
              {imagePreview && !aiBusy ? (
                <div className="absolute inset-0 bg-primary/10 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <span className="bg-surface text-primary px-lg py-sm rounded-full font-label-sm flex items-center gap-xs shadow-lg">
                    <span className="material-symbols-outlined">edit</span>
                    Change Photo
                  </span>
                </div>
              ) : null}
            </div>
            <label
              className={`absolute inset-0 rounded-xl ${aiBusy ? 'pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}
              htmlFor={aiBusy ? undefined : `${formId}-photo`}
            >
              <span className="sr-only">Upload image</span>
            </label>
            {imagePreview ? (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="absolute right-3 top-3 z-20 flex h-10 items-center gap-xs rounded-full bg-error px-sm text-on-error shadow-lg transition-transform hover:scale-105 active:scale-95"
                aria-label="Remove uploaded photo"
                title="Remove photo"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden>
                  close
                </span>
                <span className="font-label-sm">Remove</span>
              </button>
            ) : null}
            <input
              ref={imageInputRef}
              id={`${formId}-photo`}
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={handleImageChange}
              disabled={aiBusy}
              aria-busy={aiBusy}
            />
            <p className={`mt-1 font-caption text-error ${fieldErrors.image ? '' : 'hidden'}`} role="status">
              {fieldErrors.image}
            </p>
          </div>

          {imageFile ? (
            <AiAnalyzeProgress
              hasImage={Boolean(imageFile)}
              isAnalyzing={aiBusy}
              analyze={analyzeSnapshot}
              hasError={Boolean(ocrError)}
            />
          ) : null}

          <AiErrorBanner message={ocrError} onDismiss={() => setOcrError(null)} />

          {aiInfoMessage && !ocrError ? (
            <div
              className="rounded-lg border border-outline-variant/30 bg-primary-container px-md py-sm"
              role="status"
            >
              <span className="font-label-sm text-on-primary-container">{aiInfoMessage}</span>
            </div>
          ) : null}

          {imageRestoreNotice ? (
            <div
              className="rounded-lg border border-outline-variant/30 bg-surface-container-high px-md py-sm"
              role="status"
            >
              <span className="font-label-sm text-on-surface-variant">{imageRestoreNotice}</span>
            </div>
          ) : null}

          <AiExtractionPanel
            analyze={aiBusy ? null : analyzeSnapshot}
            isLoading={false}
            error={null}
          />
        </ReportSection>

        <ReportSection
          title="Item details"
          subtitle={
            aiAutofillApplied
              ? 'AI filled some fields — edit anything before you submit.'
              : 'Review AI suggestions or enter details manually.'
          }
        >
          {aiAutofillApplied && !aiBusy ? (
            <div
              className="rounded-lg border border-outline-variant/30 bg-primary-container/50 px-md py-sm flex items-center gap-sm"
              role="status"
            >
              <span className="material-symbols-outlined text-primary text-[20px]">auto_awesome</span>
              <span className="font-label-sm text-on-primary-container">
                Autofill complete — all fields below remain editable.
              </span>
            </div>
          ) : null}

          <FloatingField id={`${formId}-title`} label="Item name" error={fieldErrors.title}>
            <input
              className="peer w-full h-14 pt-4 px-md bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg transition-all outline-none"
              id={`${formId}-title`}
              value={title}
              onChange={(e) => {
                titleEditedRef.current = true;
                setTitle(e.target.value);
              }}
              placeholder=" "
              autoComplete="off"
            />
          </FloatingField>

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
              {reportCopy.dateLabel}
            </label>
          </div>

          <FloatingField id={`${formId}-brand`} label="Brand" hint="e.g. Apple, Samsung, Nike, Lenovo">
            <input
              className="peer w-full h-14 pt-4 px-md bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg transition-all outline-none"
              id={`${formId}-brand`}
              value={brand}
              onChange={(e) => {
                brandEditedRef.current = true;
                setBrand(e.target.value);
              }}
              placeholder=" "
              autoComplete="off"
            />
          </FloatingField>

          <div className="space-y-sm">
            <div className="flex items-center justify-between gap-sm">
              <p
                id={`${formId}-category-label`}
                className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider"
              >
                Category
              </p>
              <span className="font-caption text-on-surface-variant">Tap to change</span>
            </div>
            <div
              role="group"
              aria-labelledby={`${formId}-category-label`}
              className="grid grid-cols-2 sm:grid-cols-3 gap-sm"
            >
              {CATEGORIES.map((c) => {
                const selected = category === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => handleCategoryChange(c.value)}
                    aria-pressed={selected}
                    className={`min-h-[48px] rounded-xl px-md py-sm font-label-sm text-left transition-all active:scale-[0.98] border ${
                      selected
                        ? 'bg-primary text-on-primary border-primary shadow-sm'
                        : 'bg-surface-container-low text-on-surface border-outline-variant/40 hover:bg-surface-container hover:border-outline-variant'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            {suggestedCategory &&
            userSelectedCategory &&
            suggestedCategory !== userSelectedCategory &&
            !categoryMismatchAcknowledged ? (
              <CategoryMismatchBanner
                userCategory={userSelectedCategory}
                suggestedCategory={suggestedCategory}
                detectedClassName={categoryMismatchLabel}
                onKeepCurrent={handleKeepCurrentCategory}
                onUseSuggested={handleUseSuggestedCategory}
              />
            ) : null}
          </div>

          <div className="space-y-sm">
            <label
              className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider"
              htmlFor={`${formId}-condition`}
            >
              Condition
            </label>
            <select
              id={`${formId}-condition`}
              value={condition}
              onChange={(e) => {
                conditionEditedRef.current = true;
                setCondition(e.target.value);
              }}
              className="w-full h-14 px-md bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg transition-all outline-none font-body-md cursor-pointer"
            >
              {CONDITION_OPTIONS.map((opt) => (
                <option key={opt.value || 'unset'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-xs">
            <label
              className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider"
              htmlFor={`${formId}-description`}
            >
              Description
            </label>
            <textarea
              className="w-full min-h-[120px] px-md py-sm bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg outline-none resize-y font-body-md disabled:opacity-70"
              id={`${formId}-description`}
              value={description}
              onChange={(e) => {
                descriptionEditedRef.current = true;
                setDescription(e.target.value);
              }}
              placeholder="Describe the item — color, branding, visible text, overall condition…"
            />
          </div>

          <DistinctiveFeaturesChipInput
            id={`${formId}-features`}
            chips={featureChips}
            onChange={(nextChips) => {
              featuresEditedRef.current = true;
              setFeatureChips(nextChips);
            }}
          />
        </ReportSection>

        <ReportSection
          title="Location"
          subtitle="Your location is detected automatically. Tap the map to adjust pins."
        >
          {isAutoLocating ? (
            <div
              className="flex items-center gap-sm rounded-lg border border-outline-variant/30 bg-surface-container-low px-md py-sm"
              role="status"
            >
              <Spinner />
              <span className="font-label-sm text-on-surface-variant">Detecting your location…</span>
            </div>
          ) : null}

          {geolocationWarning ? (
            <div
              className="rounded-lg border border-outline-variant/30 bg-error-container px-md py-sm"
              role="alert"
            >
              <span className="font-label-sm text-on-error-container">{geolocationWarning}</span>
            </div>
          ) : null}

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
            showUseMyLocation={false}
            error={fieldErrors.locationName}
          />

          <div className="border-t border-outline-variant/30 pt-md">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-sm">
              <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">
                Secondary location
                <span className="normal-case text-on-surface-variant font-caption"> (optional)</span>
              </p>
              <button
                type="button"
                onClick={() => setShowSecondaryLocation((open) => !open)}
                aria-expanded={showSecondaryLocation}
                aria-controls={`${formId}-secondary-location-panel`}
                className="w-full sm:w-auto rounded-lg border border-outline-variant/40 bg-surface-container-low px-md py-sm font-label-sm text-primary flex items-center justify-center gap-xs active:scale-[0.98] transition-transform hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {showSecondaryLocation ? 'expand_less' : 'add'}
                </span>
                {showSecondaryLocation ? 'Hide Secondary Location' : 'Add Secondary Location'}
              </button>
            </div>

            <AnimatePresence initial={false}>
              {showSecondaryLocation ? (
                <motion.div
                  key="secondary-location-panel"
                  id={`${formId}-secondary-location-panel`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className="pt-sm">
                    <LocationFieldGroup
                      formId={formId}
                      label="Secondary location"
                      optional
                      hideSectionLabel
                      locationName={secondaryLocationName}
                      onLocationNameChange={(e) => setSecondaryLocationName(e.target.value)}
                      coordinates={secondaryLocationCoordinates}
                      onMapSelect={handleSecondaryMapSelect}
                      showUseMyLocation={false}
                    />
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </ReportSection>
      </form>

      <footer className="fixed bottom-0 left-0 w-full bg-surface/80 backdrop-blur-xl px-margin-mobile py-md z-40">
        {draftSavedLabel ? (
          <p className="text-center font-caption text-on-surface-variant mb-sm max-w-2xl mx-auto flex items-center justify-center gap-xs">
            <span className="material-symbols-outlined text-[16px]">cloud_done</span>
            {draftSavedLabel}
          </p>
        ) : null}
        {!isOnline ? (
          <p className="text-center font-caption text-on-surface-variant mb-sm max-w-2xl mx-auto">
            You are offline — your report will be queued for sync.
          </p>
        ) : null}
        <button
          type="submit"
          form={formId}
          disabled={isSubmitting || aiBusy || offlineDraftSaved}
          aria-busy={isSubmitting}
          className="w-full max-w-2xl mx-auto h-14 rounded-xl bg-primary text-on-primary font-label-sm shadow-lg flex items-center justify-center gap-xs active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none"
        >
          {isSubmitting ? 'Submitting…' : 'Submit Report'}
          {!isSubmitting ? <span className="material-symbols-outlined">check</span> : null}
        </button>
      </footer>
    </div>
  );
}
