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

export const CONDITION_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'Excellent', label: 'Excellent' },
  { value: 'Good', label: 'Good' },
  { value: 'Fair', label: 'Fair' },
  { value: 'Worn', label: 'Worn' },
  { value: 'Damaged', label: 'Damaged' },
];
