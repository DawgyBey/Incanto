/**
 * user.js — Authentication Configuration
 *
 * Set up your Google OAuth credentials here for seamless sign-in integration.
 * If GOOGLE_CLIENT_ID is not set, Google login will be disabled gracefully.
 */

window.IncantoAuth = {
  // ── Google OAuth Setup ──────────────────────────────────────────────────────
  // Get your Google Client ID from: https://console.cloud.google.com
  // 1. Create a new OAuth 2.0 Client ID (type: Web Application)
  // 2. Add http://localhost:3000 (or your frontend URL) to Authorized JavaScript origins
  // 3. Paste the Client ID below:
  GOOGLE_CLIENT_ID: "436047080407-nougkk1036aasu9pa5j4vgqlkib5pb7m.apps.googleusercontent.com", // Leave empty "" to disable Google login

  // ── Local Storage Keys ──────────────────────────────────────────────────────
  TOKEN_KEY: "incanto_auth_token",
  USER_KEY: "incanto_user",

  // ── API Configuration ──────────────────────────────────────────────────────
  API_BASE: ["localhost", "127.0.0.1"].includes(window.location.hostname) || window.location.protocol === "file:" 
    ? "http://localhost:5000/api/v1"
    : "https://api.incanto.ai/v1", // Update to your production API URL

  // ── Helper Functions ────────────────────────────────────────────────────────

  isAuthenticated() {
    return !!this.getToken();
  },

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  getUser() {
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  },

  setAuth(token, user) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  },

  // ── API Methods ────────────────────────────────────────────────────────────

  async register(username, email, password) {
    const res = await fetch(`${this.API_BASE}/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Registration failed");
    this.setAuth(data.data.token, data.data.user);
    return data.data;
  },

  async login(email, password) {
    const res = await fetch(`${this.API_BASE}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Login failed");
    this.setAuth(data.data.token, data.data.user);
    return data.data;
  },

  async loginWithGoogle(credential) {
    const res = await fetch(`${this.API_BASE}/users/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Google login failed");
    this.setAuth(data.data.token, data.data.user);
    return data.data;
  },
};
