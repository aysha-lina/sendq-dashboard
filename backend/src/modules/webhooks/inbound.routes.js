const express = require('express');
const controller = require('./inbound.controller');
const { wrapHandlers: w } = require('../../utils/route-async');

const router = express.Router();

// Provider webhooks (public, secured by optional ?token=). `events` auto-detects
// bounce vs complaint from the payload; the others set a default for simple bodies.
router.post('/events', ...w(controller.handle('bounce')));
router.post('/bounce', ...w(controller.handle('bounce')));
router.post('/complaint', ...w(controller.handle('complaint')));

module.exports = router;
