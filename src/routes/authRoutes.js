const express = require('express');
const passport = require('passport');
const router = express.Router();

const {
  register,
  login,
  refresh,
  logout,
  getMe,
  googleCallback,
} = require('../controllers/authController');

const { protect } = require('../middleware/auth');

// ── Local Auth ────────────────────────────────────────────────────────────────

// POST /api/v1/auth/register
router.post('/register', register);

// POST /api/v1/auth/login
router.post('/login', login);

// POST /api/v1/auth/refresh  — reads refreshToken from httpOnly cookie
router.post('/refresh', refresh);

// POST /api/v1/auth/logout   — revokes refresh token, clears cookie
router.post('/logout', logout);

// GET  /api/v1/auth/me       — returns current authenticated user
router.get('/me', protect, getMe);

// ── Google OAuth 2.0 ─────────────────────────────────────────────────────────

// Step 1: Redirect to Google
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

// Step 2: Google redirects back here
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:3000'}/auth/failure`,
  }),
  googleCallback
);

module.exports = router;
