const users = require('../models/user-model');
const env = require('../config/env');
const jwt = require('jsonwebtoken');

const register = async (req, res) => {
    try {
        const { name, username, email, password, confirmPassword, role, registrationSecret } = req.body;


        if (registrationSecret !== env.registrationSecret) {
            return res.status(403).json({
                type: "error",
                message: "You are not authorized to register."
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                type: 'error',
                message: 'Passwords do not match.'
            });
        }

        const existing = await users.findByUsernameOrEmail(username, email);
        if (existing) {

            return res.status(400).json({
                type: 'error',
                message: 'Username or email is already taken.'
            });
        }

        const user = await users.createUser({ name, username, email, password, role: role || 'STAFF' });
        const tokenPayload = {
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            role: user.role,
            created: user.createdAt || new Date().toISOString()
        };
        const token = jwt.sign(tokenPayload, env.jwtSecret, { expiresIn: '7d' });

        res.cookie('accessToken', token, {
            httpOnly: true,
            signed: true,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        res.setHeader('Authorization', `${token}`);
        return res.status(200).json({
            type: 'success',
            message: 'User created'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            type: 'error',
            message: 'An error occurred while registering the user.'
        });
    }
};
const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const existingUser = await users.findByUsername(username);
        if (!existingUser) {
            return res.status(401).json({
                type: "error",
                message: "Invalid username or password."
            });
        }
        const isPasswordValid = await users.verifyPassword(existingUser, password);
        if (!isPasswordValid) {
            return res.status(401).json({
                type: "error",
                message: "Invalid username or password."
            });
        }

        if (!existingUser.isActive) {
            return res.status(403).json({
                type: "error",
                message: "Your account is deactivated. Please contact an administrator."
            });
        }

        await users.updateLastLogin(existingUser.id);

        const tokenPayload = {
            id: existingUser.id,
            name: existingUser.name,
            username: existingUser.username,
            email: existingUser.email,
            role: existingUser.role,
            created: existingUser.createdAt || new Date().toISOString()
        };
        const token = jwt.sign(tokenPayload, env.jwtSecret, { expiresIn: '7d' }); // expires in 7 days

        res.cookie('accessToken', token, {
            httpOnly: true,
            signed: true,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        res.setHeader('Authorization', `${token}`);
        return res.status(200).json({
            type: 'success',
            message: 'User logged in'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            type: 'error',
            message: 'An error occurred while logging in.'
        });
    }
};

const logout = (req, res) => {
    try {
        res.clearCookie('accessToken', {
            signed: true,
            httpOnly: true,
        });
        return res.status(200).json({
            type: 'success',
            message: 'User logged out'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            type: 'error',
            message: 'An error occurred while logging out.'
        });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { username, secretKey, newPassword } = req.body;

        if (!username || !secretKey || !newPassword) {
            return res.status(400).json({
                type: "error",
                message: "Please fill all required fields: username, secretKey, and newPassword."
            });
        }

        if (secretKey !== env.superAdminKey) {
            return res.status(403).json({
                type: "error",
                message: "Invalid secret key. Access denied."
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                type: "error",
                message: "New password must be at least 8 characters long."
            });
        }

        const user = await users.findByUsername(username);
        if (!user) {
            return res.status(404).json({
                type: "error",
                message: "Username not found or account is deactivated."
            });
        }

        await users.resetPassword(user.id, newPassword);

        return res.status(200).json({
            type: "success",
            message: "Password updated successfully."
        });

    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({
            type: "error",
            message: "An error occurred while resetting the password."
        });
    }
};

module.exports = { register, login, logout, forgotPassword };