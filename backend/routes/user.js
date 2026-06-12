import { Router } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createError } from "../middleware/errorHandler.js";

const router = Router();
const TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || "incanto-dev-secret-change-me";
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || "").trim();
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_FILE = path.join(__dirname, "../data/users.json");

const readUsers = () => {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch (_err) {
    return [];
  }
};

const saveUsers = () => {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

const users = readUsers();

const sanitizeString = (value, maxLength = 500) =>
  String(value || "").replace(/[<>]/g, "").trim().slice(0, maxLength);

const isValidBirthday = (birthday) => {
  const match = String(birthday || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 1900 || month < 1 || month > 12 || day < 1) return false;
  const birthDate = new Date(year, month - 1, day);
  if (
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day
  ) {
    return false;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return birthDate <= today;
};

const normalizeGiftItem = (item = {}) => ({
  id: sanitizeString(item.id, 80) || crypto.randomUUID(),
  name: sanitizeString(item.name || "Gift item", 180),
  description: sanitizeString(item.description, 500),
  category: sanitizeString(item.category || "Gift", 80),
  emoji: sanitizeString(item.emoji || "Gift", 30),
  price: Number(item.price) || null,
  priceLabel: sanitizeString(item.priceLabel || "Price unavailable", 80),
  reason: sanitizeString(item.reason, 500),
  link: sanitizeString(item.link || "#", 500),
  quantity: Math.max(1, Math.min(99, Number(item.quantity) || 1)),
});

const mergeUniqueItems = (current = [], incoming = [], { sumQuantity = false, limit = 100 } = {}) => {
  const merged = Array.isArray(current) ? [...current] : [];
  (Array.isArray(incoming) ? incoming : []).forEach((rawItem) => {
    if (!rawItem?.id && !rawItem?.name) return;
    const item = normalizeGiftItem(rawItem);
    const existing = merged.find((gift) => String(gift.id) === String(item.id));
    if (existing) {
      if (sumQuantity) existing.quantity = Math.min(99, (Number(existing.quantity) || 1) + item.quantity);
    } else {
      merged.unshift(item);
    }
  });
  return merged.slice(0, limit);
};

const ensureUserProfileFields = (user) => {
  let changed = false;
  if (!user.preferences) {
    user.preferences = {};
    changed = true;
  }
  if (!user.personalInfo) {
    user.personalInfo = {};
    changed = true;
  }
  if (!Array.isArray(user.recentlyViewed)) {
    user.recentlyViewed = [];
    changed = true;
  }
  if (!Array.isArray(user.cart)) {
    user.cart = [];
    changed = true;
  }
  if (!Array.isArray(user.orders)) {
    user.orders = [];
    changed = true;
  }
  if (!Array.isArray(user.favorites)) {
    user.favorites = [];
    changed = true;
  }
  if (!Array.isArray(user.processedOrderKeys)) {
    user.processedOrderKeys = [];
    changed = true;
  }
  return changed;
};

if (users.some(ensureUserProfileFields)) {
  saveUsers();
}

const toPublicUser = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  verified: user.verified,
  provider: user.provider,
  personalInfo: user.personalInfo || {},
  preferences: user.preferences || {},
  recentlyViewed: user.recentlyViewed || [],
  cart: user.cart || [],
  orders: user.orders || [],
  favorites: user.favorites || [],
});

