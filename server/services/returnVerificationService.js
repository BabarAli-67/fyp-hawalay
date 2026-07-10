const Match = require('../models/Match');
const Item = require('../models/Item');
const Notification = require('../models/Notification');
const { findMatchForParticipant } = require('../utils/matchParticipant');
const { emitToUser } = require('../socket');
const { sendPushToUser } = require('./pushService');
const User = require('../models/User');

async function loadMatchItems(match) {
  const [sourceItem, matchedItem] = await Promise.all([
    Item.findById(match.sourceItemId).lean(),
    Item.findById(match.matchedItemId).lean(),
  ]);

  if (!sourceItem || !matchedItem || sourceItem.isDeleted || matchedItem.isDeleted) {
    return { error: 'not_found' };
  }

  return { sourceItem, matchedItem };
}

function resolveLostFoundItems(sourceItem, matchedItem) {
  let lostItem = null;
  let foundItem = null;

  if (sourceItem.reportType === 'lost') lostItem = sourceItem;
  if (sourceItem.reportType === 'found') foundItem = sourceItem;
  if (matchedItem.reportType === 'lost') lostItem = matchedItem;
  if (matchedItem.reportType === 'found') foundItem = matchedItem;

  if (!lostItem || !foundItem) {
    return { error: 'invalid_match' };
  }

  return {
    lostItem,
    foundItem,
    ownerUserId: lostItem.ownerId?.toString(),
    finderUserId: foundItem.ownerId?.toString(),
  };
}

function isReturnCompleted(match, lostItem, foundItem) {
  return (
    Boolean(match.returnCompletedAt) ||
    lostItem.status === 'returned' ||
    foundItem.status === 'returned'
  );
}

function buildReturnVerificationView(match, userId, lostItem, foundItem) {
  const ownerUserId = lostItem?.ownerId?.toString();
  const finderUserId = foundItem?.ownerId?.toString();
  const returned = isReturnCompleted(match, lostItem, foundItem);

  let userRole = null;
  if (userId === finderUserId) userRole = 'finder';
  else if (userId === ownerUserId) userRole = 'owner';

  const userHasConfirmed =
    userRole === 'finder'
      ? Boolean(match.finderConfirmedReturn)
      : userRole === 'owner'
        ? Boolean(match.ownerConfirmedReceive)
        : false;

  const peerHasConfirmed =
    userRole === 'finder'
      ? Boolean(match.ownerConfirmedReceive)
      : userRole === 'owner'
        ? Boolean(match.finderConfirmedReturn)
        : false;

  return {
    finderConfirmedReturn: Boolean(match.finderConfirmedReturn),
    ownerConfirmedReceive: Boolean(match.ownerConfirmedReceive),
    returnCompleted: returned,
    userRole,
    userHasConfirmed,
    peerHasConfirmed,
    canConfirm:
      Boolean(userRole) &&
      !returned &&
      !userHasConfirmed &&
      lostItem.status === 'active' &&
      foundItem.status === 'active',
    finderUserId,
    ownerUserId,
    lostItemId: lostItem._id,
    foundItemId: foundItem._id,
  };
}

async function createReturnNotification({ userId, type, title, message, matchId, itemId, matchedItemId }) {
  await Notification.create({
    userId,
    type,
    title,
    message,
    itemId,
    matchedItemId,
    matchId,
  });

  const user = await User.findById(userId).select('pushSubscription').lean();
  await sendPushToUser(user, { title, body: message, tag: matchId?.toString() });
  emitToUser(userId.toString(), 'notification:new', { type, title, matchId: matchId?.toString() });
}

async function completeReturn(match, lostItem, foundItem) {
  const now = new Date();
  const ownerId = lostItem.ownerId;
  const finderId = foundItem.ownerId;

  await Promise.all([
    Item.updateMany(
      { _id: { $in: [lostItem._id, foundItem._id] } },
      {
        status: 'returned',
        returnedAt: now,
        claimedAt: now,
        claimedByUserId: null,
      },
    ),
    Match.findByIdAndUpdate(match._id, { returnCompletedAt: now }),
  ]);

  const itemTitle = lostItem.title || foundItem.title || 'your item';
  const completionMessage = `"${itemTitle}" has been successfully marked as Returned.`;

  await Promise.all([
    createReturnNotification({
      userId: ownerId,
      type: 'return_completed',
      title: 'Return completed',
      message: completionMessage,
      matchId: match._id,
      itemId: lostItem._id,
      matchedItemId: foundItem._id,
    }),
    createReturnNotification({
      userId: finderId,
      type: 'return_completed',
      title: 'Return completed',
      message: completionMessage,
      matchId: match._id,
      itemId: foundItem._id,
      matchedItemId: lostItem._id,
    }),
  ]);
}

