export function mapValidationErrors(errors) {
  const next = {};
  if (Array.isArray(errors)) {
    for (const item of errors) {
      if (item?.field) next[item.field] = item.message;
    }
  }
  return next;
}
