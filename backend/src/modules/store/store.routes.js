const express = require('express');
const c = require('./store.controller');
const { wrapHandlers: w } = require('../../utils/route-async');

const router = express.Router();

router.get('/summary', ...w(c.summary));

router.get('/products', ...w(c.products));
router.post('/products', ...w(c.createProduct));
router.put('/products/:id', ...w(c.updateProduct));
router.delete('/products/:id', ...w(c.deleteProduct));

router.get('/categories', ...w(c.categories));
router.post('/categories', ...w(c.createCategory));
router.put('/categories/:id', ...w(c.updateCategory));
router.delete('/categories/:id', ...w(c.deleteCategory));

router.get('/attributes', ...w(c.attributes));
router.post('/attributes', ...w(c.createAttribute));
router.put('/attributes/:id', ...w(c.updateAttribute));
router.delete('/attributes/:id', ...w(c.deleteAttribute));

router.get('/funnels', ...w(c.funnels));
router.post('/funnels', ...w(c.createFunnel));
router.put('/funnels/:id', ...w(c.updateFunnel));
router.delete('/funnels/:id', ...w(c.deleteFunnel));

router.get('/orders', ...w(c.orders));
router.post('/orders', ...w(c.createOrder));
router.put('/orders/:id', ...w(c.updateOrder));
router.delete('/orders/:id', ...w(c.deleteOrder));

router.get('/media', ...w(c.media));
router.post('/media', ...w(c.createMedia));
router.delete('/media/:id', ...w(c.deleteMedia));

module.exports = router;
