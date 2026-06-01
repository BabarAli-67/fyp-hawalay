import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getMessages } from '../api/chatService.js';
import {
  BOTTOM_NAV_OFFSET_CLASS,
  shouldShowBottomNav,
} from '../components/layout/BottomNav.jsx';
import { PeerAvatar } from '../components/chat/PeerAvatar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

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

/**
 * Match chat — REST history + Socket.io (chat:join, chat:send, chat:message, chat:typing, chat:read).
 */
export default function ChatPage() {
  const { id: matchId } = useParams();
  const { pathname } = useLocation();
  const { user, socket } = useAuth();
  const currentUserId = user?._id ? String(user._id) : '';
  const hasBottomNav = shouldShowBottomNav(pathname, user);

  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [typingLabel, setTypingLabel] = useState('');

  const listRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingStopRef = useRef(null);
  const matchIdRef = useRef(matchId);

  matchIdRef.current = matchId;

  const otherParticipant = participants.find((p) => String(p._id) !== currentUserId);
  const peerUserId = otherParticipant?._id ? String(otherParticipant._id) : '';
  const peerName = otherParticipant?.name || 'Chat';

  const scrollToBottom = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const markRead = useCallback(() => {
    if (!socket?.connected || !matchIdRef.current || accessDenied) return;
    socket.emit('chat:read', { matchId: matchIdRef.current });
  }, [socket, accessDenied]);

  useEffect(() => {
    if (!matchId) {
      setIsLoading(false);
      setAccessDenied(true);
      return;
    }

    let cancelled = false;

    async function loadHistory() {
      setIsLoading(true);
      setAccessDenied(false);
      setLoadError(null);
      try {
        const { data } = await getMessages(matchId);
        if (cancelled) return;
        const rows = Array.isArray(data?.messages) ? data.messages : [];
        setMessages(rows.map(normalizeApiMessage));
        setParticipants(Array.isArray(data?.participants) ? data.participants : []);
      } catch (err) {
        if (cancelled) return;
        if (isAccessDeniedError(err)) {
          setAccessDenied(true);
          setMessages([]);
        } else {
          setLoadError(err?.response?.data?.error || 'Could not load messages');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

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
      markRead();
    };

    const onReconnect = () => {
      joinRoom();
    };

    if (socket.connected) {
      joinRoom();
    }
    socket.on('connect', joinRoom);
    socket.on('chat:joined', onJoined);
    window.addEventListener('hawalay:socket-reconnected', onReconnect);

    return () => {
      socket.off('connect', joinRoom);
      socket.off('chat:joined', onJoined);
      window.removeEventListener('hawalay:socket-reconnected', onReconnect);
    };
  }, [socket, matchId, accessDenied, markRead]);

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
      }
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:read', handleRead);
    socket.on('chat:error', handleChatError);

    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:read', handleRead);
      socket.off('chat:error', handleChatError);
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
      if (!socket?.connected || !matchId || accessDenied) return;
      socket.emit('chat:typing', { matchId, isTyping });
    },
    [socket, matchId, accessDenied],
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
    if (!text || !socket || !matchId || accessDenied) return;

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
    <div className="bg-surface text-on-surface font-body-md selection:bg-primary-container min-h-screen flex flex-col">
      <header className="fixed top-0 left-0 w-full z-50 flex items-center px-margin-mobile h-16 bg-surface/70 dark:bg-inverse-surface/70 glass-header shadow-sm border-b border-outline-variant/20">
        <div className="flex items-center gap-3 w-full">
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
              {typingLabel || 'Match chat'}
            </span>
          </div>
        </div>
      </header>

      <main
        ref={listRef}
        className={`flex-1 flex flex-col pt-20 px-gutter-mobile min-h-0 overflow-y-auto space-y-lg ${
          hasBottomNav ? 'pb-44' : 'pb-28'
        }`}
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

        <div ref={bottomRef} />
      </main>

      <footer
        className={`fixed left-0 w-full z-40 p-4 bg-surface/70 glass-header flex flex-col gap-2 border-t border-outline-variant/20 ${
          hasBottomNav ? BOTTOM_NAV_OFFSET_CLASS : 'bottom-0'
        }`}
      >
        <form onSubmit={handleSend} className="flex items-end gap-3">
          <div className="flex-1 relative flex items-center">
            <textarea
              className="w-full min-h-[48px] max-h-32 bg-surface-container-lowest border-none rounded-2xl px-4 py-3 text-on-surface placeholder:text-outline-variant focus:ring-2 focus:ring-primary/20 shadow-inner resize-none"
              placeholder="Type a message..."
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
              disabled={isLoading || Boolean(loadError)}
              aria-label="Message"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || Boolean(loadError) || !draft.trim()}
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
  );
}
