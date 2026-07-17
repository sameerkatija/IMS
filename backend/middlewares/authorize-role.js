
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ "type": "error", "message": 'You must be logged in to do that.' }); 
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ "type": "error", "message": 'You do not have permission to perform this action.' });
    }
    next();
  };
}

module.exports = authorize;