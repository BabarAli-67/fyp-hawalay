const bcrypt = require('bcrypt');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { signAccessToken } = require('../utils/authTokens');

const INVALID_CREDENTIALS = 'Invalid credentials';
const EMAIL_NOT_VERIFIED_MSG =
  'Email not verified. Complete registration and verify your email before signing in.';

async function register(req, res) {
  return res.status(400).json({
    error: 'Direct registration is disabled. Request a verification code first, then verify your email.',
    code: 'USE_EMAIL_VERIFICATION',
  });
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: INVALID_CREDENTIALS });
    }

    if (user.authProvider === 'local' && !user.isVerified) {
      return res.status(403).json({
        error: EMAIL_NOT_VERIFIED_MSG,
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    const match = user.passwordHash && (await bcrypt.compare(password, user.passwordHash));
    if (!match) {
      return res.status(401).json({ error: INVALID_CREDENTIALS });
    }

    const token = signAccessToken(user);
    return res.status(200).json({
      token,
      user: user.toSafeObject(),
    });
  } catch (err) {
    return next(err);
  }
}

function looksLikeJwt(t) {
  const parts = String(t).split('.');
  return parts.length === 3 && parts[0].length > 0 && parts[1].length > 0;
}

async function googleAuth(req, res, next) {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const client = new OAuth2Client(clientId);
    let payload;

    if (looksLikeJwt(token)) {
      try {
        const ticket = await client.verifyIdToken({
          idToken: token,
          audience: clientId,
        });
        payload = ticket.getPayload();
      } catch {
        payload = null;
      }
    }

    if (!payload) {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!userInfoRes.ok) {
        return res.status(401).json({ error: 'Invalid Google token' });
      }
      payload = await userInfoRes.json();
    }

    if (!payload || !payload.email || !payload.sub) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase();
    const name = payload.name || email.split('@')[0];

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name,
        email,
        passwordHash: null,
        authProvider: 'google',
        googleId,
        isVerified: true,
      });
    } else {
      if (!user.googleId) {
        user.googleId = googleId;
        user.authProvider = 'google';
      }
      if (!user.isVerified) {
        user.isVerified = true;
      }
      await user.save();
    }

    const jwtToken = signAccessToken(user);
    return res.status(200).json({
      token: jwtToken,
      user: user.toSafeObject(),
    });
  } catch (err) {
    return next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const u = await User.findById(req.user.userId);
    if (!u) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(200).json(u.toSafeObject());
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  register,
  login,
  googleAuth,
  getMe,
};
