import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { auth } from '../middleware/auth.js';
import { calculateResults } from '../services/scoring.service.js';
import { generateReportPdf } from '../services/pdf.service.js';
const router = Router();

router.post('/assessment/:id', auth(['ADMIN_PROLSAFE','CONSULTOR']), async (req, res) => {
  const assessment = await prisma.assessment.findUnique({
    where: { id: req.params.id },
    include: { company: { include: { sectors: true } }, responses: { include: { sector: true, answers: { include: { question: { include: { dimension: true } } } } } } }
  });
  const results = calculateResults(assessment.responses);
  const expected = assessment.company.totalColabs || assessment.company.sectors.reduce((a, s) => a + s.employees, 0);
  const responseRate = expected ? Number(((assessment.responses.length / expected) * 100).toFixed(1)) : 0;
  const pdfUrl = generateReportPdf({ assessment, results, responseRate });
  const report = await prisma.report.create({ data: { assessmentId: assessment.id, pdfUrl } });
  res.json({ report, pdfUrl });
});

export default router;
