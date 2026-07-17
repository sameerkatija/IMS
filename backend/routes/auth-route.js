const Express = require('express');
const router = Express.Router();
const authController = require('../controllers/auth-controller');
const validate = require('../middlewares/zod-schema-validator');
const {signUpSchema, signInSchema} = require("../config/zod-schema");

router.post('/login', validate(signInSchema), authController.login);
router.post('/register', validate(signUpSchema), authController.register);
router.post('/logout', authController.logout);
router.post('/forgot-password', authController.forgotPassword);

module.exports = router;