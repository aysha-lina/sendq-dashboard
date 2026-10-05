const express = require('express');
const { body, validationResult } = require('express-validator');
const controller = require('./billing.controller');
const { wrapHandlers: w } = require('../../utils/route-async');

const router = express.Router();

// Every checkout path resolves a plan by numeric id — reject anything non-integer
// up front so a malformed plan_id can't reach the gateway / Prisma layer (S6).
const validatePlan = [
  body('plan_id').isInt({ min: 1 }).withMessage('plan_id must be a positive integer'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
    next();
  },
];

router.get('/current', ...w(controller.current));
router.get('/plans', (req, res) => res.json({ plans: require('./billing.middleware').defaultPlans }));
router.get('/plans/db', ...w(controller.planList));
router.get('/credit-plans', ...w(controller.creditPlans));
router.get('/credits', ...w(controller.credits));
router.post('/credit-plans/:uid/buy', ...w(controller.buyCredits));
router.get('/invoices', ...w(controller.invoices));
router.get('/invoices/:uid/pdf', ...w(controller.invoicePdf));
router.post('/checkout', validatePlan, ...w(controller.checkout));
router.post('/confirm', ...w(controller.confirm));
router.post('/change-plan', validatePlan, ...w(controller.changePlan));
router.post('/cancel', ...w(controller.cancel));
router.post('/paypal/checkout', validatePlan, ...w(controller.paypalCheckout));
router.post('/paypal/confirm', ...w(controller.paypalConfirm));
router.post('/paymob/checkout', validatePlan, ...w(controller.paymobCheckout));
router.post('/paymob/confirm', ...w(controller.paymobConfirm));
router.post('/offline/checkout', validatePlan, ...w(controller.offlineCheckout));

module.exports = router;
