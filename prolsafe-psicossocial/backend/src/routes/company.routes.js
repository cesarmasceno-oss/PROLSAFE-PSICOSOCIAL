import express from 'express';
import { prisma } from '../utils/prisma.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.use(auth());

router.get('/', async (req, res) => {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        sectors: true,
        assessments: true
      }
    });

    res.json(companies);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar empresas.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      razaoSocial,
      nomeFantasia,
      cnpj,
      cnae,
      grauRisco,
      endereco,
      cidadeEstado,
      responsavel,
      email,
      telefone,
      totalColabs,
      status,
      sectors = []
    } = req.body;

    const company = await prisma.company.create({
      data: {
        razaoSocial,
        nomeFantasia,
        cnpj,
        cnae,
        grauRisco,
        endereco,
        cidadeEstado,
        responsavel,
        email,
        telefone,
        totalColabs: Number(totalColabs || 0),
        status: status || 'ATIVA',
        sectors: {
          create: sectors.map(s => ({
            name: s.name,
            employees: Number(s.employees || 0)
          }))
        }
      },
      include: {
        sectors: true,
        assessments: true
      }
    });

    res.status(201).json(company);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao cadastrar empresa.' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const {
      razaoSocial,
      nomeFantasia,
      cnpj,
      cnae,
      grauRisco,
      endereco,
      cidadeEstado,
      responsavel,
      email,
      telefone,
      totalColabs,
      status
    } = req.body;

    const company = await prisma.company.update({
      where: { id },
      data: {
        razaoSocial,
        nomeFantasia,
        cnpj,
        cnae,
        grauRisco,
        endereco,
        cidadeEstado,
        responsavel,
        email,
        telefone,
        totalColabs: Number(totalColabs || 0),
        status
      },
      include: {
        sectors: true,
        assessments: true
      }
    });

    res.json(company);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar empresa.' });
  }
});
router.post('/:id/sectors', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, employees } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome do setor é obrigatório.' });
    }

    const sector = await prisma.sector.create({
      data: {
        name,
        employees: Number(employees || 0),
        companyId: id
      }
    });

    res.status(201).json(sector);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao cadastrar setor.' });
  }
});

router.put('/sectors/:sectorId', async (req, res) => {
  try {
    const { sectorId } = req.params;
    const { name, employees } = req.body;

    const sector = await prisma.sector.update({
      where: { id: sectorId },
      data: {
        name,
        employees: Number(employees || 0)
      }
    });

    res.json(sector);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar setor.' });
  }
});

router.delete('/sectors/:sectorId', async (req, res) => {
  try {
    const { sectorId } = req.params;

    await prisma.answer.deleteMany({
      where: {
        response: {
          sectorId
        }
      }
    });

    await prisma.response.deleteMany({
      where: { sectorId }
    });

    await prisma.sector.delete({
      where: { id: sectorId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Erro ao excluir setor. Verifique se existem respostas vinculadas.'
    });
  }
});
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.$transaction(async tx => {
      const assessments = await tx.assessment.findMany({
        where: { companyId: id },
        select: { id: true }
      });

      const assessmentIds = assessments.map(a => a.id);

      if (assessmentIds.length > 0) {
        await tx.answer.deleteMany({
          where: {
            response: {
              assessmentId: {
                in: assessmentIds
              }
            }
          }
        });

        await tx.response.deleteMany({
          where: {
            assessmentId: {
              in: assessmentIds
            }
          }
        });

        await tx.report.deleteMany({
          where: {
            assessmentId: {
              in: assessmentIds
            }
          }
        });

        await tx.actionPlan.deleteMany({
          where: {
            assessmentId: {
              in: assessmentIds
            }
          }
        });

        await tx.assessment.deleteMany({
          where: {
            id: {
              in: assessmentIds
            }
          }
        });
      }

      await tx.actionPlan.deleteMany({
        where: { companyId: id }
      });

      await tx.user.deleteMany({
        where: { companyId: id }
      });

      await tx.sector.deleteMany({
        where: { companyId: id }
      });

      await tx.company.delete({
        where: { id }
      });
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Erro ao excluir empresa. Ainda existem vínculos relacionados.'
    });
  }
});

export default router;