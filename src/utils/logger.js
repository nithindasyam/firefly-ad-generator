/**
 * Logs an informational message with timestamp.
 * @param {string} message - The message to log.
 */
const log = (message) => {
  if (typeof message !== 'string') {
    message = String(message);
  }
  console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
};

/**
 * Logs an error message with timestamp.
 * @param {string} message - The error message to log.
 */
const error = (message) => {
  if (typeof message !== 'string') {
    message = String(message);
  }
  console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
};

/**
 * Logs a warning message with timestamp.
 * @param {string} message - The warning message to log.
 */
const warn = (message) => {
  if (typeof message !== 'string') {
    message = String(message);
  }
  console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
};

/**
 * Logs a debug message with timestamp (only in development mode).
 * @param {string} message - The debug message to log.
 */
const debug = (message) => {
  if (process.env.NODE_ENV !== 'production') {
    if (typeof message !== 'string') {
      message = String(message);
    }
    console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`);
  }
};

/**
 * Logs detailed error information including stack trace.
 * @param {Error} err - The error object to log.
 * @param {string} context - Additional context about where the error occurred.
 */
const logError = (err, context = '') => {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` (${context})` : '';
  
  console.error(`[ERROR] ${timestamp}${contextStr} - ${err.message}`);
  
  if (err.stack && process.env.NODE_ENV !== 'production') {
    console.error(`[ERROR] ${timestamp} - Stack trace:`);
    console.error(err.stack);
  }
  
  // Log additional error properties if they exist
  if (err.code) {
    console.error(`[ERROR] ${timestamp} - Error code: ${err.code}`);
  }
  
  if (err.statusCode) {
    console.error(`[ERROR] ${timestamp} - HTTP status: ${err.statusCode}`);
  }
};

module.exports = { log, error, warn, debug, logError };
