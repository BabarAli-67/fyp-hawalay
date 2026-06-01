const jwt = require('jsonwebtoken');

function signAccessToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || '7d' },
  );
}

module.exports = {
  signAccessToken,
};
