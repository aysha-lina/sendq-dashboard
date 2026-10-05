const express = require('express');
const dashboardController = require('./dashboard.controller');
const campaignController = require('../campaigns/campaign.controller');
const listController = require('./list.controller');
const templateController = require('../../controllers/templateController');
const { uploadThumbnail } = require('../../controllers/templateUpload.middleware');
const { uploadAssets } = require('../../controllers/assetUpload.middleware');
const sendingDomainController = require('../../controllers/sendingDomainController');
const { wrapHandlers: w } = require('../../utils/route-async');

const router = express.Router();

router.get('/dashboard', ...w(dashboardController.getDashboard));

router.get('/campaigns', ...w(campaignController.index));
router.post('/campaigns', ...w(campaignController.store));
router.get('/campaigns/:uid', ...w(campaignController.show));
router.put('/campaigns/:uid', ...w(campaignController.update));
router.delete('/campaigns/:uid', ...w(campaignController.destroy));
router.post('/campaigns/:uid/pause', ...w(campaignController.pause));
router.post('/campaigns/:uid/resume', ...w(campaignController.resume));
router.post('/campaigns/:uid/run', ...w(campaignController.run));
router.post('/campaigns/:uid/unschedule', ...w(campaignController.unschedule));
router.post('/campaigns/:uid/copy', ...w(campaignController.copy));
router.post('/campaigns/:uid/resend', ...w(campaignController.resend));
router.post('/campaigns/:uid/targets', ...w(campaignController.setTargets));
router.post('/campaigns/:uid/archive', ...w(campaignController.archive));
router.post('/campaigns/:uid/unarchive', ...w(campaignController.unarchive));

router.get('/lists', ...w(listController.index));
router.post('/lists', ...w(listController.store));
router.post('/public/subscribers', ...w(listController.publicSubscribe));
router.get('/lists/:uid', ...w(listController.show));
router.put('/lists/:uid', ...w(listController.update));
router.delete('/lists/:uid', ...w(listController.destroy));
router.post('/lists/:uid/copy', ...w(listController.copy));
router.get('/lists/:uid/settings', ...w(listController.settings));
router.put('/lists/:uid/settings', ...w(listController.updateSettings));
router.get('/lists/:uid/fields', ...w(listController.fields));
router.post('/lists/:uid/fields', ...w(listController.storeField));
router.put('/lists/:uid/fields/:fieldUid', ...w(listController.updateField));
router.delete('/lists/:uid/fields/:fieldUid', ...w(listController.destroyField));
router.get('/lists/:uid/segments', ...w(listController.segments));
router.post('/lists/:uid/segments', ...w(listController.storeSegment));
router.post('/lists/:uid/segments/:segmentUid/copy', ...w(listController.copySegment));
router.post('/lists/:uid/segments/preview-count', ...w(listController.countSegment));
router.get('/lists/:uid/segments/:segmentUid/count', ...w(listController.countSegment));
router.put('/lists/:uid/segments/:segmentUid', ...w(listController.updateSegment));
router.delete('/lists/:uid/segments/:segmentUid', ...w(listController.destroySegment));
router.get('/lists/:uid/forms', ...w(listController.forms));
router.post('/lists/:uid/forms', ...w(listController.storeForm));
router.put('/lists/:uid/forms/:formUid', ...w(listController.updateForm));
router.delete('/lists/:uid/forms/:formUid', ...w(listController.destroyForm));
router.post('/lists/:uid/subscribers/import/preview', ...w(listController.importPreview));
router.post('/lists/:uid/subscribers/import', ...w(listController.importSubscribers));
router.get('/lists/:uid/subscribers/export', ...w(listController.exportSubscribers));
router.get('/jobs/:queue/:jobId', ...w(listController.jobStatus));

// ─── Templates ────────────────────────────────────────────────────────────────
router.get('/templates', ...w(templateController.index));
router.post('/templates', ...w(templateController.store));
// Category routes must precede /templates/:uid so "categories" isn't read as a uid.
router.get('/templates/categories', ...w(templateController.categories));
router.post('/templates/categories', ...w(templateController.createCategory));
router.delete('/templates/categories/:id', ...w(templateController.deleteCategory));
router.get('/templates/:uid', ...w(templateController.show));
router.put('/templates/:uid', ...w(templateController.update));
router.delete('/templates/:uid', ...w(templateController.destroy));
router.post('/templates/:uid/copy', ...w(templateController.copy));
router.post('/templates/:uid/thumbnail', uploadThumbnail, ...w(templateController.uploadThumbnail));
router.post('/assets', uploadAssets, ...w(templateController.uploadAssets));

// ─── Sending Domains ──────────────────────────────────────────────────────────
router.get('/sending-domains', ...w(sendingDomainController.index));
router.post('/sending-domains', ...w(sendingDomainController.store));
router.get('/sending-domains/:id', ...w(sendingDomainController.show));
router.delete('/sending-domains/:id', ...w(sendingDomainController.destroy));
router.post('/sending-domains/:id/verify', ...w(sendingDomainController.verify));

module.exports = router;
