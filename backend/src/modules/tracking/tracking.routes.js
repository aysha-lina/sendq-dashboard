const express = require('express');
const controller = require('./tracking.controller');
const integration = require('../integration/integration.controller');
const { wrapHandlers: w } = require('../../utils/route-async');

const router = express.Router();

router.get('/open', ...w(controller.open));
router.get('/click', ...w(controller.click));
router.get('/unsubscribe', ...w(controller.unsubscribe));
router.get('/webview', ...w(controller.webView));

// Public website-tracking script + event collector
router.get('/site/:uid.js', ...w(integration.siteScript));
router.post('/site/:uid/event', ...w(integration.siteEvent));

module.exports = router;
