import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  getNotifications,
  markAllRead,
  markAsRead,
} from '../api/notificationsService.js';
import { Logo } from '../components/Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'matches', label: 'Matches' },
  { id: 'messages', label: 'Messages' },
  { id: 'system', label: 'System' },
];

function formatNotificationTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

function typeMeta(type) {
  if (type === 'match_found') {
    return {
      title: 'Match Alert',
      icon: 'travel_explore',
      iconClass: 'bg-primary-container/20 text-primary',
      borderClass: 'border-l-4 border-primary-container',
    };
  }
  if (type === 'system') {
    return {
      title: 'System',
      icon: 'info',
      iconClass: 'bg-surface-variant text-outline',
      borderClass: '',
    };
  }
  return {
    title: 'Notification',
    icon: 'notifications',
    iconClass: 'bg-surface-container-high text-on-surface-variant',
    borderClass: '',
  };
}

function NotificationSkeleton() {
  return (
    <div className="space-y-md" role="status" aria-label="Loading notifications">
      {[0, 1, 2].map((key) => (
        <div
          key={key}
          className="animate-pulse p-md bg-surface-container-lowest rounded-xl shadow-sm flex gap-md items-start"
        >
          <div className="w-12 h-12 shrink-0 rounded-lg bg-surface-container" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded bg-surface-container" />
            <div className="h-3 w-full rounded bg-surface-container" />
            <div className="h-3 w-4/5 rounded bg-surface-container" />
          </div>
        </div>
      ))}
    </div>
  );
}

function matchesFilter(notification, filterId) {
  if (filterId === 'all') return true;
  if (filterId === 'matches') return notification.type === 'match_found';
  if (filterId === 'system') return notification.type === 'system';
  if (filterId === 'messages') return false;
  return true;
}

