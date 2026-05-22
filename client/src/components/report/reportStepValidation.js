/** Per-step validation — returns field error map (empty = valid). */
export function validateReportStep(step, values) {
  switch (step) {
    case 1: {
      const next = {};
      if (!values.reportType) next.reportType = 'Report type is required';
      if (!values.title?.trim()) next.title = 'Title is required';
      if (!values.category) next.category = 'Category is required';
      if (!values.date) next.date = 'Date is required';
      return next;
    }
    case 2: {
      const next = {};
      if (values.isProcessingImage) {
        next.processing = 'Please wait while your photo finishes processing.';
      }
      if (values.fieldErrors?.image) {
        next.image = values.fieldErrors.image;
      }
      return next;
    }
    case 3: {
      const next = {};
      if (!values.locationName?.trim()) {
        next.locationName = 'Location name is required';
      } else if (!values.locationCoordinates) {
        next.locationName = 'Pin a location on the map or use “My location”.';
      }
      return next;
    }
    default:
      return {};
  }
}

/** True when the user may leave this step via Next (no blocking validation errors). */
export function isReportStepComplete(step, values) {
  return Object.keys(validateReportStep(step, values)).length === 0;
}

export function validateFullReport(values) {
  const step1 = validateReportStep(1, values);
  const step3 = validateReportStep(3, values);
  return { ...step1, ...step3 };
}