const base64Url = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const signToken = (user) => {
  const payload = {
    sub: user.id,
    email: user.email,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const body = base64Url(payload);
  const signature = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
};

const verifyToken = (token) => {
  try {
    if (!token || !token.includes(".")) return null;
    const [body, signature] = token.split(".");
    const expected = crypto
      .createHmac("sha256", TOKEN_SECRET)
      .update(body)
      .digest("base64url");

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (_err) {
    return null;
  }
};

const hashPassword = (password, salt = crypto.randomBytes(16).toString("hex")) => {
  const hash = crypto
    .pbkdf2Sync(password, salt, 120000, 64, "sha512")
    .toString("hex");
  return `${salt}:${hash}`;
};

const passwordsMatch = (password, savedHash) => {
  const [salt] = savedHash.split(":");
  return hashPassword(password, salt) === savedHash;
};

const decodeGoogleCredential = (credential) => {
  const parts = String(credential || "").split(".");
  if (parts.length < 2) return null;
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
};

const requireAuth = (req, _res, next) => {
  const rawHeader = req.get("Authorization") || "";
  const token = rawHeader.startsWith("Bearer ") ? rawHeader.slice(7) : null;
  const payload = verifyToken(token);

  if (!payload) return next(createError("Unauthorized or expired token.", 401));

  const user = users.find((item) => item.id === payload.sub);
  if (!user) return next(createError("User not found.", 401));

  req.user = user;
  next();
};

const issueAuthResponse = (res, user, status = 200) => {
  const token = signToken(user);
  res.status(status).json({
    success: true,
    data: {
      token,
      tokenType: "Bearer",
      expiresIn: TOKEN_TTL_MS / 1000,
      user: toPublicUser(user),
    },
  });
};

router.post("/register", (req, res, next) => {
  try {
    const username = sanitizeString(req.body.username, 80);
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!username || !email || !password) {
      return next(createError("Username, email, and password are required.", 400));
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return next(createError("Please enter a valid email address.", 400));
    }

    if (password.length < 8) {
      return next(createError("Password must be at least 8 characters.", 400));
    }

    if (users.some((user) => user.email === email)) {
      return next(createError("An account with this email already exists.", 409));
    }

    const user = {
      id: crypto.randomUUID(),
      username,
      email,
      passwordHash: hashPassword(password),
      verified: false,
      provider: "password",
      personalInfo: {},
      preferences: {},
      recentlyViewed: [],
      cart: [],
      orders: [],
      favorites: [],
      processedOrderKeys: [],
      createdAt: new Date().toISOString(),
    };

    users.push(user);
    saveUsers();
    issueAuthResponse(res, user, 201);
  } catch (err) {
    next(err);
  }
});

router.post("/login", (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = users.find((item) => item.email === email);

    if (!user || !user.passwordHash || !passwordsMatch(password, user.passwordHash)) {
      return next(createError("Invalid email or password.", 401));
    }

    issueAuthResponse(res, user);
  } catch (err) {
    next(err);
  }
});

router.post("/google", (req, res, next) => {
  try {
    const payload = decodeGoogleCredential(req.body.credential);

    if (!payload?.email) {
      return next(createError("A valid Google credential token is required.", 400));
    }

    if (GOOGLE_CLIENT_ID && payload.aud !== GOOGLE_CLIENT_ID) {
      return next(createError("Google credential was not issued for this app.", 401));
    }

    const email = payload.email.toLowerCase();
    let user = users.find((item) => item.email === email);

    if (!user) {
      user = {
        id: crypto.randomUUID(),
        username: payload.name || email.split("@")[0],
        email,
        passwordHash: null,
        verified: Boolean(payload.email_verified),
        provider: "google",
        personalInfo: {},
        preferences: {},
        recentlyViewed: [],
        cart: [],
        orders: [],
        favorites: [],
        processedOrderKeys: [],
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      saveUsers();
    } else {
      user.verified = user.verified || Boolean(payload.email_verified);
      user.provider = user.provider === "password" ? "password+google" : user.provider;
      user.cart = user.cart || [];
      user.orders = user.orders || [];
      user.favorites = user.favorites || [];
      user.processedOrderKeys = user.processedOrderKeys || [];
      saveUsers();
    }

    issueAuthResponse(res, user);
  } catch (_err) {
    next(createError("Could not read the Google credential token.", 400));
  }
});

router.get("/profile", requireAuth, (req, res) => {
  res.json({ success: true, data: { user: toPublicUser(req.user) } });
});

router.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Users API is running",
    routes: {
      register: "POST /api/v1/users/register",
      login: "POST /api/v1/users/login",
      google: "POST /api/v1/users/google",
      profile: "GET /api/v1/users/profile",
      preferences: "POST /api/v1/users/preferences",
      personalInfo: "POST /api/v1/users/personal-info",
      recentlyViewed: "POST /api/v1/users/recently-viewed",
      cart: "POST /api/v1/users/cart, PUT/DELETE /api/v1/users/cart/:id",
      orders: "GET /api/v1/users/orders, POST /api/v1/users/orders",
    },
  });
});

