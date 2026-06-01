/**
 * Public avatar URL for a user document (JWT required to fetch the image bytes).
 */
function buildUserAvatarUrl(user) {
  if (!user?.avatarFileId) return null;
  const version = user.updatedAt ? new Date(user.updatedAt).getTime() : 0;
  return `/api/users/${user._id}/avatar?v=${version}`;
}

function formatUserAvatarFields(user) {
  return {
    _id: user._id,
    name: user.name,
    avatarUrl: buildUserAvatarUrl(user),
  };
}

module.exports = {
  buildUserAvatarUrl,
  formatUserAvatarFields,
};
