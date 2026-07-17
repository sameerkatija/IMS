require('dotenv').config();

module.exports = {  
    PORT : process.env.PORT || 3000,
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
    DATABASE_URL: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV || 'development',
    cookieSecret: process.env.COOKIE_SECRET,
    jwtSecret: process.env.JWT_SECRET,
    registrationSecret: process.env.REGISTRATION_SECRET,
    superAdminKey: process.env.SUPERADMINKEY || 'mySuperSecretAdminKey123',
}