router.post("/preferences", requireAuth, (req, res) => {
  req.user.preferences = {
    recipient: req.body.recipient || "",
    budget: Number(req.body.budget) || 0,
    interests: Array.isArray(req.body.interests)
      ? req.body.interests
      : String(req.body.interests || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
    personality: req.body.personality || "",
    occasion: req.body.occasion || "",
    updatedAt: new Date().toISOString(),
  };
  saveUsers();

  res.json({
    success: true,
    message: "Preferences saved.",
    data: { user: toPublicUser(req.user) },
  });
});

const savePersonalInfo = (req, res, next) => {
  const fullName = String(req.body.fullName || "").trim();
  const phone = String(req.body.phone || "").trim();
  const birthday = String(req.body.birthday || "").trim();
  const location = String(req.body.location || "").trim();

  if (phone) {
    if (!/^\d+$/.test(phone)) {
      return next(createError("Phone number must contain only digits.", 400));
    }
    if (phone.length < 10 || phone.length > 12) {
      return next(createError("Phone number must be between 10 and 12 digits.", 400));
    }
  }

  if (birthday) {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(birthday)) {
      return next(createError("Birthday must be in DD/MM/YYYY format.", 400));
    }
    if (!isValidBirthday(birthday)) {
      return next(createError("Birthday must be a real past date.", 400));
    }
  }

  req.user.personalInfo = {
    fullName: sanitizeString(fullName, 160),
    phone,
    birthday,
    location: sanitizeString(location, 240),
    updatedAt: new Date().toISOString(),
  };
  saveUsers();

  res.json({
    success: true,
    message: "Personal information saved.",
    data: { user: toPublicUser(req.user) },
  });
};

router.post("/personal-info", requireAuth, savePersonalInfo);
router.put("/personal-info", requireAuth, savePersonalInfo);

router.post("/favorites", requireAuth, (req, res, next) => {
  const item = req.body.gift || req.body;
  if (!item?.id || !item?.name) {
    return next(createError("Gift ID and Name are required.", 400));
  }
  req.user.favorites = req.user.favorites || [];
  const exists = req.user.favorites.some(f => String(f.id) === String(item.id));
  if (!exists) {
    req.user.favorites.push({
      id: item.id,
      name: String(item.name || ""),
      emoji: String(item.emoji || "🎁"),
      priceLabel: String(item.priceLabel || "")
    });
    saveUsers();
  }
  req.user.favorites = req.user.favorites.map(normalizeGiftItem);
  saveUsers();
  res.json({ success: true, message: "Added to favorites", data: { user: toPublicUser(req.user) } });
});

router.delete("/favorites/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  req.user.favorites = (req.user.favorites || []).filter(f => String(f.id) !== String(id));
  saveUsers();
  res.json({ success: true, message: "Removed from favorites", data: { user: toPublicUser(req.user) } });
});

router.post("/cart/sync", requireAuth, (req, res, next) => {
  const { cart } = req.body;
  if (!Array.isArray(cart)) {
    return next(createError("Cart items array is required.", 400));
  }
  const userCart = req.user.cart || [];
  cart.forEach(guestItem => {
    const existing = userCart.find(item => String(item.id) === String(guestItem.id));
    if (existing) {
      existing.quantity = (existing.quantity || 1) + (guestItem.quantity || 1);
    } else {
      userCart.push(guestItem);
    }
  });
  req.user.cart = userCart;
  saveUsers();
  res.json({ success: true, message: "Cart synced successfully.", data: { user: toPublicUser(req.user) } });
});

router.post("/favorites/sync", requireAuth, (req, res, next) => {
  const { favorites } = req.body;
  if (!Array.isArray(favorites)) {
    return next(createError("Favorites array is required.", 400));
  }
  const userFavs = req.user.favorites || [];
  favorites.forEach(guestFav => {
    const exists = userFavs.some(item => String(item.id) === String(guestFav.id));
    if (!exists) {
      userFavs.push(guestFav);
    }
  });
  req.user.favorites = userFavs;
  saveUsers();
  res.json({ success: true, message: "Favorites synced successfully.", data: { user: toPublicUser(req.user) } });
});

