/**
 * Real-time notifications (Step 7 in async matching flow) + match chat rooms.
 */

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Message = require('./models/Message');
const User = require('./models/User');
const { isMatchChatLocked, verifyMatchParticipant } = require('./utils/matchParticipant');

let io = null;

const MAX_MESSAGE_LENGTH = 1000;

function chatRoomName(matchId) {
  return `chat:${matchId}`;
}

function validateMessageContent(content) {
  if (typeof content !== 'string') {
    return { ok: false, reason: 'Content must be a string' };
  }
  const trimmed = content.trim();
  if (!trimmed) {
    return { ok: false, reason: 'Content cannot be empty' };
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, reason: `Content exceeds ${MAX_MESSAGE_LENGTH} characters` };
  }
  return { ok: true, content: trimmed };
}

async function markMessagesReadByUser(matchId, readerUserId) {
  const readerObjectId = new mongoose.Types.ObjectId(readerUserId);
  const roomObjectId = new mongoose.Types.ObjectId(matchId);

  const unread = await Message.find({
    chatRoomId: roomObjectId,
    senderId: { $ne: readerObjectId },
    readBy: { $nin: [readerObjectId] },
  })
    .select('_id')
    .lean();

  if (!unread.length) {
    return [];
  }

  const messageIds = unread.map((row) => row._id);

  await Message.updateMany(
    { _id: { $in: messageIds } },
    { $addToSet: { readBy: readerObjectId } },
  );

  return messageIds.map((id) => id.toString());
}

function registerChatHandlers(socket) {
  socket.on('chat:join', async (payload) => {
    try {
      const matchId = payload?.matchId;
      const access = await verifyMatchParticipant(matchId, socket.data.userId);

      if (!access.ok) {
        if (access.code === 'UNAUTHORIZED') {
          socket.emit('chat:error', { code: 'UNAUTHORIZED', matchId: matchId || null });
        } else {
          socket.emit('chat:error', { code: access.code, matchId: matchId || null });
        }
        return;
      }

      const room = chatRoomName(matchId);
      await socket.join(room);

      const roomSet = io.sockets.adapter.rooms.get(room);
      const roomSize = roomSet ? roomSet.size : 0;
      const locked = await isMatchChatLocked(access.match);

      socket.emit('chat:joined', { matchId, roomSize, locked });

      const messageIds = await markMessagesReadByUser(matchId, socket.data.userId);
      if (messageIds.length > 0) {
        socket.to(room).emit('chat:read', {
          matchId,
          readerId: socket.data.userId,
          messageIds,
        });
      }
    } catch (err) {
      console.error('[socket] chat:join failed:', err);
      socket.emit('chat:error', { code: 'SERVER_ERROR', message: 'Failed to join chat room' });
    }
  });

  socket.on('chat:read', async (payload) => {
    try {
      const matchId = payload?.matchId;
      const access = await verifyMatchParticipant(matchId, socket.data.userId);

      if (!access.ok) {
        return;
      }

      const room = chatRoomName(matchId);
      await socket.join(room);

      const messageIds = await markMessagesReadByUser(matchId, socket.data.userId);
      if (messageIds.length > 0) {
        io.to(room).emit('chat:read', {
          matchId,
          readerId: socket.data.userId,
          messageIds,
        });
      }
    } catch (err) {
      console.error('[socket] chat:read failed:', err);
    }
  });

  socket.on('chat:send', async (payload) => {
    try {
      const matchId = payload?.matchId;
      const access = await verifyMatchParticipant(matchId, socket.data.userId);

      if (!access.ok) {
        if (access.code === 'UNAUTHORIZED') {
          socket.emit('chat:error', { code: 'UNAUTHORIZED', matchId: matchId || null });
        } else {
          socket.emit('chat:error', { code: access.code, matchId: matchId || null });
        }
        return;
      }

      if (await isMatchChatLocked(access.match)) {
        socket.emit('chat:error', {
          code: 'CHAT_LOCKED',
          message: 'This conversation is read-only because the item was returned.',
          matchId,
        });
        return;
      }

      const validated = validateMessageContent(payload?.content);
      if (!validated.ok) {
        socket.emit('chat:error', {
          code: 'INVALID_CONTENT',
          message: validated.reason,
          matchId,
        });
        return;
      }

      const sender = await User.findById(socket.data.userId).select('name').lean();
      const senderName = sender?.name || 'User';

      const message = await Message.create({
        chatRoomId: matchId,
        senderId: socket.data.userId,
        content: validated.content,
        readBy: [],
      });

      const room = chatRoomName(matchId);
      await socket.join(room);

      const outbound = {
        matchId,
        _id: message._id,
        senderId: message.senderId,
        senderName,
        content: message.content,
        readBy: message.readBy,
        createdAt: message.createdAt,
      };

      io.to(room).emit('chat:message', outbound);

      const senderIdStr = String(socket.data.userId);
      const sourceOwnerStr = String(access.sourceOwner);
      const matchedOwnerStr = String(access.matchedOwner);
      const recipientId =
        senderIdStr === sourceOwnerStr ? matchedOwnerStr : sourceOwnerStr;

      if (recipientId && recipientId !== senderIdStr) {
        emitToUser(recipientId, 'chat:notify', {
          matchId: String(matchId),
          _id: message._id,
          senderId: senderIdStr,
          senderName,
          content: message.content,
          createdAt: message.createdAt,
        });
      }
    } catch (err) {
      console.error('[socket] chat:send failed:', err);
      socket.emit('chat:error', { code: 'SERVER_ERROR', message: 'Failed to send message' });
    }
  });

  socket.on('chat:typing', async (payload) => {
    try {
      const matchId = payload?.matchId;
      const access = await verifyMatchParticipant(matchId, socket.data.userId);

      if (!access.ok) {
        return;
      }

      if (await isMatchChatLocked(access.match)) {
        return;
      }

      const room = chatRoomName(matchId);
      await socket.join(room);

      const isTyping = Boolean(payload?.isTyping);
      socket.to(room).emit('chat:typing', {
        matchId,
        userId: socket.data.userId,
        isTyping,
      });
    } catch (err) {
      console.error('[socket] chat:typing failed:', err);
    }
  });
}

function initSocket(server, { corsOrigins = [] } = {}) {
  // eslint-disable-next-line global-require
  const { Server } = require('socket.io');

  io = new Server(server, {
    cors: {
      origin: corsOrigins.length > 0 ? corsOrigins : true,
      credentials: true,
    },
    path: '/socket.io',
  });

  io.on('connection', (socket) => {
    const token = socket.handshake.auth?.token;
    if (!token || typeof token !== 'string' || !token.trim()) {
      socket.disconnect(true);
      return;
    }

    try {
      const payload = jwt.verify(token.trim(), process.env.JWT_SECRET);
      if (!payload?.userId) {
        socket.disconnect(true);
        return;
      }
      socket.data.userId = String(payload.userId);
    } catch {
      socket.disconnect(true);
      return;
    }

    socket.join(`user:${socket.data.userId}`);
    console.info('[socket] user joined room', socket.data.userId);

    registerChatHandlers(socket);

    socket.on('disconnect', () => {
      // no-op
    });
  });

  console.info('[socket] initialized');
  return io;
}

function getIo() {
  return io;
}

function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
}

module.exports = {
  initSocket,
  getIo,
  emitToUser,
};
