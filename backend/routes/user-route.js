const Express = require('express');
const router = Express.Router();
const userController = require('../controllers/user-controller');
const authorize = require('../middlewares/authorize-role');
const validate = require('../middlewares/zod-schema-validator');
const { adminResetPasswordSchema } = require('../config/zod-schema');

router.get('/me'  , userController.getUserProfile);
router.get('/', authorize('ADMIN'), userController.getAllUsers);
router.put('/:id', authorize('ADMIN'), userController.updateUser);
router.post('/:id/reset-password', authorize('ADMIN'), validate(adminResetPasswordSchema), userController.resetUserPassword);

module.exports = router;