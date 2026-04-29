# Google OAuth Setup Guide

## Getting Your Google Client ID

Follow these steps to enable Google Sign-In for INCANTO:

### 1. Create a Google Cloud Project
- Go to [Google Cloud Console](https://console.cloud.google.com)
- Click **Select a Project** → **NEW PROJECT**
- Enter name: `Incanto` → **CREATE**

### 2. Create OAuth 2.0 Credentials
- In the left sidebar, go to **APIs & Services** → **Credentials**
- Click **+ CREATE CREDENTIALS** → **OAuth client ID**
- If prompted, set up the **OAuth consent screen** first:
  - Choose **External** user type
  - Fill in required fields (App name: "Incanto", User support email: your email)
  - Add scopes: `email` and `profile`
  - Save and continue

### 3. Configure OAuth 2.0 Client
- Application type: **Web application**
- Name: `Incanto Frontend`
- **Authorized JavaScript origins:**
  - `http://localhost:3000` (for local development)
  - `http://localhost` (optional fallback)
  - Your production domain when deployed
- Click **CREATE**
- Copy the **Client ID** (the long string)

### 4. Add to INCANTO
1. Open `frontend/user.js`
2. Find this line:
   ```javascript
   GOOGLE_CLIENT_ID: "", // Leave empty "" to disable Google login
   ```
3. Replace with:
   ```javascript
   GOOGLE_CLIENT_ID: "YOUR_CLIENT_ID_HERE", // Paste the ID you just copied
   ```
4. Save the file
5. Reload the frontend in your browser

### 5. Test Google Sign-In
- Open INCANTO
- Click **Log in** button
- You should see a "Sign in with Google" button
- Click it and complete the Google login flow

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No Google button appears | Check if `GOOGLE_CLIENT_ID` is filled in `frontend/user.js` |
| "Google credential was not issued for this app" | Verify the Client ID matches what's in `frontend/user.js` |
| Button appears but doesn't work | Check browser console (F12) for errors. Ensure authorized origins include your current URL |
| Page is blank on load | Check browser console for JavaScript errors in `user.js` |

## Security Notes
- Never commit your `GOOGLE_CLIENT_ID` to the repository (it's public-safe but still best practice)
- For production, use environment variables and never expose secrets in code
- Always use HTTPS in production
