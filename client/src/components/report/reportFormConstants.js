export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);

export const CATEGORIES = [
  { value: 'Electronics', label: 'Electronics' },
  { value: 'Clothing', label: 'Clothing' },
  { value: 'Documents', label: 'Documents' },
  { value: 'Accessories', label: 'Accessories' },
  { value: 'Other', label: 'Other' },
];

export const BRAND_SUGGESTIONS = ['Apple', 'Samsung', 'Nike', 'Lenovo', 'Sony', 'HP', 'Dell', 'Adidas'];

export const DESCRIPTION_MODES = [
  { value: 'manual', label: 'Write yourself' },
  { value: 'ai', label: 'Extract from Image' },
];

export const FEATURES_MODES = [
  { value: 'manual', label: 'Write yourself' },
  { value: 'ai', label: 'Extract from Image' },
];

export const REPORT_STEPS = [
  { id: 1, label: 'Basic info' },
  { id: 2, label: 'Item details' },
  { id: 3, label: 'Location' },
  { id: 4, label: 'Review' },
];

export const TOTAL_REPORT_STEPS = REPORT_STEPS.length;
