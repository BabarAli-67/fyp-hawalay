const URGENT_KEYWORDS =
  /\b(med|meds|medicine|insulin|epipen|inhaler|prescription|pill|pills|glasses|hearing aid)\b/i;

/** Short all-caps tokens often used as test placeholders (AJCHS, AHVD, etc.). */
const WEAK_TITLE_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,7}$/;

function truncateTitle(value, max = 22) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= max) return text.toUpperCase();
  return `${text.slice(0, max - 1).trim().toUpperCase()}…`;
}

function isMeaningfulItemTitle(title) {
  const text = String(title || '').trim();
  if (!text) return false;
  if (text.length >= 10) return true;
  if (/\s/.test(text)) return true;
  if (WEAK_TITLE_PATTERN.test(text)) return false;
  if (text.length <= 3) return false;
  return true;
}

/**
 * Best display label for an item — prefers real titles over cryptic test strings.
 * Falls back to brand, then category, then raw title.
 */
export function resolveItemLabel(item) {
  if (!item) return null;

  const title = String(item.title || '').trim();
  const brand = String(item.brand || '').trim();
  const category = String(item.category || '').trim();

  if (isMeaningfulItemTitle(title)) {
    return truncateTitle(title);
  }
  if (brand) {
    return truncateTitle(brand);
  }
  if (category) {
    return category.toUpperCase();
  }
  if (title) {
    return truncateTitle(title);
  }
  return null;
}

function formatUrgentLostLabel(item) {
  const label = resolveItemLabel(item);
  if (!label) return 'URGENT: LOST ITEM';
  const stripped = label.replace(/^LOST\s+/i, '').trim();
  return stripped ? `URGENT: LOST ${stripped}` : 'URGENT: LOST ITEM';
}

function formatLostLabel(item) {
  const label = resolveItemLabel(item);
  if (!label) return null;
  const stripped = label.replace(/^LOST\s+/i, '').trim();
  return stripped || label;
}

function sameCalendarDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Inbox row timestamp — 10:24 AM, Yesterday, Monday, Jan 4.
 */
export function formatInboxTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  if (sameCalendarDay(date, now)) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameCalendarDay(date, yesterday)) {
    return 'Yesterday';
  }

  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays > 0 && diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: 'long' });
  }

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Chat context badge from the logged-in user's report perspective.
 * Owners (lost reports) → LOST …; finders (found reports) → FOUND …
 *
 * @returns {{ label: string, variant: 'urgent' | 'lost' | 'found' | 'neutral' }}
 */
export function buildChatBadge(room, currentUserId) {
  const myItem = room?.myItem;

  if (myItem?.reportType === 'lost') {
    const label = formatLostLabel(myItem);
    const titleForUrgent = String(myItem.title || myItem.brand || '').trim();

    if (URGENT_KEYWORDS.test(titleForUrgent)) {
      return {
        label: formatUrgentLostLabel(myItem),
        variant: 'urgent',
      };
    }

    if (label) {
      return { label: `LOST: ${label}`, variant: 'lost' };
    }
    return { label: 'REGARDING LOST ITEM', variant: 'lost' };
  }

  if (myItem?.reportType === 'found') {
    const label = resolveItemLabel(myItem);
    if (label) {
      return { label: `FOUND ${label}`, variant: 'found' };
    }
    return { label: 'FOUND ITEM', variant: 'found' };
  }

  return { label: 'MATCH CHAT', variant: 'neutral' };
}

/** High-contrast badge styles for light and dark themes. */
export const BADGE_STYLES = {
  urgent:
    'bg-error-container text-on-error-container dark:bg-red-950 dark:text-white',
  lost:
    'bg-tertiary-fixed text-on-tertiary-fixed dark:bg-amber-950 dark:text-white',
  found:
    'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-white',
  neutral:
    'bg-surface-container text-on-surface-variant dark:bg-surface-container-high dark:text-white',
};

export function previewText(room, currentUserId) {
  const last = room?.lastMessage;
  if (!last?.content) {
    return 'No messages yet — say hi';
  }
  const prefix =
    last.senderId && String(last.senderId) === String(currentUserId) ? 'You: ' : '';
  const text = String(last.content).trim();
  const combined = `${prefix}${text}`;
  return combined.length > 80 ? `${combined.slice(0, 77)}…` : combined;
}

export function getRoomUnreadCount(room) {
  if (typeof room?.unreadCount === 'number' && room.unreadCount >= 0) {
    return room.unreadCount;
  }
  return room?.unread ? 1 : 0;
}
