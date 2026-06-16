import { Router } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { prisma } from '../utils/prisma.js';
import { auth } from '../middleware/auth.js';
const router = Router();

router.post('/', auth(['ADMIN_PROLSAFE','CONSULTOR']), async (req, res) => {
const assessment = await prisma.assessment.create({
  data: { ...req.body, publicToken }
});

// Usa o domínio real do sistema que está fazendo a requisição.
// Exemplo: https://prolsafe-psicosocial-ikti-3qarq02ku-cesar-damasceno-s-projects.vercel.app
const appUrl = req.get('origin') || process.env.APP_URL;

const cleanAppUrl = appUrl
  .replace(/^APP_URL=/, '')
  .replace(/\/responder\/.*$/, '')
  .replace(/\/$/, '');

const link = `${cleanAppUrl}/responder/${publicToken}`;
const qrCode = await QRCode.toDataURL(link);

res.status(201).json({ ...assessment, link, qrCode });

router.get('/public/:token', async (req, res) => {
  const assessment = await prisma.assessment.findUnique({
    where: { publicToken: req.params.token },
    include: { company: { include: { sectors: true } } }
  });
  const dimensions = await prisma.dimension.findMany({ include: { questions: { where: { active: true } } } });
  res.json({ assessment, dimensions });
});

router.post('/public/:token/responses', async (req, res) => {
  const assessment = await prisma.assessment.findUnique({ where: { publicToken: req.params.token } });
  if (!assessment) return res.status(404).json({ error: 'Avaliação não encontrada.' });
  const response = await prisma.response.create({
    data: {
      assessmentId: assessment.id,
      sectorId: req.body.sectorId,
      answers: { create: req.body.answers.map(a => ({ questionId: a.questionId, value: Number(a.value) })) }
    }
  });
  res.status(201).json({ message: 'Resposta registrada com sucesso. Obrigado por contribuir com a melhoria do ambiente de trabalho.', responseId: response.id });
});

export default router;
