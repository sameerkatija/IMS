const users = require('../models/user-model');
const env = require('../config/env');

const getUserProfile = async (req, res) => {
    try {
        const username = req.user.username; // Assuming the username is stored in the token payload
        const userProfile = await users.findByUsername(username);
        if (!userProfile) {
            return res.status(404).json({type: "error", message: "User not found"});
        }
        return res.status(200).json({type: "success", data: userProfile});
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({type: "error", message: "An error occurred while fetching the user profile."});
    }
} ;

const resetUserPassword = async (req, res) => {
    try {
        const targetUserId = Number(req.params.id);
        const { newPassword } = req.body;

        const targetUser = await users.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ type: "error", message: "User not found." });
        }

        await users.resetPassword(targetUserId, newPassword);

        return res.status(200).json({
            type: "success",
            message: "User password reset successfully."
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            type: "error",
            message: "An error occurred while resetting the user password."
        });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const usersList = await users.findAllUsers();
        return res.status(200).json({ type: "success", data: usersList });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ type: "error", message: "An error occurred while fetching users list." });
    }
};

const updateUser = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { isActive } = req.body;

        const targetUser = await users.findById(id);
        if (!targetUser) {
            return res.status(404).json({ type: "error", message: "User not found." });
        }

        // Prevent admin deactivating themselves!
        if (id === req.user.id && isActive === false) {
            return res.status(400).json({ type: "error", message: "You cannot suspend your own admin account." });
        }

        const updatedUser = await users.updateUserStatus(id, isActive);
        return res.status(200).json({
            type: "success",
            message: `User account ${isActive ? "activated" : "suspended"} successfully.`,
            data: updatedUser
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ type: "error", message: "An error occurred while updating the user." });
    }
};
 
module.exports = { getUserProfile, resetUserPassword, getAllUsers, updateUser };