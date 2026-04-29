/**
 * middleware/errorHandler.js
 *
 * Global Express error handler + createError() helper.
 * Attach as the LAST middleware in server.js.
 */

import { config } from "../config/index.js";

export const errorHandler = (err, _req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // Supabase unique-violation (Postgres code 23505)
  if (err.code === "23505") {
    statusCode = 409;
    message = "A record with that value already exists.";
  }

  if (!config.isProd) {
    console.error(`[ERROR] ${statusCode} — ${message}`);
    if (err.stack) console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(!config.isProd && { stack: err.stack }),
  });
};

/**
 * createError(message, statusCode?)
 * Quickly throw an HTTP error from any route or service.
 *
 * @example
 *   throw createError("Not found.", 404);
 *   next(createError("Unauthorized.", 401));
 */
export const createError = (message, statusCode = 500) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};
