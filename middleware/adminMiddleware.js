// middleware/adminMiddleware.js

const adminMiddleware = (req, res, next) => {
    // We assume authMiddleware has already run and attached the user to req
    if (req.user && req.user.role === 'admin') {
        next(); // User is an admin, proceed to the next function
    } else {
        res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
};

module.exports = adminMiddleware;