# Enterprise Multi-Tenant Security Gateway
### CSC337 — Lab Assignment 05

> **Topic:** Enterprise Application Security, Hybrid Auth (JWT + OAuth 2.0), RBAC & OWASP Hardening

---

## Live URLs

| Resource | URL |
|---|---|
| Live Application | *(Add your deployment URL here)* |
| API Base URL | *(Add your API base URL here)* |

---

## Tech Stack

- **Runtime:** Node.js + Express.js
- **Database:** MongoDB Atlas (Mongoose)
- **Auth:** JWT (Access + Refresh Tokens) + Google OAuth 2.0 (Passport.js)
- **Password Hashing:** bcryptjs (salt rounds: 12)
- **Security:** Helmet, CORS, express-rate-limit, express-mongo-sanitize, xss-clean

---

## Setup & Installation

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd enterprise-security-gateway
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
```bash
cp .env.example .env
```
Edit `.env` with your values:
- `MONGODB_URI` — your MongoDB Atlas connection string
- `JWT_ACCESS_SECRET` — strong random secret
- `JWT_REFRESH_SECRET` — different strong random secret
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from Google Cloud Console
- `CLIENT_URL` — your frontend URL

### 4. Run the server
```bash
npm start
```

Server runs on `http://localhost:5000`

---

## Test Credentials (Sample Accounts)

> These accounts should be seeded into your MongoDB Atlas instance.

| Role | Email | Password |
|---|---|---|
| **SuperAdmin** | `superadmin@lab5.com` | `SuperAdmin@2026` |
| **Manager** | `manager@lab5.com` | `Manager@2026` |
| **Employee** | `employee@lab5.com` | `Employee@2026` |

---

## API Endpoints

### Auth Routes — `/api/v1/auth`

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| POST | `/register` | Register new user | No |
| POST | `/login` | Login with email + password | No |
| POST | `/refresh` | Rotate refresh token (reads httpOnly cookie) | No |
| POST | `/logout` | Revoke token, clear cookie | No |
| GET | `/me` | Get current user profile | Yes (Bearer) |
| GET | `/google` | Initiate Google OAuth flow | No |
| GET | `/google/callback` | Google OAuth callback | No |

### Employee Routes — `/api/v1/employee`

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/profile` | Get own profile | All (SuperAdmin, Manager, Employee) |
| PUT | `/profile` | Update own profile | All (SuperAdmin, Manager, Employee) |

### Payroll Routes — `/api/v1/payroll`

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/` | Get all payroll records | Manager, SuperAdmin |
| POST | `/approve` | Approve payroll | Manager, SuperAdmin |

### User Management Routes — `/api/v1/users`

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/` | List all users | SuperAdmin only |
| GET | `/:id` | Get user by ID | SuperAdmin only |
| PUT | `/:id` | Update user role/status | SuperAdmin only |
| DELETE | `/:id` | Delete a user | SuperAdmin only |

### Other

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |

---

## Security Architecture

### 1. Local Authentication & Hashing
- Passwords hashed with **bcryptjs** (salt rounds: 12) — never stored as plain text
- **Account Lockout:** 5 failed attempts → 15-minute lockout per account
- **Rate Limiting:** Max 20 login/register attempts per IP per 15 minutes

### 2. Token Architecture
```
Access Token:
  - Algorithm: HS256
  - Expiry: 15 minutes
  - Transport: Authorization: Bearer <token>

Refresh Token:
  - Expiry: 7 days
  - Transport: httpOnly cookie (Secure + SameSite=Strict)
  - Storage in DB: bcrypt-hashed (not stored in plain text)
  - Rotation: New refresh token issued on every /refresh call
  - Revocation: Token cleared from DB on logout
  - Reuse Detection: If an old token is reused, all sessions are revoked
```

### 3. Google OAuth 2.0
- Uses **Passport.js** `passport-google-oauth20` strategy
- On successful login: issues JWT access + refresh tokens (same as local auth)
- Existing accounts linked by email if Google ID not found
- New OAuth users created with `Employee` role by default

### 4. RBAC — Role-Based Access Control

| Role | Access |
|---|---|
| **Employee** | Own profile only |
| **Manager** | Profile + Payroll (view/approve) |
| **SuperAdmin** | Full access (all routes including user management) |

RBAC enforced via `checkRole(['Role1', 'Role2'])` middleware.

### 5. OWASP Hardening
- **Helmet.js** — sets 15+ security HTTP headers (CSP, HSTS, X-Frame-Options, etc.)
- **CORS** — strict origin whitelist, credentials allowed
- **NoSQL Injection** — `express-mongo-sanitize` strips `$` and `.` from inputs
- **XSS** — `xss-clean` sanitizes HTML tags and script injection
- **Body size limit** — `10kb` max request body
- **Rate limiting** — global (200 req/15min) and auth-specific (20 req/15min)

---

## Postman Testing Guide

### Register a user
```json
POST /api/v1/auth/register
{
  "name": "Test Employee",
  "email": "test@example.com",
  "password": "Password@123",
  "role": "Employee"
}
```

### Login
```json
POST /api/v1/auth/login
{
  "email": "superadmin@lab5.com",
  "password": "SuperAdmin@2026"
}
// Returns: accessToken in body, refreshToken in httpOnly cookie
```

### Use protected routes
```
GET /api/v1/employee/profile
Headers: Authorization: Bearer <accessToken>
```

### Refresh token
```
POST /api/v1/auth/refresh
// Reads refreshToken from cookie automatically
// Returns: new accessToken
```

### Test RBAC rejection (Employee trying payroll)
```
POST /api/v1/payroll/approve
Headers: Authorization: Bearer <employee_accessToken>
// Expected: 403 Forbidden
```

### Delete user (SuperAdmin only)
```
DELETE /api/v1/users/:id
Headers: Authorization: Bearer <superadmin_accessToken>
```

---

## Project Structure

```
├── server.js              # Entry point
├── .env                   # Environment variables (not committed)
├── .env.example           # Template for environment variables
├── .gitignore
├── package.json
└── src/
    ├── app.js             # Express app setup, middleware, routes
    ├── config/
    │   ├── db.js          # MongoDB connection
    │   └── passport.js    # Google OAuth strategy
    ├── models/
    │   └── User.js        # User schema with RBAC, lockout, bcrypt
    ├── middleware/
    │   ├── auth.js        # protect() + checkRole() RBAC middleware
    │   └── errorHandler.js # Global error handler
    ├── controllers/
    │   ├── authController.js      # register, login, refresh, logout, OAuth
    │   ├── employeeController.js  # Profile management
    │   ├── payrollController.js   # Payroll approval
    │   └── userController.js      # User CRUD (SuperAdmin)
    └── routes/
        ├── authRoutes.js
        ├── employeeRoutes.js
        ├── payrollRoutes.js
        └── userRoutes.js
```

---

## OAuth 2.0 Setup (Google Cloud Console)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable **Google+ API** and **Google OAuth2 API**
4. Go to **Credentials** → Create **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorized redirect URIs:
   - `http://localhost:5000/api/v1/auth/google/callback` (development)
   - `https://your-app.onrender.com/api/v1/auth/google/callback` (production)
7. Copy **Client ID** and **Client Secret** to `.env`

---

## Deployment (Render)

1. Push code to a **public** GitHub repository
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your repository
4. Settings:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Add all environment variables from `.env`
6. Update `GOOGLE_CALLBACK_URL` to use your Render domain
7. Update `CLIENT_URL` to your frontend URL

---

## OAuth Provider Used
**Google** (Google OAuth 2.0 / OpenID Connect)
