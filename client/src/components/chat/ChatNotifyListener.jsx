import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

function previewContent(content, maxLen = 72) {
  const text = typeof content === 'string' ? content.trim() : '';
  if (!text) return 'New message';
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

/**
 * Global in-app alert when a chat message arrives while the user is not in that room.
 */
export function ChatNotifyListener({ onUnreadIncrement }) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    function handleChatNotify(event) {
      const payload = event.detail ?? {};
      const matchId = payload.matchId ? String(payload.matchId) : '';
      if (!matchId) return;

      const viewingThisRoom = location.pathname === `/chat/${matchId}`;
      if (viewingThisRoom) return;

      const senderName = payload.senderName ? String(payload.senderName).trim() : 'Someone';
      const preview = previewContent(payload.content);
      const messageId = payload._id ? String(payload._id) : matchId;

      toast.info(
        <button
          type="button"
          className="text-left w-full bg-transparent border-0 p-0 cursor-pointer"
          onClick={() => navigate(`/chat/${matchId}`)}
        >
          <span className="font-label-sm font-bold block">{senderName}</span>
          <span className="font-body-md block mt-0.5">{preview}</span>
        </button>,
        {
          toastId: `chat-notify-${messageId}`,
          autoClose: 6000,
          onClick: () => navigate(`/chat/${matchId}`),
        },
      );

      onUnreadIncrement?.();
      window.dispatchEvent(new CustomEvent('hawalay:refresh-chats'));
    }

    window.addEventListener('hawalay:chat-notify', handleChatNotify);
    return () => window.removeEventListener('hawalay:chat-notify', handleChatNotify);
  }, [location.pathname, navigate, onUnreadIncrement]);

  return null;
}

export default ChatNotifyListener;
