/**
 * Human-readable member-since line for profile hero (from User.createdAt).
 */
export function formatMemberSince(createdAt) {
  if (createdAt == null || createdAt === '') {
    return 'Community member';
  }

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return 'Community member';
  }

  const formatted = date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  return `Community Guardian since ${formatted}`;
}
