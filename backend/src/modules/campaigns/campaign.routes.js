const express = require('express');
const controller = require('./campaign.controller');
const { enforceDailyEmailLimit, requireFeature } = require('../billing/billing.middleware');
const { uploadAttachment } = require('./attachment.middleware');
const { wrapHandlers: w } = require('../../utils/route-async');

const router = express.Router();

router.get('/', ...w(requireFeature('campaigns'), controller.index));
router.post('/', ...w(requireFeature('campaigns'), controller.store));
router.post('/spam-score', ...w(requireFeature('campaigns'), controller.spamScore));
router.get('/:uid', ...w(requireFeature('campaigns'), controller.show));
router.put('/:uid', ...w(requireFeature('campaigns'), controller.update));
router.delete('/:uid', ...w(requireFeature('campaigns'), controller.destroy));
router.post('/:uid/pause', ...w(requireFeature('campaigns'), controller.pause));
router.post('/:uid/resume', ...w(requireFeature('campaigns'), controller.resume));
router.post('/:uid/run', ...w(requireFeature('campaigns'), enforceDailyEmailLimit, controller.run));
router.post('/:uid/unschedule', ...w(requireFeature('campaigns'), controller.unschedule));
router.post('/:uid/test', ...w(requireFeature('campaigns'), controller.test));
router.get('/:uid/preview', ...w(requireFeature('campaigns'), controller.preview));
router.get('/:uid/attachments', ...w(requireFeature('campaigns'), controller.listAttachments));
router.post('/:uid/attachments', ...w(requireFeature('campaigns')), uploadAttachment, ...w(controller.uploadAttachment));
router.delete('/:uid/attachments/:attId', ...w(requireFeature('campaigns'), controller.removeAttachment));
router.post('/send/:id', ...w(requireFeature('campaigns'), enforceDailyEmailLimit, controller.send));

module.exports = router;
