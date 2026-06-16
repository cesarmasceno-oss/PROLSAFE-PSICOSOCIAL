import { Router } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { prisma } from '../utils/prisma.js';
import { auth } from '../middleware/auth.js';

const router = Router();

function cleanAppUrl(value) {
  let url = String(value || '').trim();

  url = url
    .replace(/^APP_URL=/i, '')
    .replace(/\/responder\/.*$/i, '')
    .replace(/\/+$/, '');

  if (url.startsWith('https:/') && !url.startsWith('https://')) {
    url = url.replace('https:/', 'https://');
  }

  if (url.startsWith('http:/') && !url.startsWith('http://')) {
    url = url.replace('http:/', 'http://');
  }

  return url;
}

router.post('/', auth(['ADMIN_PROLSAFE', 'CONSULTOR']), async (req, res) => {
  try {
    const publicToken = crypto.randomBytes(20).toString('hex');

    const assessment = await prisma.assessment.create({
      data: {
        ...req.body,
        publicToken
      }
    });

    const origin = req.get('origin');
    const appUrl = cleanAppUrl(origin || process.env.APP_URL);

    const link = `${appUrl}/responder/${publicToken}`;
    const qrCode = await QRCode.toDataURL(link);

    res.status(201).json({
      ...assessment,
      link,
      qrCode
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao gerar avaliação.' });
  }
});

router.get('/public/:token', async (req, res) => {
  try {
    const assessment = await prisma.assessment.findUnique({
      where: {
        publicToken: req.params.token
      },
      include: {
        company: {
          include: {
            sectors: true
          }
        }
      }
    });

    if (!assessment) {
      return res.status(404).json({ error: 'Avaliação não encontrada.' });
    }

    const dimensions = await prisma.dimension.findMany({
      include: {
        questions: {
          where: {
            active: true
          }
        }
      }
    });

    res.json({
      assessment,
      dimensions
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar questionário.' });
  }
});

router.post('/public/:token/responses', async (req, res) => {
  try {
    const assessment = await prisma.assessment.findUnique({
      where: {
        publicToken: req.params.token
      }
    });

    if (!assessment) {
      return res.status(404).json({ error: 'Avaliação não encontrada.' });
    }

    const response = await prisma.response.create({
      data: {
        assessmentId: assessment.id,
        sectorId: req.body.sectorId,
        answers: {
          create: req.body.answers.map(a => ({
            questionId: a.questionId,
            value: Number(a.value)
          }))
        }
      }
    });

    res.status(201).json({
      message:
        'Resposta registrada com sucesso. Obrigado por contribuir com a melhoria do ambiente de trabalho.',
      responseId: response.id
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao registrar resposta.' });
  }
});

export default router;