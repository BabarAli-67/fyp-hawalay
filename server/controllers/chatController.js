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
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$chatRoomId',
        content: { $first: '$content' },
        createdAt: { $first: '$createdAt' },
        senderId: { $first: '$senderId' },
      },
    },
  ]);

  return new Map(rows.map((row) => [row._id.toString(), row]));
}

async function listChatRooms(req, res, next) {
  try {
    const userId = req.user.userId;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const ownedItems = await Item.find({ ownerId: userObjectId, isDeleted: { $ne: true } })
      .select('_id')
      .lean();
    const ownedItemIds = ownedItems.map((item) => item._id);

    const matchFilter = {
      $or: [
        { sourceItemOwnerId: userObjectId },
        { matchedItemOwnerId: userObjectId },
      ],
    };

    if (ownedItemIds.length > 0) {
      matchFilter.$or.push(
        { sourceItemId: { $in: ownedItemIds } },
        { matchedItemId: { $in: ownedItemIds } },
      );
    }

    const matchDocs = await Match.find(matchFilter).sort({ updatedAt: -1 }).lean();

    if (!matchDocs.length) {
      return res.status(200).json({ rooms: [] });
    }

    const matchIds = matchDocs.map((m) => m._id);
    const itemIds = new Set();
    for (const m of matchDocs) {
      itemIds.add(m.sourceItemId.toString());
      itemIds.add(m.matchedItemId.toString());
    }

    const items = await Item.find({ _id: { $in: [...itemIds] } })
      .select('title ownerId')
      .lean();
    const itemById = new Map(items.map((item) => [item._id.toString(), item]));

    const ownerIds = new Set();
    for (const m of matchDocs) {
      if (m.sourceItemOwnerId) ownerIds.add(m.sourceItemOwnerId.toString());
      if (m.matchedItemOwnerId) ownerIds.add(m.matchedItemOwnerId.toString());
      const src = itemById.get(m.sourceItemId.toString());
      const matched = itemById.get(m.matchedItemId.toString());
      if (src?.ownerId) ownerIds.add(src.ownerId.toString());
      if (matched?.ownerId) ownerIds.add(matched.ownerId.toString());
    }

    const users = await User.find({ _id: { $in: [...ownerIds] } })
      .select('name')
      .lean();
    const userById = new Map(users.map((u) => [u._id.toString(), u]));

    const lastByRoom = await getLastMessagesByRoom(matchIds);

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
              }
            : null,
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

    const messagesDesc = await Message.find({ chatRoomId: match._id })
      .sort({ createdAt: -1 })
      .limit(MESSAGE_LIMIT)
      .populate('senderId', 'name')
      .lean();

    const messages = messagesDesc.reverse();

    const formatted = messages.map((msg) => ({
      _id: msg._id,
      chatRoomId: msg.chatRoomId,
      content: msg.content,
      readBy: msg.readBy || [],
      createdAt: msg.createdAt,
      sender: msg.senderId
        ? { _id: msg.senderId._id, name: msg.senderId.name }
        : { _id: msg.senderId, name: 'User' },
    }));

    const participantIds = [sourceOwner, matchedOwner];
    const participants = await User.find({ _id: { $in: participantIds } })
      .select('name avatarFileId updatedAt')
      .lean();

    return res.status(200).json({
      matchId: match._id,
      messages: formatted,
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
