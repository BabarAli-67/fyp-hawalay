const jwt = require('jsonwebtoken');

function signAccessToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '10m' },
  );
}

module.exports = {
  signAccessToken,
};
