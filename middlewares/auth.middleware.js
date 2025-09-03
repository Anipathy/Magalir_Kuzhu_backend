const { verifyToken } = require('../utils/jwt')

const verifyTokenMiddleware = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Access token missing' });
    }
    try {
        const decoded = await verifyToken(token);
        req.user = decoded;
        next();
    } catch (err) {
        console.log(err)
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
};

module.exports = {
    verifyTokenMiddleware
}