/**
 * @param {string} matchId
 * @param {string} userId
 */
async function confirmReturn(matchId, userId) {
  const access = await findMatchForParticipant(matchId, userId);
  if (access.error) {
    return { error: access.error };
  }

  const itemsResult = await loadMatchItems(access.match);
  if (itemsResult.error) {
    return { error: itemsResult.error };
  }

  const roles = resolveLostFoundItems(itemsResult.sourceItem, itemsResult.matchedItem);
  if (roles.error) {
    return { error: roles.error };
  }

  const { lostItem, foundItem, ownerUserId, finderUserId } = roles;
  const uid = userId.toString();

  if (uid !== ownerUserId && uid !== finderUserId) {
    return { error: 'forbidden' };
  }

  let match = await Match.findById(matchId);
  if (!match) {
    return { error: 'not_found' };
  }

  if (isReturnCompleted(match, lostItem, foundItem)) {
    return {
      returnVerification: buildReturnVerificationView(match, uid, lostItem, foundItem),
      alreadyCompleted: true,
    };
  }

  const isFinder = uid === finderUserId;
  const isOwner = uid === ownerUserId;
  const now = new Date();
  const updates = {};

  if (isFinder) {
    if (match.finderConfirmedReturn) {
      return {
        returnVerification: buildReturnVerificationView(match, uid, lostItem, foundItem),
        alreadyConfirmed: true,
      };
    }
    updates.finderConfirmedReturn = true;
    updates.finderConfirmedAt = now;
  }

  if (isOwner) {
    if (match.ownerConfirmedReceive) {
      return {
        returnVerification: buildReturnVerificationView(match, uid, lostItem, foundItem),
        alreadyConfirmed: true,
      };
    }
    updates.ownerConfirmedReceive = true;
    updates.ownerConfirmedAt = now;
  }

  match = await Match.findByIdAndUpdate(matchId, updates, { new: true });

  if (isFinder) {
    await createReturnNotification({
      userId: ownerUserId,
      type: 'return_finder_confirmed',
      title: 'Confirm your item',
      message:
        'The finder has marked this item as returned. Please confirm once you have received it.',
      matchId: match._id,
      itemId: lostItem._id,
      matchedItemId: foundItem._id,
    });
  }

  if (isOwner) {
    await createReturnNotification({
      userId: finderUserId,
      type: 'return_owner_confirmed',
      title: 'Owner confirmed receipt',
      message: 'The owner has confirmed receiving the item.',
      matchId: match._id,
      itemId: foundItem._id,
      matchedItemId: lostItem._id,
    });
  }

  const finderConfirmed = Boolean(match.finderConfirmedReturn);
  const ownerConfirmed = Boolean(match.ownerConfirmedReceive);

  if (finderConfirmed && ownerConfirmed) {
    await completeReturn(match, lostItem, foundItem);
    match = await Match.findById(matchId).lean();
  }

  return {
    returnVerification: buildReturnVerificationView(match, uid, lostItem, foundItem),
  };
}

/**
 * @param {string} matchId
 * @param {string} userId
 */
async function getReturnVerification(matchId, userId) {
  const access = await findMatchForParticipant(matchId, userId);
  if (access.error) {
    return { error: access.error };
  }

  const itemsResult = await loadMatchItems(access.match);
  if (itemsResult.error) {
    return { error: itemsResult.error };
  }

  const roles = resolveLostFoundItems(itemsResult.sourceItem, itemsResult.matchedItem);
  if (roles.error) {
    return { error: roles.error };
  }

  return {
    returnVerification: buildReturnVerificationView(
      access.match,
      userId.toString(),
      roles.lostItem,
      roles.foundItem,
    ),
  };
}

function attachReturnVerificationToMatch(match, userId, sourceItem, matchedItem) {
  const roles = resolveLostFoundItems(sourceItem, matchedItem);
  if (roles.error) {
    return null;
  }

  return {
    returnVerification: buildReturnVerificationView(
      match,
      userId,
      roles.lostItem,
      roles.foundItem,
    ),
  };
}

module.exports = {
  buildReturnVerificationView,
  attachReturnVerificationToMatch,
  confirmReturn,
  getReturnVerification,
  isReturnCompleted,
  resolveLostFoundItems,
};
