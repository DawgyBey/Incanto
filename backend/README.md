# 🎁 Incanto — Backend v2

AI-powered gift recommendation API. Built with Node.js, Express, and JSON files for data storage.

---

## 🗂 Project Structure

```
incanto-backend/
│
├── server.js                  # ← Entry point. Boot order, middleware stack.
│
├── config/
│   └── index.js               # ← ALL env vars in one place. Never read process.env elsewhere.
│
├── data/
│   ├── gifts.json             # ← Static gift catalogue (Nepal-specific)
│   ├── users.json             # ← User accounts data
│   ├── userPreferences.json   # ← User preferences data
│   ├── userCart.json          # ← User cart data
│   └── userRecentlyViewed.json # ← Recently viewed gifts data
│
├── middleware/
│   ├── auth.js                # ← JWT sign/verify, requireAuth, optionalAuth
│   └── errorHandler.js        # ← Global error handler + createError() helper
│
├── routes/
│   ├── index.js               # ← Registers all routers under /api/v1
│   ├── users.js               # ← /api/v1/users/* route definitions
│   └── gifts.js               # ← /api/v1/gifts/* route definitions
│
├── controllers/
│   ├── userController.js      # ← HTTP handlers for user routes (thin layer)
│   └── giftController.js      # ← HTTP handlers for gift routes (thin layer)
│
├── services/
│   ├── userService.js         # ← ALL JSON operations for users/prefs/cart/viewed
│   └── giftService.js         # ← Gift scoring & recommendation algorithm
│
├── frontend/
│   ├── index.html             # ← Frontend UI
│   ├── script.js              # ← Frontend logic (auth, quiz, results)
│   └── style.css              # ← Styles
│
├── .env.example               # ← Copy to .env and fill in your values
└── package.json
```

### The rule: where does new code go?

| What you're adding | Where it goes |
|---|---|
| New env variable | `config/index.js` + `.env.example` |
| New data file | `data/` |
| New data operation | `services/userService.js` (or a new `services/xService.js`) |
| New business logic | `services/` |
| New route | `routes/` → wire up in `routes/index.js` |
| New HTTP handler | `controllers/` |
| New middleware | `middleware/` |

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Open .env and fill in AUTH_TOKEN_SECRET

# 3. Start the server
npm run dev
```

---

## ⚙️ Environment Variables

See `.env.example` for all variables with descriptions.

| Variable | Required | Description |
|---|---|---|
| `AUTH_TOKEN_SECRET` | ✅ | Long random string for signing JWTs |
| `CLIENT_ORIGIN` | ✅ | Comma-separated allowed CORS origins |
| `GOOGLE_CLIENT_ID` | Optional | For Google OAuth login |
| `PORT` | Optional | Defaults to 5000 |

---

## 📡 API Reference

**Base URL:** `http://localhost:5000/api/v1`

All responses:
```json
{ "success": true, "message": "...", "data": { ... } }
```

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/users/register` | — | Create account |
| POST | `/users/login` | — | Login with email/password |
| POST | `/users/google` | — | Login with Google credential |
| GET | `/users/profile` | 🔒 | Get full profile |

### Preferences & Profile

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/users/preferences` | 🔒 | Save quiz preferences |
| POST | `/users/personal-info` | 🔒 | Save personal info |
| PUT | `/users/personal-info` | 🔒 | Update personal info |

### Cart & Activity

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/users/cart` | 🔒 | Add gift to cart |
| DELETE | `/users/cart/:id` | 🔒 | Remove gift from cart |
| POST | `/users/recently-viewed` | 🔒 | Track a viewed gift |

### Gifts

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/gifts/recommendations` | Optional | Get ranked gift recommendations |

**Recommendation query params:**

| Param | Type | Description |
|---|---|---|
| `budget` | number | Max price in NPR |
| `recipient` | string | `partner`, `friend`, `mom`, `dad`, `sibling`, `colleague`, `child` |
| `interests` | string | Comma-separated: `music,travel` |
| `personality` | string | `funny`, `romantic`, `practical`, `adventurous`, `artistic`, `intellectual` |
| `occasion` | string | `birthday`, `anniversary`, `valentine`, `festival`, `graduation`, `wedding` |
| `limit` | number | Results per page (max 50, default 10) |
| `page` | number | Page number (default 1) |

---

## 🔒 How Auth Works

1. User registers or logs in → server returns a custom JWT token
2. Frontend stores token in `localStorage` (via `user.js`)
3. Protected routes expect `Authorization: Bearer <token>` header
4. Token is verified in `middleware/auth.js` → user is loaded from Supabase
5. Token expires after 7 days

---

## 🗄 Database (Supabase)

Tables (see `db/schema.sql`):

| Table | Purpose |
|---|---|
| `users` | Core user accounts |
| `user_preferences` | Saved quiz preferences (1:1 with users) |
| `user_cart` | Cart items per user |
| `user_recently_viewed` | Recently viewed gifts (capped at 6 via query) |

To add a new table: add SQL to `db/schema.sql`, create query functions in `services/userService.js` (or a new service file), then call them from a controller.

---

## ⚠️ Error Codes

| Status | Meaning |
|---|---|
| 400 | Bad request / missing fields |
| 401 | Unauthorized / expired token |
| 404 | Route not found |
| 409 | Conflict (duplicate email) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
