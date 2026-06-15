import jwt from 'jsonwebtoken';

export function auth(requiredRoles = []) {
  return (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Token ausente.' });
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET);
      if (requiredRoles.length && !requiredRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Acesso não autorizado.' });
      }
      req.user = user;
      next();
    } catch {
      res.status(401).json({ error: 'Token inválido.' });
    }
  };
}
