function validateCoreReportFields(values) {
  const errors = {};
  if (!values.reportType) errors.reportType = 'Report type is required';
  if (!values.title?.trim()) errors.title = 'Title is required';
  if (!values.category) errors.category = 'Category is required';
  if (!values.date) errors.date = 'Date is required';
  if (!values.locationName?.trim()) {
    errors.locationName = 'Location name is required';
  } else if (!values.locationCoordinates) {
    errors.locationName = 'Pin a location on the map or allow location access.';
  }
  return errors;
}

/** ReportItemPage submit validation. */
export function validateReportItemSubmit(values) {
  const errors = validateCoreReportFields(values);
  if (values.isProcessingImage) {
    errors.processing = 'Please wait while your photo finishes processing.';
  }
  if (values.fieldErrors?.image) {
    errors.image = values.fieldErrors.image;
  }
  return errors;
}
