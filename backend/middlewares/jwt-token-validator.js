const jwt = require("jsonwebtoken");
const env = require("../config/env");

const isAuthenticated = (req, res, next) => {
    // const token = req.signedCookies.accessToken; // Replace with your cookie name
    const token = req.headers.authorization?.replace("Bearer ", "");
    // const token = req.headers.authorization; // ?.split(" ")[1]; // Assuming the token is sent in the Authorization header
    if (!token) {
        return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    try {
        const decoded = jwt.verify(token, env.jwtSecret);

        // Make user available in subsequent middleware/routes
        req.user = decoded;

        next();
    } catch (err) {
        // Token expired or invalid
        return res.status(401).json({ message: "Unauthorized: Invalid or expired token" });
    }
};

module.exports = isAuthenticated;