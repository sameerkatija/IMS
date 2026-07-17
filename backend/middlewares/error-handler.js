const env = require('../config/env');

// Must be registered LAST, after all routes, with 4 args so Express
// recognizes it as an error handler.
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational === true;

  if (!isOperational) {
    // Unexpected/programming errors - log full detail server-side.
    console.error('[UNEXPECTED ERROR]', err);
  } else if (env.nodeEnv === 'development') {
    console.error(`[${statusCode}]`, err.message);
  }

  res.status(statusCode).json({
    success: false,
    message: isOperational ? err.message : 'Something went wrong. Please try again.',
    ...(err.details ? { details: err.details } : {}),
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

module.exports = { errorHandler, notFoundHandler };
