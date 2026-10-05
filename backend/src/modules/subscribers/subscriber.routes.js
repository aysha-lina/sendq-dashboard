const express = require('express');
const controller = require('./subscriber.controller');
const { requireFeature } = require('../billing/billing.middleware');
const { mailLimiter } = require('../../bootstrap/middleware');
const { wrapHandlers: w } = require('../../utils/route-async');

const router = express.Router();

router.get('/', ...w(requireFeature('subscribers'), controller.index));
router.post('/', ...w(requireFeature('subscribers'), controller.store));
router.post('/bulk/delete', ...w(requireFeature('subscribers'), controller.bulkDelete));
router.post('/bulk/status', ...w(requireFeature('subscribers'), controller.bulkUpdateStatus));
router.post('/bulk/move', ...w(requireFeature('subscribers'), controller.bulkMove));
router.post('/bulk/copy', ...w(requireFeature('subscribers'), controller.bulkCopy));
router.post('/bulk/send-confirmation', mailLimiter, ...w(requireFeature('subscribers'), controller.bulkSendConfirmation));
router.post('/bulk/add-tag', ...w(requireFeature('subscribers'), controller.bulkAddTag));
router.post('/bulk/remove-tag', ...w(requireFeature('subscribers'), controller.bulkRemoveTag));
router.post('/bulk/assign-fields', ...w(requireFeature('subscribers'), controller.bulkAssignFields));
router.post('/bulk/blacklist', ...w(requireFeature('subscribers'), controller.bulkBlacklist));
router.get('/:uid', ...w(requireFeature('subscribers'), controller.show));
router.get('/:uid/timeline', ...w(requireFeature('subscribers'), controller.timeline));
router.put('/:uid', ...w(requireFeature('subscribers'), controller.update));
router.delete('/:uid', ...w(requireFeature('subscribers'), controller.destroy));

module.exports = router;
