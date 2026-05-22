import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axiosInstance from '../api/axiosInstance.js';
import { Logo } from '../components/Logo.jsx';
import { ReportStepProgress } from '../components/report/ReportStepProgress.jsx';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  TOTAL_REPORT_STEPS,
} from '../components/report/reportFormConstants.js';
import { validateFullReport, validateReportStep, isReportStepComplete } from '../components/report/reportStepValidation.js';
import { ReportStepBasicInfo } from '../components/report/steps/ReportStepBasicInfo.jsx';
import { ReportStepItemDetails } from '../components/report/steps/ReportStepItemDetails.jsx';
import { ReportStepLocationContact } from '../components/report/steps/ReportStepLocationContact.jsx';
import { ReportStepReview } from '../components/report/steps/ReportStepReview.jsx';
import { useOfflineQueue } from '../hooks/useOfflineQueue.js';
import { addToQueue } from '../utils/indexedDB.js';
import { formatCoordinatesLabel, reverseGeocodeCoordinates } from '../utils/reverseGeocode.js';

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

function isValidGeoCoordinates(coords) {
  return (
    Array.isArray(coords) &&
    coords.length === 2 &&
    coords.every((n) => Number.isFinite(Number(n)))
  );
}

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
  if (isValidGeoCoordinates(secondaryCoordinates)) {
    target.secondaryLocation = JSON.stringify({
      type: 'Point',
      coordinates: [Number(secondaryCoordinates[0]), Number(secondaryCoordinates[1])],
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

export default function ReportPage() {
  const formId = useId();
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const initialReportType = routeLocation.state?.reportType === 'found' ? 'found' : 'lost';
  const stepContentRef = useRef(null);

  const [currentStep, setCurrentStep] = useState(1);
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

  useEffect(() => {
    stepContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [currentStep]);

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

  function handleDescriptionChange(value) {
    setDescription(value);
    setCaptionFromAi(false);
  }

  function getValidationValues(extra = {}) {
    return {
      reportType,
      title,
      category,
      date,
      locationName,
      locationCoordinates,
      fieldErrors,
      isProcessingImage,
      ...extra,
    };
  }

  const canGoNext = useMemo(() => {
    if (currentStep >= TOTAL_REPORT_STEPS) return false;
    return isReportStepComplete(currentStep, getValidationValues());
  }, [
    currentStep,
    reportType,
    title,
    category,
    date,
    locationName,
    locationCoordinates,
    fieldErrors,
    isProcessingImage,
  ]);

  function handleNext() {
    setGenericError(null);
    if (!canGoNext) {
      const errors = validateReportStep(currentStep, getValidationValues());
      if (errors.processing) {
        toast.warn(errors.processing);
      } else {
        setFieldErrors((prev) => ({ ...prev, ...errors }));
        toast.warn('Please fix the highlighted fields before continuing.');
      }
      return;
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (currentStep === 1) {
        delete next.reportType;
        delete next.title;
        delete next.category;
        delete next.date;
      }
      if (currentStep === 3) delete next.locationName;
      delete next.processing;
      return next;
    });
    setCurrentStep((s) => Math.min(s + 1, TOTAL_REPORT_STEPS));
  }

  function handleFormKeyDown(e) {
    if (e.key !== 'Enter' || currentStep === TOTAL_REPORT_STEPS) return;
    if (e.target.tagName === 'TEXTAREA') return;
    e.preventDefault();
  }

  function handlePrevious() {
    setGenericError(null);
    setCurrentStep((s) => Math.max(s - 1, 1));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setGenericError(null);

    // Enter in a field or implicit submit must not skip the review step.
    if (currentStep !== TOTAL_REPORT_STEPS) {
      handleNext();
      return;
    }

    const nextErrors = validateFullReport(getValidationValues());
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      if (nextErrors.title || nextErrors.category || nextErrors.date || nextErrors.reportType) {
        setCurrentStep(1);
      } else if (nextErrors.locationName) {
        setCurrentStep(3);
      }
      toast.warn('Please complete all required fields.');
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
      setCurrentStep(3);
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
          // Background Sync or SW not available yet
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

  const isLastStep = currentStep === TOTAL_REPORT_STEPS;

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
        onSubmit={handleSubmit}
        onKeyDown={handleFormKeyDown}
        className="pt-24 px-margin-mobile space-y-lg max-w-2xl mx-auto"
      >
        <ReportStepProgress currentStep={currentStep} />

        <section ref={stepContentRef}>
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

        {aiInfoMessage && currentStep === 2 ? (
          <div
            className="rounded-lg border border-outline-variant/30 bg-primary-container px-md py-sm"
            role="status"
          >
            <span className="font-label-sm text-on-primary-container">{aiInfoMessage}</span>
          </div>
        ) : null}

        <div
          key={currentStep}
          className="space-y-lg transition-opacity duration-300 ease-out"
        >
          {currentStep === 1 ? (
            <ReportStepBasicInfo
              formId={formId}
              reportType={reportType}
              onReportTypeChange={setReportType}
              title={title}
              onTitleChange={setTitle}
              brand={brand}
              onBrandChange={setBrand}
              colors={colors}
              onColorsChange={setColors}
              category={category}
              onCategoryChange={setCategory}
              date={date}
              onDateChange={setDate}
              fieldErrors={fieldErrors}
            />
          ) : null}

          {currentStep === 2 ? (
            <ReportStepItemDetails
              formId={formId}
              descriptionMode={descriptionMode}
              onDescriptionModeChange={setDescriptionMode}
              description={description}
              onDescriptionChange={handleDescriptionChange}
              distinctiveFeaturesMode={distinctiveFeaturesMode}
              onDistinctiveFeaturesModeChange={setDistinctiveFeaturesMode}
              distinctiveFeatures={distinctiveFeatures}
              onDistinctiveFeaturesChange={setDistinctiveFeatures}
              imageFile={imageFile}
              imagePreview={imagePreview}
              onImageChange={handleImageChange}
              isProcessingImage={isProcessingImage}
              captionFromAi={captionFromAi}
              embeddingVector={embeddingVector}
              fieldErrors={fieldErrors}
            />
          ) : null}

          {currentStep === 3 ? (
            <ReportStepLocationContact
              formId={formId}
              locationName={locationName}
              onLocationNameChange={(e) => setLocationName(e.target.value)}
              locationCoordinates={locationCoordinates}
              onPrimaryMapSelect={handlePrimaryMapSelect}
              onPrimaryUseMyLocation={handlePrimaryUseMyLocation}
              isLocatingPrimary={isLocatingPrimary}
              secondaryLocationName={secondaryLocationName}
              onSecondaryLocationNameChange={(e) => setSecondaryLocationName(e.target.value)}
              secondaryLocationCoordinates={secondaryLocationCoordinates}
              onSecondaryMapSelect={handleSecondaryMapSelect}
              onSecondaryUseMyLocation={handleSecondaryUseMyLocation}
              isLocatingSecondary={isLocatingSecondary}
              contactPreference={contactPreference}
              onContactPreferenceChange={setContactPreference}
              fieldErrors={fieldErrors}
            />
          ) : null}

          {currentStep === 4 ? (
            <ReportStepReview
              reportType={reportType}
              title={title}
              brand={brand}
              colors={colors}
              category={category}
              date={date}
              locationName={locationName}
              secondaryLocationName={secondaryLocationName}
              secondaryLocationCoordinates={secondaryLocationCoordinates}
              description={description}
              distinctiveFeatures={distinctiveFeatures}
              contactLabel={contactLabel}
              imageFile={imageFile}
              isOnline={isOnline}
              onGoToStep={(step) => {
                setGenericError(null);
                setCurrentStep(step);
              }}
            />
          ) : null}
        </div>
      </form>

      <footer className="fixed bottom-0 left-0 w-full bg-surface/80 backdrop-blur-xl px-margin-mobile py-md flex items-center gap-md shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-40">
        {currentStep === 1 ? (
          <Link
            to="/dashboard"
            className="flex-1 h-14 rounded-xl border border-outline text-on-surface font-label-sm active:scale-95 transition-transform duration-200 flex items-center justify-center"
          >
            Cancel
          </Link>
        ) : (
          <button
            type="button"
            onClick={handlePrevious}
            className="flex-1 h-14 rounded-xl border border-outline text-on-surface font-label-sm active:scale-95 transition-transform duration-200 flex items-center justify-center gap-xs"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Back
          </button>
        )}

        {isLastStep ? (
          <button
            type="submit"
            form={formId}
            disabled={isSubmitting}
            className="flex-[2] h-14 rounded-xl bg-primary text-on-primary font-label-sm shadow-lg active:scale-95 transition-transform duration-200 flex items-center justify-center gap-xs disabled:opacity-60"
          >
            {isSubmitting ? 'Submitting…' : 'Submit Report'}
            {!isSubmitting ? <span className="material-symbols-outlined">check</span> : null}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canGoNext}
            title={
              !canGoNext
                ? 'Complete this step (required fields and map pin where needed) to continue.'
                : undefined
            }
            className="flex-[2] h-14 rounded-xl bg-primary text-on-primary font-label-sm shadow-lg active:scale-95 transition-transform duration-200 flex items-center justify-center gap-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        )}
      </footer>
    </div>
  );
}
