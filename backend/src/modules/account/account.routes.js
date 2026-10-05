const express = require('express');
const controller = require('./account.controller');
const { requireRole } = require('../auth/rbac');
const { uploadAvatar } = require('./upload.middleware');
const { wrapHandlers: w } = require('../../utils/route-async');

const router = express.Router();

router.get('/overview', ...w(controller.overview));
router.put('/profile', ...w(controller.updateProfile));
router.put('/contact', ...w(controller.updateContact));
router.put('/password', ...w(controller.changePassword));
router.post('/logout-all', ...w(controller.logoutAll));
router.get('/2fa', ...w(controller.twoFactorStatus));
router.post('/2fa/setup', ...w(controller.twoFactorSetup));
router.post('/2fa/enable', ...w(controller.twoFactorEnable));
router.post('/2fa/disable', ...w(controller.twoFactorDisable));
router.post('/avatar', uploadAvatar, ...w(controller.uploadAvatar));
router.delete('/avatar', ...w(controller.removeAvatar));
router.get('/users', ...w(controller.users));
router.post('/users', ...w(controller.createUser));
router.put('/users/:uid', ...w(controller.updateUser));
router.delete('/users/:uid', ...w(controller.deleteUser));
router.get('/roles', ...w(controller.roles));
router.get('/subscription', ...w(controller.subscription));
router.get('/logs', ...w(controller.logs));
router.get('/admin', ...w(requireRole('super_admin'), controller.admin));

module.exports = router;
