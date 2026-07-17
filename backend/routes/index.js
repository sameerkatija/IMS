const Express = require('express');
const router = Express.Router();
const prisma = require('../config/prisma');
const isAuthenticated = require('../middlewares/jwt-token-validator');

router.get('/', async (req, res) => {
    let dbStatus = 'unknown';
    try {
        await prisma.$queryRaw`SELECT 1`;
        dbStatus = 'connected';
    } catch (err) {
        dbStatus = 'disconnected';
    }
    return res.status(200).json({
        message: 'API is working',
        dbStatus: dbStatus
    });
});


router.get('/req-auth', isAuthenticated, async (req, res) => {
    let dbStatus = 'unknown';

    try {
        await prisma.$queryRaw`SELECT 1`;
        dbStatus = 'connected';
    } catch (err) {
        dbStatus = 'disconnected';
    }
    return res.status(200).json({
        message: 'API is working',
        dbStatus: dbStatus
    });
});



router.use('/auth', require('./auth-route'));

router.use(isAuthenticated);
router.use('/user', require('./user-route'));
router.use('/product', require('./product-route'));
router.use('/product-category', require('./product-category-route'));
router.use('/customer', require('./customer-route'));
router.use('/supplier', require("./supplier-route"));
router.use('/salesman', require("./salesman-route"));
router.use('/sales-target', require("./sales-target-route"));
router.use('/stock', require('./stock-route'));
router.use('/purchase', require('./purchase-route'));
router.use('/purchase-return', require('./purchase-return-route'));
router.use('/invoice', require('./invoice-route'));
router.use('/sales-return', require('./sales-return-route'));
router.use('/payment', require('./payment-route'));
router.use('/report', require('./report-route'));

router.use('/expense', require('./expense-route'));
router.use('/expense-category', require('./expense-category-route'));

module.exports = router;