export default function NotificationsPage() {
  const { fetchUnreadCount } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getNotifications(1, 20);
      setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
      setUnread(Number(data?.unread) || 0);
    } catch (err) {
      const message = err?.response?.data?.error || 'Could not load notifications';
      setLoadError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    fetchUnreadCount();
  }, [loadNotifications, fetchUnreadCount]);

  const filteredNotifications = useMemo(
    () => notifications.filter((n) => matchesFilter(n, activeFilter)),
    [notifications, activeFilter],
  );

  async function handleMarkAllRead() {
    if (unread === 0) return;

    const previous = notifications;
    setMarkingAll(true);
    setNotifications((list) => list.map((n) => ({ ...n, isRead: true })));
    setUnread(0);

    try {
      await markAllRead();
      fetchUnreadCount();
    } catch (err) {
      setNotifications(previous);
      setUnread(previous.filter((n) => !n.isRead).length);
      toast.error(err?.response?.data?.error || 'Could not mark all as read');
    } finally {
      setMarkingAll(false);
    }
  }

  function handleMarkRead(notificationId) {
    const target = notifications.find((n) => n._id === notificationId);
    if (!target || target.isRead) return;

    setNotifications((list) =>
      list.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n)),
    );
    setUnread((count) => Math.max(0, count - 1));

    markAsRead(notificationId)
      .then(() => {
        fetchUnreadCount();
      })
      .catch((err) => {
        setNotifications((list) =>
          list.map((n) => (n._id === notificationId ? { ...n, isRead: false } : n)),
        );
        setUnread((count) => count + 1);
        toast.error(err?.response?.data?.error || 'Could not mark as read');
      });
  }

  return (
    <div className="bg-background text-on-surface min-h-screen pb-32">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile h-16 bg-surface/70 backdrop-blur-lg shadow-sm">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <h1 className="font-h2 text-h2 font-bold text-primary">Hawalay</h1>
        </div>
        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:opacity-80 transition-opacity active:scale-95 duration-200"
        >
          <span className="material-symbols-outlined" data-icon="settings">
            settings
          </span>
        </button>
      </header>

      <main className="pt-24 px-margin-mobile max-w-2xl mx-auto">
        <section className="mb-lg">
          <div className="flex flex-wrap items-center justify-between gap-sm mb-md">
            <h2 className="font-h1 text-h1 text-on-surface">Alerts</h2>
            {unread > 0 ? (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markingAll || isLoading}
                className="font-label-sm text-primary hover:underline disabled:opacity-50 transition-all"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="flex gap-xs overflow-x-auto pb-2 no-scrollbar">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={`px-md py-xs rounded-full font-label-sm whitespace-nowrap active:scale-95 transition-all ${
                  activeFilter === filter.id
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>

        {isLoading ? <NotificationSkeleton /> : null}

        {!isLoading && loadError ? (
          <div
            className="rounded-xl border border-outline-variant/30 bg-error-container px-md py-md text-center"
            role="alert"
          >
            <p className="font-body-md text-on-error-container mb-sm">{loadError}</p>
            <button
              type="button"
              onClick={loadNotifications}
              className="font-label-sm text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : null}

        {!isLoading && !loadError && filteredNotifications.length === 0 ? (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-md py-xl text-center">
            <span
              className="material-symbols-outlined text-[48px] text-on-surface-variant mb-sm block"
              data-icon="notifications_off"
            >
              notifications_off
            </span>
            <p className="font-h3 text-h3 text-on-surface mb-xs">No notifications yet</p>
            <p className="font-body-md text-on-surface-variant">
              {activeFilter === 'all'
                ? 'Match alerts will appear here when we find similar items.'
                : 'Nothing in this category right now.'}
            </p>
          </div>
        ) : null}

        {!isLoading && !loadError && filteredNotifications.length > 0 ? (
          <div className="space-y-md">
            {filteredNotifications.map((notification) => {
              const meta = typeMeta(notification.type);
              const itemTitle = notification.item?.title?.trim();
              const headline = itemTitle || meta.title;
              const itemId = notification.relatedItemId;
              const matchId = notification.relatedMatchId;

              return (
                <article
                  key={notification._id}
                  className={`relative group p-md rounded-xl shadow-sm flex gap-md items-start transition-all ${
                    notification.isRead
                      ? 'bg-surface-container-lowest'
                      : 'bg-blue-50 border border-blue-100/80'
                  } ${!notification.isRead ? meta.borderClass : ''}`}
                >
                  <div
                    className={`w-12 h-12 shrink-0 rounded-lg flex items-center justify-center ${meta.iconClass}`}
                  >
                    <span className="material-symbols-outlined text-[28px]" data-icon={meta.icon}>
                      {meta.icon}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-sm mb-1">
                      <h3 className="font-h3 text-h3 text-on-surface truncate">{headline}</h3>
                      <span className="font-caption text-caption text-outline shrink-0">
                        {formatNotificationTime(notification.createdAt)}
                      </span>
                    </div>

                    <p className="font-body-md text-body-md text-on-surface-variant mb-md leading-relaxed">
                      {notification.message}
                    </p>

                    <div className="flex items-center gap-md flex-wrap">
                      {itemId ? (
                        <Link
                          to={`/item/${itemId}`}
                          className="font-label-sm text-primary hover:underline transition-all"
                        >
                          View your report
                        </Link>
                      ) : null}
                      {notification.type === 'match_found' && itemId ? (
                        <Link
                          to={`/matches/ai/${itemId}`}
                          className="font-label-sm text-primary hover:underline transition-all"
                        >
                          View Match
                        </Link>
                      ) : null}
                      {matchId ? (
                        <Link
                          to={`/chat/${matchId}`}
                          className="font-label-sm text-primary hover:underline transition-all"
                        >
                          Open chat
                        </Link>
                      ) : null}
                      {!notification.isRead ? (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(notification._id)}
                          className="font-label-sm text-outline hover:text-on-surface-variant transition-all"
                        >
                          Mark as read
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {!notification.isRead ? (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary-container" />
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : null}
      </main>

      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-safe h-20 bg-surface/70 backdrop-blur-xl shadow-lg rounded-t-xl">
        <Link
          to="/dashboard"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-high/50 rounded-xl transition-all active:scale-98"
        >
          <span className="material-symbols-outlined" data-icon="home">
            home
          </span>
          <span className="font-label-sm text-label-sm">Home</span>
        </Link>
        <Link
          to="/matches"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-high/50 rounded-xl transition-all active:scale-98"
        >
          <span className="material-symbols-outlined" data-icon="search">
            search
          </span>
          <span className="font-label-sm text-label-sm">Search</span>
        </Link>
        <Link
          to="/report"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-high/50 rounded-xl transition-all active:scale-98"
        >
          <span className="material-symbols-outlined text-primary text-[32px]" data-icon="add_circle">
            add_circle
          </span>
          <span className="font-label-sm text-label-sm">Report</span>
        </Link>
        <div className="flex flex-col items-center justify-center text-primary font-bold transition-all active:scale-98">
          <span className="material-symbols-outlined" data-icon="notifications" style={{ fontVariationSettings: "'FILL' 1" }}>
            notifications
          </span>
          <span className="font-label-sm text-label-sm">Alerts</span>
        </div>
        <Link
          to="/profile"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-high/50 rounded-xl transition-all active:scale-98"
        >
          <span className="material-symbols-outlined" data-icon="person">
            person
          </span>
          <span className="font-label-sm text-label-sm">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
