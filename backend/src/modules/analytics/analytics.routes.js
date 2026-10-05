const express = require('express');
const controller = require('./analytics.controller');
const { requireFeature } = require('../billing/billing.middleware');
const { wrapHandlers: w } = require('../../utils/route-async');

const router = express.Router();

router.get('/dashboard', ...w(requireFeature('analytics'), controller.dashboard));
router.get('/audience', ...w(requireFeature('analytics'), controller.audience));
router.get('/campaign/:id', ...w(requireFeature('analytics'), controller.campaign));
router.get('/campaign/:id/breakdown', ...w(requireFeature('analytics'), controller.campaignBreakdown));
router.get('/campaign/:id/logs/:type', ...w(requireFeature('analytics'), controller.campaignLogs));
router.get('/campaign/:id/logs/:type/export', ...w(requireFeature('analytics'), controller.campaignLogsExport));

module.exports = router;
