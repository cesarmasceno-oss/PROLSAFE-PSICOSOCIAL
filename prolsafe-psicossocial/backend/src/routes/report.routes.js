import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { auth } from '../middleware/auth.js';
import { calculateResults } from '../services/scoring.service.js';
import { generateCorporateReportPdf } from '../services/corporate-report.service.js';

const router = Router();

router.post(
  '/assessment/:id',
  auth(['ADMIN_PROLSAFE', 'CONSULTOR']),
  async (req, res) => {
    try {
      const assessment = await prisma.assessment.findUnique({
        where: { id: req.params.id },
        include: {
          company: { include: { sectors: true } },
          responses: {
            include: {
              sector: true,
              answers: {
                include: {
                  question: {
                    include: { dimension: true }
                  }
                }
              }
            }
          }
        }
      });

      if (!assessment) {
        return res.status(404).json({ error: 'Avaliação não encontrada.' });
      }

      const results = calculateResults(assessment.responses);
      const expected =
        assessment.company.totalColabs ||
        assessment.company.sectors.reduce(
          (total, sector) => total + Number(sector.employees || 0),
          0
        );
      const responseRate = expected
        ? Number(((assessment.responses.length / expected) * 100).toFixed(1))
        : 0;

      const pdfUrl = await generateCorporateReportPdf({
        assessment,
        results,
        responseRate
      });

      const report = await prisma.report.create({
        data: {
          assessmentId: assessment.id,
          pdfUrl
        }
      });

      res.json({ report, pdfUrl });
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      res.status(500).json({ error: 'Erro ao gerar relatório PDF.' });
    }
  }
);

export default router;
