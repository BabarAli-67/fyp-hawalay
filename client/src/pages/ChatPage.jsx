import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { fetchAndCacheMessages } from '../api/chatService.js';
import { deleteCachedMessages, getCachedMessages, setCachedMessages } from '../utils/chatCache.js';
import { shouldShowBottomNav } from '../components/layout/BottomNav.jsx';
import { PeerAvatar } from '../components/chat/PeerAvatar.jsx';
import { ReturnVerificationPanel } from '../components/matches/ReturnVerificationPanel.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useOfflineQueue } from '../hooks/useOfflineQueue.js';

function formatTime(value) {
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

function normalizeReadBy(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((id) => String(id));
}

function normalizeApiMessage(msg) {
  const sender = msg.sender || {};
  return {
    _id: msg._id,
    matchId: msg.chatRoomId,
    senderId: sender._id ?? msg.senderId,
    senderName: sender.name || 'User',
    content: msg.content || '',
    readBy: normalizeReadBy(msg.readBy),
    createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
  };
}

function normalizeSocketMessage(msg) {
  return {
    _id: msg._id,
    matchId: msg.matchId,
    senderId: msg.senderId,
    senderName: msg.senderName || 'User',
    content: msg.content || '',
    readBy: normalizeReadBy(msg.readBy),
    createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
  };
}

function isAccessDeniedError(err) {
  const status = err?.response?.status;
  return status === 403 || status === 404 || status === 400;
}

function isReadByPeer(msg, peerUserId) {
  if (!peerUserId) return false;
  return msg.readBy?.some((id) => String(id) === String(peerUserId));
}

function isPendingMessage(msg) {
  return String(msg._id).startsWith('opt-');
}

function runAfterLayout(fn) {
  requestAnimationFrame(() => {
    requestAnimationFrame(fn);
  });
}

function dedupeMessagesById(messages) {
  const byId = new Map();
  for (const msg of messages) {
    byId.set(String(msg._id), msg);
  }
  return [...byId.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function applyServerHistory(data) {
  const rows = Array.isArray(data?.messages) ? data.messages : [];
  const messages = dedupeMessagesById(rows.map(normalizeApiMessage));
  const participants = Array.isArray(data?.participants) ? data.participants : [];
  return { messages, participants, returnVerification: data?.returnVerification ?? null };
}

/** Server history wins for persisted ids; keep in-flight optimistic sends. */
function mergeMessageLists(current, serverMessages) {
  const byId = new Map();
  for (const msg of serverMessages) {
    byId.set(String(msg._id), msg);
  }
  for (const msg of current) {
    if (isPendingMessage(msg)) {
      byId.set(String(msg._id), msg);
    }
  }
  return [...byId.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

/**
 * Match chat — REST history + Socket.io (chat:join, chat:send, chat:message, chat:typing, chat:read).
 */
export default function ChatPage() {
  const { id: matchId } = useParams();
  const { pathname } = useLocation();
  const { user, socket } = useAuth();
  const { isOnline } = useOfflineQueue();
  const currentUserId = user?._id ? String(user._id) : '';
  const hasBottomNav = shouldShowBottomNav(pathname, user);
  const chatPanelTopClass = isOnline ? 'top-20' : 'top-32';
  const chatPanelBottomClass = hasBottomNav ? 'bottom-20' : 'bottom-0';
  const flowSpacerClass = isOnline
    ? hasBottomNav
      ? 'h-[calc(100dvh-10rem)]'
      : 'h-[calc(100dvh-5rem)]'
    : hasBottomNav
      ? 'h-[calc(100dvh-13rem)]'
      : 'h-[calc(100dvh-8rem)]';

  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [returnVerification, setReturnVerification] = useState(null);
  const [isChatLocked, setIsChatLocked] = useState(false);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [typingLabel, setTypingLabel] = useState('');

  const listRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingStopRef = useRef(null);
  const matchIdRef = useRef(matchId);
  const snapScrollRef = useRef(true);
  const fetchGenerationRef = useRef(0);
  const reconnectGenerationRef = useRef(0);
  const wasDisconnectedRef = useRef(false);
  const reconnectFetchInflightRef = useRef(false);
  const inboxRefreshTimerRef = useRef(null);

  useEffect(
    () => () => {
      if (inboxRefreshTimerRef.current) {
        clearTimeout(inboxRefreshTimerRef.current);
      }
    },
    [],
  );

  matchIdRef.current = matchId;

  const otherParticipant = participants.find((p) => String(p._id) !== currentUserId);
  const peerUserId = otherParticipant?._id ? String(otherParticipant._id) : '';
  const peerName = otherParticipant?.name || 'Chat';

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    const list = listRef.current;
    const anchor = bottomRef.current;
    if (!list) return;

    const applyScroll = () => {
      if (anchor) {
        anchor.scrollIntoView({ behavior, block: 'end' });
      }
      list.scrollTop = list.scrollHeight;
    };

    applyScroll();
    runAfterLayout(applyScroll);
  }, []);

  useEffect(() => {
    snapScrollRef.current = true;
  }, [matchId]);

  useLayoutEffect(() => {
    if (isLoading || accessDenied) return;

    const behavior = snapScrollRef.current ? 'auto' : 'smooth';
    scrollToBottom(behavior);
    snapScrollRef.current = false;
  }, [messages, isLoading, typingLabel, draft, accessDenied, scrollToBottom]);

  const markRead = useCallback(() => {
    if (!socket?.connected || !matchIdRef.current || accessDenied) return;
    socket.emit('chat:read', { matchId: matchIdRef.current });
    if (inboxRefreshTimerRef.current) {
      clearTimeout(inboxRefreshTimerRef.current);
    }
    inboxRefreshTimerRef.current = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('hawalay:refresh-chats'));
      inboxRefreshTimerRef.current = null;
    }, 600);
  }, [socket, accessDenied]);

  useEffect(() => {
    if (!matchId) {
      setIsLoading(false);
      setAccessDenied(true);
      return;
    }

    const fetchGeneration = fetchGenerationRef.current + 1;
    fetchGenerationRef.current = fetchGeneration;
    wasDisconnectedRef.current = false;

    let cancelled = false;
    const cached = getCachedMessages(matchId);

    if (cached) {
      setMessages(dedupeMessagesById(cached.messages.map(normalizeApiMessage)));
      setParticipants(cached.participants);
      setReturnVerification(cached.returnVerification ?? null);
      setIsChatLocked(Boolean(cached.returnVerification?.returnCompleted));
      setIsLoading(false);
      setIsRefreshing(true);
    } else {
      setMessages([]);
      setParticipants([]);
      setReturnVerification(null);
      setIsChatLocked(false);
      setIsLoading(true);
      setIsRefreshing(false);
    }
    setAccessDenied(false);
    setLoadError(null);

    async function loadHistory() {
      if (!cached) {
        setIsLoading(true);
      }
      setAccessDenied(false);
      setLoadError(null);
      try {
        const data = await fetchAndCacheMessages(matchId);
        if (cancelled || fetchGeneration !== fetchGenerationRef.current) return;

        const { messages: freshMessages, participants: freshParticipants, returnVerification: freshReturn } =
          applyServerHistory(data);
        setMessages(freshMessages);
        setParticipants(freshParticipants);
        setReturnVerification(freshReturn);
        setIsChatLocked(Boolean(freshReturn?.returnCompleted));
        if (matchId) {
          setCachedMessages(matchId, { ...data, returnVerification: freshReturn });
        }
        setLoadError(null);
      } catch (err) {
        if (cancelled || fetchGeneration !== fetchGenerationRef.current) return;

        deleteCachedMessages(matchId);

        if (isAccessDeniedError(err)) {
          setAccessDenied(true);
          setMessages([]);
          setParticipants([]);
        } else {
          setLoadError(err?.response?.data?.error || 'Could not load messages');
          setMessages([]);
          setParticipants([]);
        }
      } finally {
        if (!cancelled && fetchGeneration === fetchGenerationRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const refetchAndMergeHistory = useCallback(async () => {
    const roomId = matchIdRef.current;
    if (!roomId) return;

    const generation = reconnectGenerationRef.current + 1;
    reconnectGenerationRef.current = generation;

    setIsRefreshing(true);
    try {
      const data = await fetchAndCacheMessages(roomId);
      if (generation !== reconnectGenerationRef.current) return;

      const {
        messages: serverMessages,
        participants: freshParticipants,
        returnVerification: freshReturn,
      } =
        applyServerHistory(data);
      setMessages((prev) => mergeMessageLists(prev, serverMessages));
      setParticipants(freshParticipants);
      setReturnVerification(freshReturn);
      setIsChatLocked(Boolean(freshReturn?.returnCompleted));
      setLoadError(null);
    } catch {
      if (generation !== reconnectGenerationRef.current) return;
      // Keep current messages if reconnect refetch fails.
    } finally {
      if (generation === reconnectGenerationRef.current) {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isLoading && !accessDenied && socket?.connected && matchId) {
      markRead();
    }
  }, [isLoading, accessDenied, socket, matchId, markRead]);

  useEffect(() => {
    if (!socket || !matchId || accessDenied) return undefined;

    const joinRoom = () => {
      socket.emit('chat:join', { matchId });
    };

    const onJoined = (payload) => {
      if (String(payload?.matchId) !== String(matchId)) return;
      if (payload?.locked) {
        setIsChatLocked(true);
        setReturnVerification((current) =>
          current ? { ...current, returnCompleted: true, canConfirm: false } : current,
        );
      }
      markRead();
    };

    const handleSocketBackOnline = () => {
      joinRoom();
      if (!wasDisconnectedRef.current) return;
      wasDisconnectedRef.current = false;
      if (reconnectFetchInflightRef.current) return;
      reconnectFetchInflightRef.current = true;
      refetchAndMergeHistory().finally(() => {
        reconnectFetchInflightRef.current = false;
      });
    };

    const onDisconnect = () => {
      wasDisconnectedRef.current = true;
    };

    if (socket.connected) {
      joinRoom();
    }
    socket.on('disconnect', onDisconnect);
    socket.on('connect', handleSocketBackOnline);
    socket.on('chat:joined', onJoined);
    window.addEventListener('hawalay:socket-reconnected', handleSocketBackOnline);

    return () => {
      socket.off('disconnect', onDisconnect);
      socket.off('connect', handleSocketBackOnline);
      socket.off('chat:joined', onJoined);
      window.removeEventListener('hawalay:socket-reconnected', handleSocketBackOnline);
    };
  }, [socket, matchId, accessDenied, markRead, refetchAndMergeHistory]);

  const appendMessage = useCallback(
    (incoming) => {
      setMessages((prev) => {
        if (prev.some((m) => String(m._id) === String(incoming._id))) {
          return prev.map((m) =>
            String(m._id) === String(incoming._id)
              ? { ...m, readBy: incoming.readBy ?? m.readBy, content: incoming.content }
              : m,
          );
        }
        const isOwn = String(incoming.senderId) === currentUserId;
        const withoutStaleOptimistic = isOwn
          ? prev.filter((m) => !String(m._id).startsWith('opt-'))
          : prev;
        return [...withoutStaleOptimistic, incoming];
      });
    },
    [currentUserId],
  );

  const applyReadReceipts = useCallback((payload) => {
    const ids = Array.isArray(payload?.messageIds) ? payload.messageIds.map(String) : [];
    const readerId = payload?.readerId ? String(payload.readerId) : '';
    if (!ids.length || !readerId) return;

    setMessages((prev) =>
      prev.map((m) => {
        if (!ids.includes(String(m._id))) return m;
        const readBy = normalizeReadBy(m.readBy);
        if (readBy.includes(readerId)) return m;
        return { ...m, readBy: [...readBy, readerId] };
      }),
    );
  }, []);

  useEffect(() => {
    if (!socket || !matchId) return undefined;

    const handleMessage = (payload) => {
      if (!payload?._id || String(payload.matchId) !== String(matchId)) return;
      const normalized = normalizeSocketMessage(payload);
      appendMessage(normalized);
      if (String(payload.senderId) !== currentUserId) {
        markRead();
      }
    };

    const handleTyping = (payload) => {
      if (!payload || String(payload.matchId) !== String(matchId)) return;
      if (String(payload.userId) === currentUserId) return;

      const name =
        participants.find((p) => String(p._id) === String(payload.userId))?.name || 'Someone';

      if (payload.isTyping) {
        setTypingLabel(`${name} is typing...`);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          setTypingLabel('');
          typingTimeoutRef.current = null;
        }, 2500);
      } else {
        setTypingLabel('');
      }
    };

    const handleRead = (payload) => {
      if (String(payload?.matchId) !== String(matchId)) return;
      applyReadReceipts(payload);
    };

    const handleChatError = (payload) => {
      if (payload?.code === 'UNAUTHORIZED') {
        setAccessDenied(true);
      } else if (
        payload?.code === 'CHAT_LOCKED' &&
        String(payload?.matchId) === String(matchId)
      ) {
        setIsChatLocked(true);
        setDraft('');
        setTypingLabel('');
        setMessages((current) => current.filter((message) => !isPendingMessage(message)));
        setReturnVerification((current) =>
          current ? { ...current, returnCompleted: true, canConfirm: false } : current,
        );
      }
    };

    const handleChatLocked = (payload) => {
      if (String(payload?.matchId) !== String(matchId)) return;
      setIsChatLocked(true);
      setDraft('');
      setTypingLabel('');
      setMessages((current) => current.filter((message) => !isPendingMessage(message)));
      setReturnVerification((current) =>
        current ? { ...current, returnCompleted: true, canConfirm: false } : current,
      );
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:read', handleRead);
    socket.on('chat:error', handleChatError);
    socket.on('chat:locked', handleChatLocked);

    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:read', handleRead);
      socket.off('chat:error', handleChatError);
      socket.off('chat:locked', handleChatLocked);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [
    socket,
    matchId,
    currentUserId,
    participants,
    appendMessage,
    applyReadReceipts,
    markRead,
  ]);

  const emitTyping = useCallback(
    (isTyping) => {
      if (!socket?.connected || !matchId || accessDenied || isChatLocked) return;
      socket.emit('chat:typing', { matchId, isTyping });
    },
    [socket, matchId, accessDenied, isChatLocked],
  );

  function handleDraftChange(value) {
    setDraft(value);

    if (!value.trim()) {
      emitTyping(false);
      if (typingStopRef.current) {
        clearTimeout(typingStopRef.current);
        typingStopRef.current = null;
      }
      return;
    }

    emitTyping(true);
    if (typingStopRef.current) {
      clearTimeout(typingStopRef.current);
    }
    typingStopRef.current = setTimeout(() => {
      emitTyping(false);
      typingStopRef.current = null;
    }, 1500);
  }

  function handleSend(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !socket || !matchId || accessDenied || isChatLocked) return;

    emitTyping(false);
    if (typingStopRef.current) {
      clearTimeout(typingStopRef.current);
      typingStopRef.current = null;
    }

    const optimistic = {
      _id: `opt-${Date.now()}`,
      matchId,
      senderId: currentUserId,
      senderName: user?.name || 'You',
      content: text,
      readBy: [],
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, optimistic]);
    setDraft('');
    socket.emit('chat:send', { matchId, content: text });
  }

  function receiptIcon(msg) {
    if (isPendingMessage(msg)) {
      return 'schedule';
    }
    if (isReadByPeer(msg, peerUserId)) {
      return 'done_all';
    }
    return 'done';
  }

  if (accessDenied) {
    return (
      <div className="bg-surface text-on-surface min-h-screen flex flex-col items-center justify-center px-margin-mobile">
        <span className="material-symbols-outlined text-[48px] text-on-surface-variant mb-md">
          lock
        </span>
        <p className="font-body-md text-on-surface-variant text-center">
          You don&apos;t have access to this chat
        </p>
        <Link to="/chats" className="mt-lg font-label-sm text-primary hover:underline">
          Back to messages
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className={flowSpacerClass} aria-hidden />
      <div
        className={`fixed inset-x-0 z-30 flex flex-col overflow-hidden bg-surface text-on-surface font-body-md selection:bg-primary-container ${chatPanelTopClass} ${chatPanelBottomClass}`}
      >
      <header className="flex h-16 shrink-0 items-center border-b border-outline-variant/20 bg-surface/70 px-margin-mobile shadow-sm backdrop-blur-lg">
        <div className="flex w-full items-center gap-3">
          <Link
            to="/chats"
            className="active:scale-95 transition-transform duration-200 text-on-surface-variant"
            aria-label="Back to messages"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <PeerAvatar
            name={peerName}
            userId={peerUserId}
            avatarUrl={otherParticipant?.avatarUrl}
            size="sm"
          />
          <div className="flex flex-col min-w-0">
            <h3 className="font-h3 text-label-sm font-bold text-on-surface truncate">{peerName}</h3>
            <span className="font-caption text-on-surface-variant text-[11px]">
              {typingLabel || (isRefreshing ? 'Syncing…' : 'Match chat')}
            </span>
          </div>
        </div>
      </header>

      {returnVerification?.userRole ? (
        <div className="shrink-0 border-b border-outline-variant/20 bg-surface/70 px-gutter-mobile py-sm backdrop-blur-lg">
          <ReturnVerificationPanel
            matchId={matchId}
            returnVerification={returnVerification}
            onUpdated={(next) => {
              setReturnVerification(next);
              if (next?.returnCompleted) {
                setIsChatLocked(true);
                setDraft('');
                setTypingLabel('');
              }
            }}
            compact
          />
        </div>
      ) : null}

      <main
        ref={listRef}
        className="flex min-h-0 flex-1 flex-col space-y-lg overflow-y-auto overscroll-contain px-gutter-mobile py-md"
      >
        {isLoading ? (
          <div className="space-y-md animate-pulse" role="status" aria-label="Loading messages">
            <div className="h-12 w-2/3 rounded-2xl bg-surface-container self-start" />
            <div className="h-12 w-1/2 rounded-2xl bg-surface-container self-end ml-auto" />
            <div className="h-12 w-3/5 rounded-2xl bg-surface-container self-start" />
          </div>
        ) : null}

        {!isLoading && loadError ? (
          <p className="font-body-md text-error text-center" role="alert">
            {loadError}
          </p>
        ) : null}

        {!isLoading && !loadError && messages.length === 0 ? (
          <p className="font-body-md text-on-surface-variant text-center py-xl">
            No messages yet. Say hi!
          </p>
        ) : null}

        {!isLoading &&
          !loadError &&
          messages.map((msg) => {
            const mine = String(msg.senderId) === currentUserId;
            const icon = mine ? receiptIcon(msg) : null;
            const receiptClass = isReadByPeer(msg, peerUserId)
              ? 'text-primary-fixed-dim'
              : 'text-outline';

            return (
              <div
                key={msg._id}
                className={`flex flex-col max-w-[85%] space-y-1 ${mine ? 'items-end self-end' : 'items-start'}`}
              >
                {!mine ? (
                  <span className="font-caption text-[11px] text-on-surface-variant ml-1">
                    {msg.senderName}
                  </span>
                ) : null}
                <div
                  className={`p-md rounded-2xl message-shadow ${
                    mine
                      ? 'bg-primary text-on-primary rounded-tr-none'
                      : 'bg-surface-container-highest text-on-surface rounded-tl-none'
                  }`}
                >
                  <p className="font-body-md">{msg.content}</p>
                </div>
                <div className={`flex items-center gap-1 ${mine ? 'mr-1 justify-end' : 'ml-1'}`}>
                  <span className="font-caption text-[10px] text-outline">
                    {formatTime(msg.createdAt)}
                  </span>
                  {icon ? (
                    <span
                      className={`material-symbols-outlined text-[14px] ${receiptClass}`}
                      style={
                        icon === 'done_all' ? { fontVariationSettings: "'FILL' 1" } : undefined
                      }
                      title={
                        icon === 'done_all'
                          ? 'Seen'
                          : icon === 'done'
                            ? 'Delivered'
                            : 'Sending'
                      }
                    >
                      {icon}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}

        {typingLabel ? (
          <p className="font-caption text-on-surface-variant text-center">{typingLabel}</p>
        ) : null}

        <div ref={bottomRef} className="h-px w-full shrink-0" aria-hidden />
      </main>

      <footer className="flex shrink-0 flex-col gap-2 border-t border-outline-variant/20 bg-surface/70 p-4 backdrop-blur-lg">
        {isChatLocked ? (
          <div
            className="flex items-center justify-center gap-xs rounded-lg bg-surface-container-low px-md py-sm text-center"
            role="status"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">lock</span>
            <span className="font-caption text-on-surface-variant">
              This conversation is read-only because the item was returned.
            </span>
          </div>
        ) : null}
        <form onSubmit={handleSend} className="flex items-end gap-3">
          <div className="flex-1 relative flex items-center">
            <textarea
              className="w-full min-h-[48px] max-h-32 bg-surface-container-lowest border-none rounded-2xl px-4 py-3 text-on-surface placeholder:text-outline-variant focus:ring-2 focus:ring-primary/20 shadow-inner resize-none"
              placeholder={isChatLocked ? 'Chat locked — item returned' : 'Type a message...'}
              rows={1}
              value={draft}
              onChange={(e) => handleDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              onBlur={() => emitTyping(false)}
              disabled={isLoading || Boolean(loadError) || isChatLocked}
              aria-label="Message"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || Boolean(loadError) || isChatLocked || !draft.trim()}
            className="w-12 h-12 shrink-0 flex items-center justify-center rounded-full bg-primary text-on-primary shadow-lg shadow-primary/30 active:scale-90 transition-all disabled:opacity-50"
            aria-label="Send"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              send
            </span>
          </button>
        </form>
        <div className="h-safe" />
      </footer>
      </div>
    </>
  );
}
