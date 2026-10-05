const express = require('express');
const controller = require('./auth.controller');
const { protect } = require('./auth.middleware');
const { authLimiter } = require('../../bootstrap/middleware');
const { wrapHandlers: w } = require('../../utils/route-async');

const router = express.Router();

router.post('/login', ...w(authLimiter, controller.login));
router.post('/2fa/verify', ...w(authLimiter, controller.verifyTwoFactor));
router.get('/captcha-config', ...w(controller.captchaConfig));
router.get('/oauth-config', ...w(controller.oauthConfig));
router.get('/oauth/google/start', ...w(controller.googleOAuthStart));
router.post('/oauth/google/exchange', ...w(authLimiter, controller.googleOAuthExchange));
router.post('/register', ...w(authLimiter, controller.register));
router.get('/verify-email', ...w(controller.verifyEmail));
router.post('/resend-verification', ...w(controller.resendVerification));
router.post('/forgot-password', ...w(controller.forgotPassword));
router.post('/reset-password', ...w(controller.resetPassword));
router.get('/me', ...w(protect, controller.me));
router.post('/api-token/renew', ...w(protect, controller.renewApiToken));
router.post('/logout', ...w(protect, (req, res) => res.json({ message: 'Logged out successfully.' })));

module.exports = router;
