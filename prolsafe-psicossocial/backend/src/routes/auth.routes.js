import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Credenciais inválidas.' });
  const token = jwt.sign({ id: user.id, role: user.role, companyId: user.companyId }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId } });
});

router.post('/forgot-password', async (req, res) => {
  res.json({ message: 'Caso o e-mail exista, enviaremos instruções de recuperação.' });
});

export default router;
