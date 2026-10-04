const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const passport = require('./config/passport');

// ── Route imports ─────────────────────────────────────────────────────────────
const authRoutes     = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const payrollRoutes  = require('./routes/payrollRoutes');
const userRoutes     = require('./routes/userRoutes');
const errorHandler   = require('./middleware/errorHandler');

const app = express();

// ─── 1. OWASP: Helmet — set secure HTTP headers ──────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow OAuth redirects
  })
);

// ─── 2. OWASP: Strict CORS policy ────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  'http://localhost:5000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: Origin ${origin} not allowed.`));
    },
    credentials: true, // Allow cookies to be sent
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── 3. Body parsing ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));      // Limit body size
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// ─── 4. OWASP: NoSQL Injection sanitization ──────────────────────────────────
// Manual sanitization compatible with Express 5
app.use((req, res, next) => {
  const sanitize = (obj) => {
    if (obj && typeof obj === 'object') {
      for (const key of Object.keys(obj)) {
        if (key.startsWith('$') || key.includes('.')) {
          delete obj[key];
        } else {
          sanitize(obj[key]);
        }
      }
    }
  };
  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);
  next();
});

// ─── 5. OWASP: XSS sanitization ──────────────────────────────────────────────
// Manual XSS sanitization compatible with Express 5
app.use((req, res, next) => {
  const escapeHtml = (str) => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  };
  const sanitize = (obj) => {
    if (typeof obj === 'string') return escapeHtml(obj);
    if (obj && typeof obj === 'object') {
      for (const key of Object.keys(obj)) {
        obj[key] = sanitize(obj[key]);
      }
    }
    return obj;
  };
  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  next();
});

// ─── 6. Passport initialization ──────────────────────────────────────────────
app.use(passport.initialize());

// ─── 7. Global rate limiter (all routes) ─────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                  // Max 200 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});
app.use(globalLimiter);

// ─── 8. Auth-specific rate limiter (stricter for login/register) ──────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // Max 20 auth attempts per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Try again in 15 minutes.',
  },
});
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);

// ─── 9. API Routes ────────────────────────────────────────────────────────────
app.use('/api/v1/auth',     authRoutes);
app.use('/api/v1/employee', employeeRoutes);
app.use('/api/v1/payroll',  payrollRoutes);
app.use('/api/v1/users',    userRoutes);

// ─── 10. Health check ────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Enterprise Security Gateway is running.',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── 11. 404 handler ─────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
});

// ─── 12. Global error handler (must be last) ─────────────────────────────────
app.use(errorHandler);

module.exports = app;
