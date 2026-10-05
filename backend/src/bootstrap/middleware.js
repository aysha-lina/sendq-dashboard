const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

// Public (unauthenticated) endpoints: subscribe, form fetch, profile, confirm,
// sender-verify, etc. Throttled per-IP to blunt spam/scraping.
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 60 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

// Endpoints that trigger outbound email (verification/confirmation sends). Tight
// cap so they can't be abused for email-bombing arbitrary addresses.
const mailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 15 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many email requests, please try again later.' },
});

const registerMiddleware = (app) => {
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  }
};

module.exports = { authLimiter, publicLimiter, mailLimiter, registerMiddleware };
