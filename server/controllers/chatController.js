const mongoose = require('mongoose');
const Match = require('../models/Match');
const Message = require('../models/Message');
const Item = require('../models/Item');
const User = require('../models/User');
const { formatUserAvatarFields } = require('../utils/userAvatarUrl');
const { findMatchForParticipant } = require('../utils/matchParticipant');

const MESSAGE_LIMIT = 50;

async function getLastMessagesByRoom(matchIds) {
  if (!matchIds.length) {
    return new Map();
  }

  const rows = await Message.aggregate([
    { $match: { chatRoomId: { $in: matchIds } } },
    { $sort: { chatRoomId: 1, createdAt: -1 } },
    {
      $group: {
        _id: '$chatRoomId',
        content: { $first: '$content' },
        createdAt: { $first: '$createdAt' },
        senderId: { $first: '$senderId' },
        readBy: { $first: '$readBy' },
      },
    },
  ]);

  return new Map(rows.map((row) => [row._id.toString(), row]));
}

function mergeMatchesById(primary, extra) {
  const byId = new Map(primary.map((m) => [m._id.toString(), m]));
  for (const m of extra) {
    const key = m._id.toString();
    if (!byId.has(key)) {
      byId.set(key, m);
    }
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

function isRoomUnreadForUser(preview, userId) {
  if (!preview?.content) return false;
  const senderId = preview.senderId?.toString?.() ?? String(preview.senderId ?? '');
  if (!senderId || senderId === userId) return false;
  const readBy = Array.isArray(preview.readBy)
    ? preview.readBy.map((id) => id.toString())
    : [];
  return !readBy.includes(userId);
}

async function listChatRooms(req, res, next) {
  try {
    const userId = req.user.userId;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const [ownedItems, ownerMatches] = await Promise.all([
      Item.find({ ownerId: userObjectId, isDeleted: { $ne: true } })
        .select('_id')
        .lean(),
      Match.find({
        $or: [
          { sourceItemOwnerId: userObjectId },
          { matchedItemOwnerId: userObjectId },
        ],
      })
        .sort({ updatedAt: -1 })
        .lean(),
    ]);

    const ownedItemIds = ownedItems.map((item) => item._id);
    let matchDocs = ownerMatches;

    if (ownedItemIds.length > 0) {
      const itemMatches = await Match.find({
        $or: [
          { sourceItemId: { $in: ownedItemIds } },
          { matchedItemId: { $in: ownedItemIds } },
        ],
      })
        .sort({ updatedAt: -1 })
        .lean();
      matchDocs = mergeMatchesById(matchDocs, itemMatches);
    }

    if (!matchDocs.length) {
      return res.status(200).json({ rooms: [] });
    }

    const matchIds = matchDocs.map((m) => m._id);
    const itemIds = new Set();
    for (const m of matchDocs) {
      itemIds.add(m.sourceItemId.toString());
      itemIds.add(m.matchedItemId.toString());
    }

    const ownerIds = new Set();
    for (const m of matchDocs) {
      if (m.sourceItemOwnerId) ownerIds.add(m.sourceItemOwnerId.toString());
      if (m.matchedItemOwnerId) ownerIds.add(m.matchedItemOwnerId.toString());
    }

    const [items, lastByRoom] = await Promise.all([
      Item.find({ _id: { $in: [...itemIds] } })
        .select('title ownerId')
        .lean(),
      getLastMessagesByRoom(matchIds),
    ]);

    const itemById = new Map(items.map((item) => [item._id.toString(), item]));

    for (const m of matchDocs) {
      const src = itemById.get(m.sourceItemId.toString());
      const matched = itemById.get(m.matchedItemId.toString());
      if (src?.ownerId) ownerIds.add(src.ownerId.toString());
      if (matched?.ownerId) ownerIds.add(matched.ownerId.toString());
    }

    const users = await User.find({ _id: { $in: [...ownerIds] } })
      .select('name')
      .lean();
    const userById = new Map(users.map((u) => [u._id.toString(), u]));

    const rooms = matchDocs
      .map((m) => {
        const sourceItem = itemById.get(m.sourceItemId.toString());
        const matchedItem = itemById.get(m.matchedItemId.toString());
        if (!sourceItem || !matchedItem) {
          return null;
        }

        const sourceOwnerId = (m.sourceItemOwnerId || sourceItem.ownerId).toString();
        const matchedOwnerId = (m.matchedItemOwnerId || matchedItem.ownerId).toString();
        const otherUserId = userId === sourceOwnerId ? matchedOwnerId : sourceOwnerId;
        const otherUser = userById.get(otherUserId);

        const preview = lastByRoom.get(m._id.toString());

        return {
          matchId: m._id,
          otherUser: otherUser
            ? { _id: otherUser._id, name: otherUser.name }
            : { _id: otherUserId, name: 'User' },
          items: {
            source: { _id: sourceItem._id, title: sourceItem.title },
            matched: { _id: matchedItem._id, title: matchedItem.title },
          },
          lastMessage: preview
            ? {
                content: preview.content,
                createdAt: preview.createdAt,
                senderId: preview.senderId,
                readBy: preview.readBy || [],
              }
            : null,
          unread: isRoomUnreadForUser(preview, userId),
          createdAt: m.createdAt,
        };
      })
      .filter(Boolean);

    rooms.sort((a, b) => {
      const aTime = new Date(a.lastMessage?.createdAt ?? a.createdAt).getTime();
      const bTime = new Date(b.lastMessage?.createdAt ?? b.createdAt).getTime();
      return bTime - aTime;
    });

    return res.status(200).json({ rooms });
  } catch (err) {
    return next(err);
  }
}

async function getChatMessages(req, res, next) {
  try {
    const { matchId } = req.params;
    const userId = req.user.userId;

    const access = await findMatchForParticipant(matchId, userId);
    if (access.error === 'invalid_id') {
      return res.status(400).json({ error: 'Invalid match id' });
    }
    if (access.error === 'not_found') {
      return res.status(404).json({ error: 'Match not found' });
    }
    if (access.error === 'forbidden') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { match, sourceOwner, matchedOwner } = access;
    const participantIds = [
      new mongoose.Types.ObjectId(sourceOwner),
      new mongoose.Types.ObjectId(matchedOwner),
    ];

    const [messagesDesc, participants] = await Promise.all([
      Message.find({ chatRoomId: match._id })
        .sort({ createdAt: -1 })
        .limit(MESSAGE_LIMIT)
        .select('content readBy createdAt senderId')
        .lean(),
      User.find({ _id: { $in: participantIds } })
        .select('name avatarFileId updatedAt')
        .lean(),
    ]);

    const senderIds = [
      ...new Set(messagesDesc.map((msg) => msg.senderId?.toString()).filter(Boolean)),
    ];
    const senders =
      senderIds.length > 0
        ? await User.find({ _id: { $in: senderIds } })
            .select('name')
            .lean()
        : [];
    const senderById = new Map(senders.map((u) => [u._id.toString(), u]));

    const messages = messagesDesc.reverse().map((msg) => {
      const senderKey = msg.senderId?.toString();
      const sender = senderById.get(senderKey);
      return {
        _id: msg._id,
        chatRoomId: msg.chatRoomId,
        content: msg.content,
        readBy: msg.readBy || [],
        createdAt: msg.createdAt,
        sender: sender
          ? { _id: sender._id, name: sender.name }
          : { _id: msg.senderId, name: 'User' },
      };
    });

    return res.status(200).json({
      matchId: match._id,
      messages,
      participants: participants.map(formatUserAvatarFields),
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listChatRooms,
  getChatMessages,
};
