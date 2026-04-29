# 🎁 INCANTO — AI-Powered Gift Recommendation Engine

**Find the perfect gift with AI**. INCANTO is a full-stack application that recommends personalized gifts based on recipient, occasion, budget, and personality traits.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** (for backend)
- **A modern browser** (for frontend)
- **Supabase account** (free tier works)
- **Google OAuth credentials** (optional, for Google sign-in)

### 1. Backend Setup
```bash
cd backend

# Copy environment template
cp .env.example .env

# Fill in your Supabase credentials
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# AUTH_TOKEN_SECRET=some-random-string
# CLIENT_ORIGIN=http://localhost:3000
# GOOGLE_CLIENT_ID=your-google-oauth-client-id (optional)

npm install
npm run dev  # Starts server on port 5000
```

### 2. Frontend Setup
```bash
# Navigate to frontend folder
cd frontend

# If using Google sign-in, follow the setup guide:
# See ../GOOGLE_OAUTH_SETUP.md

# Edit frontend/user.js and add your Google Client ID (if using Google OAuth)
# GOOGLE_CLIENT_ID: "your-client-id-here"

# Open in browser or serve via local server
python3 -m http.server 3000  # or any local dev server
# Open http://localhost:3000
```

### 3. Database Setup
1. Go to [Supabase Dashboard](https://supabase.com) → Your Project → SQL Editor
2. Create a new query and paste the contents of `backend/db/schema.sql`
3. Run the query to create tables

---

## 📁 Project Structure

```
Incanto/
├── backend/                   # Node.js/Express API
│   ├── config/               # Environment & configuration
│   ├── controllers/          # HTTP request handlers
│   ├── middleware/           # Auth, error handling
│   ├── routes/               # API endpoint definitions
│   ├── services/             # Business logic & DB queries
│   ├── db/                   # Supabase setup & schema
│   ├── data/                 # Static gift catalogue
│   ├── server.js             # Express app entry point
│   ├── .env.example          # Environment template
│   └── package.json
│
├── frontend/                 # HTML/CSS/JS frontend
│   ├── index.html           # UI markup
│   ├── script.js            # App logic, state management
│   ├── style.css            # Styles
│   ├── user.js              # Auth configuration
│   └── (no build needed — pure HTML/CSS/JS)
│
├── GOOGLE_OAUTH_SETUP.md    # Google sign-in configuration guide
└── README.md
```

---

## 🔑 Environment Variables

### Backend (`.env`)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AUTH_TOKEN_SECRET=a-very-long-random-string
CLIENT_ORIGIN=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-oauth-client-id (optional)
PORT=5000
NODE_ENV=development
```

### Frontend (`frontend/user.js`)
```javascript
GOOGLE_CLIENT_ID: "your-google-oauth-client-id" // Optional
API_BASE: "http://localhost:5000/api/v1"
```

---

## 🔐 Authentication

### Email/Password
- Users register with email + password (minimum 8 chars)
- Passwords are hashed with PBKDF2-SHA512 (120,000 iterations)
- JWT tokens expire after 7 days

### Google OAuth (Optional)
- Users can sign in with Google credentials
- Requires Google Client ID from [Google Cloud Console](https://console.cloud.google.com)
- See `GOOGLE_OAUTH_SETUP.md` for detailed setup

### No Account (Anonymous)
- Users can browse and use the gift finder without signing in
- Favorites and cart are stored locally in browser storage
- Preferences are not saved between sessions

---

## 📡 API Reference

**Base URL:** `http://localhost:5000/api/v1`

### Auth Endpoints
- `POST /users/register` — Create new account
- `POST /users/login` — Login with email/password
- `POST /users/google` — Login with Google credential

### User Endpoints (requires auth)
- `GET /users/profile` — Get authenticated user's full profile
- `POST /users/preferences` — Save gift preferences
- `POST /users/personal-info` — Save personal details
- `POST /users/cart` — Add gift to cart
- `DELETE /users/cart/:id` — Remove from cart
- `POST /users/recently-viewed` — Track viewed gifts

### Gift Endpoints (optional auth)
- `GET /gifts/recommendations` — Get personalized recommendations
  - Query params: `recipient`, `budget`, `interests`, `personality`, `occasion`, `limit`, `page`

---

## 🎨 Frontend Features

- **Gift Finder Quiz** — 5-step interactive wizard to find gifts
- **Smart Recommendations** — AI-powered scoring based on preferences
- **Saved Favorites** — Local storage persistence
- **Cart Management** — Add/remove items
- **Recently Viewed** — Track browsing history
- **User Profiles** — Save preferences and personal info
- **Email/Password Auth** — Secure authentication
- **Google Sign-In** — One-click OAuth login (optional)
- **Privacy-First** — Minimal data collection, transparent policies

---

## 🛠️ Development

### Backend
```bash
cd backend
npm run dev        # Start with auto-reload
npm start         # Start production
npm test          # Run tests (when added)
```

### Frontend
- No build step required — it's pure HTML/CSS/JavaScript
- Edit `frontend/index.html`, `script.js`, `style.css` directly
- Reload browser to see changes

---

## 📊 Database Schema

### Users Table
- `id` (UUID) — Primary key
- `email` (text) — Unique email
- `username` (text) — Display name
- `password_hash` (text) — Hashed password (null for Google-only accounts)
- `verified` (boolean) — Email verification status
- `provider` (text) — `password`, `google`, or `password+google`
- `personal_info` (JSONB) — Full name, phone, birthday, location
- `created_at`, `updated_at` (timestamps)

### User Preferences Table
- `user_id` (UUID FK) — Links to users
- `recipient` (text) — Gift recipient relationship
- `budget` (numeric) — Budget in currency
- `interests` (text[]) — Array of interests
- `personality` (text) — Personality type
- `occasion` (text) — Gift occasion

### User Cart & Recently Viewed Tables
- Tracks gifts added to cart and browsing history
- Uses `gift_data` JSONB to snapshot gift info at add-time

---

## 🔒 Security

- **HTTPS/TLS** — All data encrypted in transit (enable in production)
- **Password Hashing** — PBKDF2-SHA512 with 120,000 iterations
- **Rate Limiting** — 100 requests per 15 minutes per IP
- **CORS Protection** — Whitelist allowed origins
- **Helmet.js** — Security headers on all responses
- **No Tracking** — No cookies, analytics, or third-party trackers

---

## 📜 Privacy Policy

See `frontend/index.html` (Privacy Policy section) or `backend/README.md` for full details.

**Key Points:**
- We only collect data you provide
- Your preferences are processed transiently
- Cart/favorites are stored locally, not on servers
- No data is sold or shared with third parties
- You can request data deletion anytime

---

## 🐛 Troubleshooting

### Backend won't start
- Ensure `backend/.env` has all required variables
- Check that Supabase is accessible
- Verify `npm install` completed successfully
- Look for error messages in terminal

### Google sign-in not working
- Confirm `GOOGLE_CLIENT_ID` is set in `frontend/user.js`
- Check that authorized origins in Google Cloud Console include your current URL
- Open browser console (F12) for detailed error messages
- See `GOOGLE_OAUTH_SETUP.md` for step-by-step guide

### Recommendations API failing
- Ensure backend is running on port 5000
- Check `CLIENT_ORIGIN` in `.env` matches your frontend URL
- Verify `frontend/user.js` has correct `API_BASE`
- Check browser console for CORS errors

### Database connection issues
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
- Ensure schema has been created (run `db/schema.sql`)
- Check Supabase dashboard for any outages

---

## 🚀 Deployment

### Frontend
- Deploy to Vercel, Netlify, or any static host
- No build step needed — just upload the files
- Update `API_BASE` in `frontend/user.js` to your production backend URL

### Backend
- Deploy to Railway, Render, Heroku, or any Node.js host
- Set environment variables on hosting platform
- Update `CLIENT_ORIGIN` for CORS to match your production domain
- Use HTTPS in production (essential for cookies/auth)

### Database
- Use Supabase's hosted Postgres — no additional setup needed
- Backups are automatic
- Monitor usage on Supabase dashboard

---

## 📚 Additional Resources

- [Express.js Docs](https://expressjs.com)
- [Supabase Docs](https://supabase.com/docs)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [MDN Web Docs](https://developer.mozilla.org)

---

## 📝 License

This project is part of INCANTO. Use responsibly.

---

## ❤️ Credits

Built with care for gift givers everywhere.

**Questions?** See `GOOGLE_OAUTH_SETUP.md` for Google sign-in setup, or check the code comments for detailed explanations.
