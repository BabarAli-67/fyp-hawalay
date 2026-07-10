import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { prefetchChatMessages } from '../api/chatService.js';
import { ChatInboxFilterPanel } from '../components/chat/ChatInboxFilterPanel.jsx';
import { ChatInboxToolbar } from '../components/chat/ChatInboxToolbar.jsx';
import { ChatRoomListItem, ChatRoomListSkeleton } from '../components/chat/ChatRoomListItem.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getCachedRooms } from '../utils/chatCache.js';
import {
  INBOX_SORT,
  INBOX_TABS,
  INBOX_TYPE_FILTER,
  countInboxUnread,
  filterInboxRooms,
} from '../utils/chatInboxFilters.js';
import { getRoomUnreadCount } from '../utils/chatRoomDisplay.js';

const SEARCH_DEBOUNCE_MS = 250;

/**
 * Inbox of match chat rooms for the logged-in user.
 */
export default function ChatsPage() {
  const { user, socket, fetchChatInbox } = useAuth();
  const currentUserId = user?._id ? String(user._id) : '';

  const [rooms, setRooms] = useState(() => getCachedRooms() ?? []);
  const [isLoading, setIsLoading] = useState(() => getCachedRooms() === null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [activeTab, setActiveTab] = useState(INBOX_TABS.ALL);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState(INBOX_SORT.RECENT);
  const [typeFilter, setTypeFilter] = useState(INBOX_TYPE_FILTER.ALL);

  const refreshTimerRef = useRef(null);
  const searchDebounceRef = useRef(null);

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = window.setTimeout(() => {
      setSearchQuery(searchInput);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchInput]);

  const loadRooms = useCallback(async ({ background = false } = {}) => {
    if (!background && getCachedRooms() === null) {
      setIsLoading(true);
    } else if (background) {
      setIsRefreshing(true);
    }
    setLoadError(null);
    try {
      const rows = await fetchChatInbox();
      setRooms(rows);
    } catch (err) {
      const message = err?.response?.data?.error || 'Could not load chats';
      if (!background || getCachedRooms() === null) {
        setLoadError(message);
        setRooms([]);
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchChatInbox]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      loadRooms({ background: true });
    }, 400);
  }, [loadRooms]);

  useEffect(() => {
    const hasCache = getCachedRooms() !== null;
    loadRooms({ background: hasCache });
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [loadRooms]);

  useEffect(() => {
    if (!socket) return undefined;

    socket.on('chat:message', scheduleRefresh);
    window.addEventListener('hawalay:refresh-chats', scheduleRefresh);
    window.addEventListener('hawalay:chat-notify', scheduleRefresh);
    window.addEventListener('hawalay:match-found', scheduleRefresh);

    return () => {
      socket.off('chat:message', scheduleRefresh);
      window.removeEventListener('hawalay:refresh-chats', scheduleRefresh);
      window.removeEventListener('hawalay:chat-notify', scheduleRefresh);
      window.removeEventListener('hawalay:match-found', scheduleRefresh);
    };
  }, [socket, scheduleRefresh]);

  const totalUnreadMessages = useMemo(() => countInboxUnread(rooms), [rooms]);

  const visibleRooms = useMemo(
    () =>
      filterInboxRooms(rooms, {
        tab: activeTab,
        searchQuery,
        typeFilter,
        sort,
        currentUserId,
      }),
    [rooms, activeTab, searchQuery, typeFilter, sort, currentUserId],
  );

  const unreadRoomCount = useMemo(
    () => rooms.filter((room) => getRoomUnreadCount(room) > 0).length,
    [rooms],
  );

  const hasActiveFilters =
    searchQuery.trim() ||
    activeTab === INBOX_TABS.UNREAD ||
    sort !== INBOX_SORT.RECENT ||
    typeFilter !== INBOX_TYPE_FILTER.ALL;

  function clearAllFilters() {
    setSearchInput('');
    setSearchQuery('');
    setActiveTab(INBOX_TABS.ALL);
    setSort(INBOX_SORT.RECENT);
    setTypeFilter(INBOX_TYPE_FILTER.ALL);
    setFilterOpen(false);
  }

  return (
    <div className="bg-background text-on-background min-h-screen pb-24">
      <div className="px-margin-mobile max-w-2xl mx-auto">
        <section className="mb-1 mt-3">
          <div className="flex items-baseline justify-between gap-sm">
            <h2 className="font-h1 text-h1 text-on-surface">Messages</h2>
            {isRefreshing ? (
              <span className="font-caption text-caption text-outline shrink-0" aria-live="polite">
                Updating…
              </span>
            ) : null}
          </div>
        </section>

        <div className="mb-sm">
          <ChatInboxToolbar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            allCount={rooms.length}
            unreadCount={unreadRoomCount}
            searchQuery={searchInput}
            onSearchChange={setSearchInput}
            filterOpen={filterOpen}
            onFilterToggle={() => setFilterOpen((open) => !open)}
          />
          {filterOpen ? (
            <div className="mt-sm">
              <ChatInboxFilterPanel
                sort={sort}
                typeFilter={typeFilter}
                onSortChange={setSort}
                onTypeFilterChange={setTypeFilter}
                onReset={() => {
                  setSort(INBOX_SORT.RECENT);
                  setTypeFilter(INBOX_TYPE_FILTER.ALL);
                }}
              />
            </div>
          ) : null}
        </div>

        {isLoading ? (
          <div className="space-y-xs">
            <ChatRoomListSkeleton />
            <ChatRoomListSkeleton />
            <ChatRoomListSkeleton />
          </div>
        ) : null}

        {!isLoading && loadError ? (
          <div
            className="rounded-xl border border-outline-variant/30 bg-error-container px-md py-md text-center"
            role="alert"
          >
            <p className="font-body-md text-on-error-container mb-sm">{loadError}</p>
            <button
              type="button"
              onClick={() => loadRooms()}
              className="font-label-sm text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : null}

        {!isLoading && !loadError && rooms.length === 0 ? (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-md py-xl text-center">
            <span
              className="material-symbols-outlined text-[48px] text-on-surface-variant mb-sm block"
              data-icon="forum"
            >
              forum
            </span>
            <p className="font-h3 text-h3 text-on-surface mb-xs">No conversations yet</p>
            <p className="font-body-md text-on-surface-variant mb-md">
              When you get a match, your chat rooms will show up here.
            </p>
            <Link to="/notifications" className="font-label-sm text-primary hover:underline">
              Check match alerts
            </Link>
          </div>
        ) : null}

        {!isLoading && !loadError && rooms.length > 0 && visibleRooms.length === 0 ? (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-md py-xl text-center">
            <span
              className="material-symbols-outlined text-[40px] text-on-surface-variant mb-sm block"
              aria-hidden
            >
              search_off
            </span>
            <p className="font-h3 text-h3 text-on-surface mb-xs">No matching conversations</p>
            <p className="font-body-md text-on-surface-variant mb-md">
              {activeTab === INBOX_TABS.UNREAD
                ? 'You are all caught up — no unread chats right now.'
                : 'Try a different search term or adjust your filters.'}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="font-label-sm text-primary hover:underline"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : null}

        {!isLoading && !loadError && visibleRooms.length > 0 ? (
          <ul className="space-y-xs" aria-label="Chat rooms">
            {visibleRooms.map((room) => (
              <li key={String(room.matchId)}>
                <ChatRoomListItem
                  room={room}
                  currentUserId={currentUserId}
                  onPrefetch={prefetchChatMessages}
                />
              </li>
            ))}
          </ul>
        ) : null}

        {!isLoading && totalUnreadMessages > 0 ? (
          <p className="sr-only" aria-live="polite">
            {totalUnreadMessages} unread messages across your conversations
          </p>
        ) : null}
      </div>
    </div>
  );
}
