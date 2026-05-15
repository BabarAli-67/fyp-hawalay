const bcrypt = require('bcrypt');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const INVALID_CREDENTIALS = 'Invalid credentials';

function signAccessToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  );
}

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      passwordHash,
      authProvider: 'local',
    });

    const token = signAccessToken(user);

    return res.status(201).json({
      token,
      user: user.toSafeObject(),
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: INVALID_CREDENTIALS });
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
      });
    } else if (!user.googleId) {
      user.googleId = googleId;
      user.authProvider = 'google';
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
