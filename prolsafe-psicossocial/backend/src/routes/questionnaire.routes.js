import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { auth } from '../middleware/auth.js';

const router = Router();

const allowedRoles = ['ADMIN_PROLSAFE', 'CONSULTOR'];

const hseDefault = [
  {
    name: 'Demandas',
    description: 'Avalia volume de trabalho, ritmo, pressão por prazos e exigências da atividade.',
    inverted: true,
    questions: [
      'Tenho que trabalhar muito intensamente.',
      'Tenho prazos impossíveis de cumprir.',
      'Tenho que negligenciar algumas tarefas porque tenho muito trabalho.',
      'Não consigo fazer pausas suficientes durante o trabalho.',
      'Sou pressionado a trabalhar além do meu horário normal.'
    ]
  },
  {
    name: 'Controle',
    description: 'Avalia autonomia, liberdade de decisão e possibilidade de influenciar a forma de executar o trabalho.',
    inverted: false,
    questions: [
      'Posso decidir como realizar meu trabalho.',
      'Tenho liberdade para organizar minha rotina de trabalho.',
      'Posso influenciar decisões relacionadas às minhas atividades.',
      'Tenho possibilidade de utilizar minhas habilidades no trabalho.',
      'Posso escolher a forma mais adequada para executar minhas tarefas.'
    ]
  },
  {
    name: 'Relacionamentos',
    description: 'Avalia conflitos, convivência, respeito, cooperação e exposição a comportamentos inadequados.',
    inverted: true,
    questions: [
      'Sou alvo de comportamentos hostis no ambiente de trabalho.',
      'Existem conflitos frequentes entre pessoas da equipe.',
      'Presencio situações de desrespeito no trabalho.',
      'Há dificuldades de convivência entre colegas.',
      'Sinto que o ambiente favorece tensão ou constrangimento.'
    ]
  },
  {
    name: 'Cargo',
    description: 'Avalia clareza de função, responsabilidades, metas e expectativas.',
    inverted: false,
    questions: [
      'Sei claramente quais são minhas responsabilidades.',
      'Entendo o que se espera de mim no trabalho.',
      'Minhas funções são bem definidas.',
      'Recebo informações claras sobre minhas tarefas.',
      'Minhas metas e prioridades são compreensíveis.'
    ]
  },
  {
    name: 'Mudança',
    description: 'Avalia comunicação, participação e suporte durante mudanças organizacionais.',
    inverted: false,
    questions: [
      'Sou informado com antecedência sobre mudanças no trabalho.',
      'Recebo explicações claras sobre mudanças que afetam minhas atividades.',
      'Tenho oportunidade de opinar sobre mudanças relevantes.',
      'As mudanças são comunicadas de forma transparente.',
      'Recebo suporte adequado durante processos de mudança.'
    ]
  },
  {
    name: 'Apoio da Chefia',
    description: 'Avalia suporte, orientação, feedback e disponibilidade da liderança.',
    inverted: false,
    questions: [
      'Recebo apoio adequado da minha chefia.',
      'Minha chefia está disponível quando preciso de orientação.',
      'Recebo feedback útil sobre meu trabalho.',
      'Minha liderança demonstra escuta e respeito.',
      'Tenho suporte técnico e organizacional da chefia.'
    ]
  },
  {
    name: 'Apoio dos Colegas',
    description: 'Avalia cooperação, integração, suporte entre pares e clima de equipe.',
    inverted: false,
    questions: [
      'Recebo ajuda dos colegas quando necessário.',
      'Existe cooperação entre as pessoas da equipe.',
      'Sinto apoio dos colegas no dia a dia.',
      'A equipe trabalha de forma integrada.',
      'Os colegas contribuem para um bom clima de trabalho.'
    ]
  }
];

router.get('/default', auth(allowedRoles), async (_, res) => {
  try {
    const dimensions = await prisma.dimension.findMany({
      orderBy: { name: 'asc' },
      include: {
        questions: {
          orderBy: { text: 'asc' }
        }
      }
    });

    res.json(dimensions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar questionário.' });
  }
});

router.post('/seed-hse', auth(allowedRoles), async (_, res) => {
  try {
    for (const dim of hseDefault) {
      const dimension = await prisma.dimension.upsert({
        where: { name: dim.name },
        update: {
          description: dim.description,
          inverted: dim.inverted
        },
        create: {
          name: dim.name,
          description: dim.description,
          inverted: dim.inverted
        }
      });

      for (const text of dim.questions) {
        const existing = await prisma.question.findFirst({
          where: {
            text,
            dimensionId: dimension.id
          }
        });

        if (!existing) {
          await prisma.question.create({
            data: {
              text,
              active: true,
              dimensionId: dimension.id
            }
          });
        }
      }
    }

    const dimensions = await prisma.dimension.findMany({
      include: { questions: true }
    });

    res.json({
      success: true,
      message: 'Banco padrão HSE-IT criado/atualizado com sucesso.',
      dimensions
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar banco padrão HSE-IT.' });
  }
});

router.post('/dimensions', auth(allowedRoles), async (req, res) => {
  try {
    const { name, description, inverted = false } = req.body;

    const dimension = await prisma.dimension.create({
      data: {
        name,
        description,
        inverted: Boolean(inverted)
      }
    });

    res.status(201).json(dimension);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar dimensão.' });
  }
});

router.put('/dimensions/:id', auth(allowedRoles), async (req, res) => {
  try {
    const { name, description, inverted } = req.body;

    const dimension = await prisma.dimension.update({
      where: { id: req.params.id },
      data: {
        name,
        description,
        inverted: Boolean(inverted)
      }
    });

    res.json(dimension);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar dimensão.' });
  }
});

router.post('/questions', auth(allowedRoles), async (req, res) => {
  try {
    const { text, dimensionId, active = true } = req.body;

    const question = await prisma.question.create({
      data: {
        text,
        dimensionId,
        active: Boolean(active)
      },
      include: {
        dimension: true
      }
    });

    res.status(201).json(question);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar pergunta.' });
  }
});

router.put('/questions/:id', auth(allowedRoles), async (req, res) => {
  try {
    const { text, dimensionId, active } = req.body;

    const question = await prisma.question.update({
      where: { id: req.params.id },
      data: {
        text,
        dimensionId,
        active: Boolean(active)
      },
      include: {
        dimension: true
      }
    });

    res.json(question);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar pergunta.' });
  }
});

router.patch('/questions/:id/toggle', auth(allowedRoles), async (req, res) => {
  try {
    const current = await prisma.question.findUnique({
      where: { id: req.params.id }
    });

    if (!current) {
      return res.status(404).json({ error: 'Pergunta não encontrada.' });
    }

    const question = await prisma.question.update({
      where: { id: req.params.id },
      data: {
        active: !current.active
      }
    });

    res.json(question);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao ativar/desativar pergunta.' });
  }
});

router.delete('/questions/:id', auth(allowedRoles), async (req, res) => {
  try {
    await prisma.question.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Não foi possível excluir. A pergunta pode ter respostas vinculadas.'
    });
  }
});

export default router;