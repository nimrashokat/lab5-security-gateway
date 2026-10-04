const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// ─── Token Helpers ─────────────────────────────────────────────────────────────

/**
 * Generate a short-lived access token (15 minutes).
 */
const generateAccessToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
};

/**
 * Generate a long-lived refresh token (7 days).
 */
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
};

/**
 * Set the refresh token as an httpOnly Secure SameSite=Strict cookie.
 */
const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
    sameSite: 'Strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  });
};

// ─── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Register a new user with email + password.
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // Basic input validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters.',
      });
    }

    // Only SuperAdmin can assign elevated roles
    const assignedRole =
      role && ['SuperAdmin', 'Manager', 'Employee'].includes(role)
        ? role
        : 'Employee';

    // Check for existing user
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered.',
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: assignedRole,
    });

    // Issue tokens immediately after registration
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // Hash and store refresh token
    const salt = await bcrypt.genSalt(10);
    user.refreshToken = await bcrypt.hash(refreshToken, salt);
    await user.save({ validateBeforeSave: false });

    setRefreshCookie(res, refreshToken);

    return res.status(201).json({
      success: true,
      message: 'Registration successful.',
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/login
 * Login with email + password. Implements account lockout.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    // Fetch user including password and lockout fields
    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+password +refreshToken +loginAttempts +lockUntil');

    if (!user) {
      // Generic message to prevent user enumeration
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Check account lockout
    if (user.isLocked) {
      const remaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(429).json({
        success: false,
        message: `Account locked. Try again in ${remaining} minute(s).`,
      });
    }

    // OAuth-only users cannot log in with password
    if (user.isOAuthUser && !user.password) {
      return res.status(400).json({
        success: false,
        message: 'This account uses Google Sign-In. Please login with Google.',
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      await user.incLoginAttempts();

      const attemptsLeft = Math.max(0, 5 - (user.loginAttempts + 1));
      return res.status(401).json({
        success: false,
        message:
          attemptsLeft > 0
            ? `Invalid email or password. ${attemptsLeft} attempt(s) remaining.`
            : 'Account locked for 15 minutes due to too many failed attempts.',
      });
    }

    // Successful login — reset lockout counters
    await user.resetLoginAttempts();

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // Hash and store refresh token in DB
    const salt = await bcrypt.genSalt(10);
    user.refreshToken = await bcrypt.hash(refreshToken, salt);
    await user.save({ validateBeforeSave: false });

    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/refresh
 * Rotate the refresh token — issues a new access token and new refresh token.
 */
const refresh = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No refresh token provided.',
      });
    }

    // Verify refresh token signature
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token.',
      });
    }

    // Fetch user with stored refresh token hash
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || !user.refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token revoked or user not found.',
      });
    }

    // Validate the submitted token matches the stored hash
    const isValid = await bcrypt.compare(token, user.refreshToken);
    if (!isValid) {
      // Possible token reuse attack — revoke all sessions
      user.refreshToken = undefined;
      await user.save({ validateBeforeSave: false });
      return res.status(401).json({
        success: false,
        message: 'Refresh token reuse detected. Please log in again.',
      });
    }

    // Rotate: issue new access + refresh tokens
    const newAccessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    const salt = await bcrypt.genSalt(10);
    user.refreshToken = await bcrypt.hash(newRefreshToken, salt);
    await user.save({ validateBeforeSave: false });

    setRefreshCookie(res, newRefreshToken);

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/logout
 * Revoke the refresh token and clear the cookie.
 */
const logout = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;

    if (token) {
      // Find and revoke the stored refresh token
      try {
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        await User.findByIdAndUpdate(decoded.id, {
          $unset: { refreshToken: 1 },
        });
      } catch (_) {
        // Token may be expired — still clear the cookie
      }
    }

    // Clear the httpOnly cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
    });

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/auth/me
 * Return the currently authenticated user's profile.
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/auth/google/callback — handled after Passport
 * Issues tokens for the OAuth user and redirects client.
 */
const googleCallback = async (req, res, next) => {
  try {
    const user = req.user;

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    const salt = await bcrypt.genSalt(10);
    user.refreshToken = await bcrypt.hash(refreshToken, salt);
    await user.save({ validateBeforeSave: false });

    setRefreshCookie(res, refreshToken);

    // Redirect to client with access token in query (client stores it in memory)
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    return res.redirect(
      `${clientUrl}/auth/success?token=${accessToken}&role=${user.role}&name=${encodeURIComponent(user.name)}`
    );
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, refresh, logout, getMe, googleCallback };
