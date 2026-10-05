const express = require('express');
const controller = require('./sending.controller');
const { mailLimiter } = require('../../bootstrap/middleware');
const { wrapHandlers: w } = require('../../utils/route-async');

const router = express.Router();

// Sending servers (customer SMTP/SES config)
router.get('/servers', ...w(controller.sendingServers));
router.post('/servers', ...w(controller.createSendingServer));
router.put('/servers/:id', ...w(controller.updateSendingServer));
router.delete('/servers/:id', ...w(controller.deleteSendingServer));
router.post('/servers/:id/test', ...w(controller.testSendingServer));

// Tracking domains
router.get('/tracking-domains', ...w(controller.trackingDomains));
router.post('/tracking-domains', ...w(controller.createTrackingDomain));
router.delete('/tracking-domains/:id', ...w(controller.deleteTrackingDomain));
router.post('/tracking-domains/:id/verify', ...w(controller.verifyTrackingDomain));

// Signatures
router.get('/signatures', ...w(controller.signatures));
router.post('/signatures', ...w(controller.createSignature));
router.put('/signatures/:id', ...w(controller.updateSignature));
router.delete('/signatures/:id', ...w(controller.deleteSignature));

// Email verification servers
router.get('/verification-servers', ...w(controller.verificationServers));
router.get('/verification-servers/:id', ...w(controller.verificationServerDetail));
router.post('/verification-servers', ...w(controller.createVerificationServer));
router.put('/verification-servers/:id', ...w(controller.updateVerificationServer));
router.delete('/verification-servers/:id', ...w(controller.deleteVerificationServer));

// Verification execution
router.post('/verify-email', mailLimiter, ...w(controller.verifyEmailNow));
router.post('/verify-run', ...w(controller.verifyRun));
router.post('/verify-reset', ...w(controller.verifyReset));
router.get('/verify-stats', ...w(controller.verifyStats));

// Verified senders (From-addresses)
const senders = require('./senders.controller');
router.get('/senders', ...w(senders.listSenders));
router.post('/senders', mailLimiter, ...w(senders.createSender));
router.post('/senders/:uid/verify', mailLimiter, ...w(senders.resendSenderVerification));
router.delete('/senders/:uid', ...w(senders.deleteSender));

// Blacklist (global suppression list)
router.get('/blacklist', ...w(controller.blacklist));
router.post('/blacklist', ...w(controller.createBlacklist));
router.post('/blacklist/import', ...w(controller.importBlacklist));
router.delete('/blacklist/:id', ...w(controller.deleteBlacklist));

// Sending-domain authentication check (SPF/DKIM/DMARC) for the campaign wizard
router.get('/domain-auth', ...w(controller.checkDomainAuth));

module.exports = router;