router.post("/session/merge", requireAuth, (req, res, next) => {
  try {
    const cart = Array.isArray(req.body.cart) ? req.body.cart : [];
    const favorites = Array.isArray(req.body.favorites) ? req.body.favorites : [];
    const recentlyViewed = Array.isArray(req.body.recentlyViewed) ? req.body.recentlyViewed : [];

    req.user.cart = mergeUniqueItems(req.user.cart || [], cart, { sumQuantity: true, limit: 100 });
    req.user.favorites = mergeUniqueItems(req.user.favorites || [], favorites, { limit: 100 });
    req.user.recentlyViewed = mergeUniqueItems(req.user.recentlyViewed || [], recentlyViewed, { limit: 6 });
    req.user.favorites = req.user.favorites.map(normalizeGiftItem);
    saveUsers();

    res.json({
      success: true,
      message: "Guest session merged into your account.",
      data: { user: toPublicUser(req.user) },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/recently-viewed", requireAuth, (req, res) => {
  const item = req.body.gift || req.body;
  if (!item?.id || !item?.name) {
    return res.status(400).json({ success: false, message: "Gift id and name are required." });
  }

  req.user.recentlyViewed = (req.user.recentlyViewed || []).filter(
    (gift) => String(gift.id) !== String(item.id)
  );
  req.user.recentlyViewed.unshift({
    id: item.id,
    name: String(item.name || ""),
    description: String(item.description || ""),
    category: String(item.category || "Gift"),
    emoji: String(item.emoji || "Gift"),
    price: Number(item.price) || null,
    priceLabel: String(item.priceLabel || "Price unavailable"),
    reason: String(item.reason || ""),
    link: String(item.link || "#"),
    viewedAt: new Date().toISOString(),
  });
  req.user.recentlyViewed = req.user.recentlyViewed.slice(0, 6);
  saveUsers();

  res.json({ success: true, data: { user: toPublicUser(req.user) } });
});

router.post("/cart", requireAuth, (req, res) => {
  const item = req.body.gift || req.body;
  if (!item?.id || !item?.name) {
    return res.status(400).json({ success: false, message: "Gift id and name are required." });
  }

  req.user.cart = req.user.cart || [];
  const existing = req.user.cart.find((gift) => String(gift.id) === String(item.id));
  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    req.user.cart.unshift({
      id: item.id,
      name: String(item.name || ""),
      description: String(item.description || ""),
      category: String(item.category || "Gift"),
      emoji: String(item.emoji || "Gift"),
      price: Number(item.price) || null,
      priceLabel: String(item.priceLabel || "Price unavailable"),
      reason: String(item.reason || ""),
      link: String(item.link || "#"),
      quantity: 1,
      addedAt: new Date().toISOString(),
    });
  }
  saveUsers();

  res.json({ success: true, data: { user: toPublicUser(req.user) } });
});

router.delete("/cart/:id", requireAuth, (req, res) => {
  req.user.cart = (req.user.cart || []).filter(
    (gift) => String(gift.id) !== String(req.params.id)
  );
  saveUsers();

  res.json({ success: true, data: { user: toPublicUser(req.user) } });
});

router.put("/cart/:id", requireAuth, (req, res) => {
  const quantity = Math.max(1, Number(req.body.quantity) || 1);
  const item = (req.user.cart || []).find(
    (gift) => String(gift.id) === String(req.params.id)
  );

  if (!item) {
    return res.status(404).json({ success: false, message: "Cart item not found." });
  }

  item.quantity = quantity;
  saveUsers();

  res.json({ success: true, data: { user: toPublicUser(req.user) } });
});

router.get("/orders", requireAuth, (req, res) => {
  res.json({
    success: true,
    data: {
      orders: req.user.orders || [],
      user: toPublicUser(req.user),
    },
  });
});

router.post("/orders", requireAuth, (req, res) => {
  const order = req.body.order || req.body;
  if (!order || !Array.isArray(order.items) || order.items.length === 0) {
    return res.status(400).json({ success: false, message: "Order data is required." });
  }

  req.user.orders = req.user.orders || [];
  req.user.processedOrderKeys = req.user.processedOrderKeys || [];
  const clientRequestId = sanitizeString(order.clientRequestId || order.id, 120);
  const existingOrder = clientRequestId
    ? req.user.orders.find((savedOrder) => savedOrder.clientRequestId === clientRequestId || savedOrder.id === clientRequestId)
    : null;
  if (existingOrder) {
    return res.json({ success: true, data: { order: existingOrder, user: toPublicUser(req.user) } });
  }

  const normalizedOrder = {
    id: sanitizeString(order.id || `INC-${Date.now()}`, 120),
    clientRequestId,
    placedAt: order.placedAt || new Date().toISOString(),
    status: sanitizeString(order.status || "Confirmed", 40),
    paymentMethod: sanitizeString(order.paymentMethod || "card", 40),
    voucher: order.voucher ? sanitizeString(order.voucher, 80) : null,
    discount: Number(order.discount) || 0,
    items: order.items.map(normalizeGiftItem),
    total: Number(order.total) || 0,
    shippingAddress: sanitizeString(order.shippingAddress || "", 500),
  };

  req.user.orders.unshift(normalizedOrder);
  if (clientRequestId) req.user.processedOrderKeys.unshift(clientRequestId);
  req.user.processedOrderKeys = req.user.processedOrderKeys.slice(0, 100);
  const orderedIds = new Set(normalizedOrder.items.map((item) => String(item.id)));
  req.user.cart = (req.user.cart || []).filter(
    (item) => !orderedIds.has(String(item.id))
  );
  saveUsers();

  res.json({ success: true, data: { order: normalizedOrder, user: toPublicUser(req.user) } });
});

export default router;

