const express = require('express');
const controller = require('./integration.controller');
const { wrapHandlers: w } = require('../../utils/route-async');

const router = express.Router();

router.get('/websites', ...w(controller.websites));
router.post('/websites', ...w(controller.createWebsite));
router.put('/websites/:uid', ...w(controller.updateWebsite));
router.delete('/websites/:uid', ...w(controller.deleteWebsite));
router.get('/websites/:uid/code', ...w(controller.websiteCode));

module.exports = router;
