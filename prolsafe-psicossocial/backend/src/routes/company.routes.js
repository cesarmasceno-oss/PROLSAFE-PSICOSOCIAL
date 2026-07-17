import express from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { prisma } from '../utils/prisma.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.use(auth());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1
  },
  fileFilter: (_, file, callback) => {
    const name = String(file.originalname || '').toLowerCase();
    const validExtension = name.endsWith('.xls') || name.endsWith('.xlsx');

    if (!validExtension) {
      return callback(new Error('Envie uma planilha nos formatos XLS ou XLSX.'));
    }

    callback(null, true);
  }
});

function cleanText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(value) {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function onlyDigits(value) {
  return cleanText(value).replace(/\D/g, '');
}

function firstValue(row, aliases) {
  for (const alias of aliases) {
    const value = row[normalizeKey(alias)];
    if (cleanText(value)) return cleanText(value);
  }

  return '';
}

function joinParts(parts, separator = ', ') {
  return parts.map(cleanText).filter(Boolean).join(separator);
}

function findHeaderRow(matrix) {
  const strongHeaders = new Set([
    'nome unidade',
    'razao social unid',
    'razao social unidade',
    'cnpj unidade',
    'nome setor',
    'nome cargo',
    'nome funcion',
    'nome funcionario',
    'dt nascimento',
    'dt admissao',
    'grau de risco'
  ]);

  let bestIndex = -1;
  let bestScore = 0;

  matrix.slice(0, 30).forEach((row, index) => {
    const normalized = (row || []).map(normalizeKey).filter(Boolean);
    const score = normalized.reduce(
      (total, header) => total + (strongHeaders.has(header) ? 1 : 0),
      0
    );

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  if (bestIndex < 0 || bestScore < 3) {
    throw new Error(
      'Não foi possível identificar o cabeçalho da planilha. Utilize o Modelo 1 do SOC.'
    );
  }

  return bestIndex;
}

function rowsFromWorkbook(buffer) {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    raw: false,
    cellDates: false
  });

  if (!workbook.SheetNames.length) {
    throw new Error('A planilha não possui abas para importação.');
  }

  const sheetName =
    workbook.SheetNames.find(name => normalizeKey(name).includes('modelo 1')) ||
    workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false
  });

  if (!matrix.length) {
    throw new Error('A planilha está vazia.');
  }

  const headerIndex = findHeaderRow(matrix);
  const headers = (matrix[headerIndex] || []).map((value, index) => {
    return normalizeKey(value) || `coluna ${index + 1}`;
  });

  const rows = matrix
    .slice(headerIndex + 1)
    .map(values => {
      const row = {};

      headers.forEach((header, index) => {
        if (!(header in row) || !cleanText(row[header])) {
          row[header] = values?.[index] ?? '';
        }
      });

      return row;
    })
    .filter(row => Object.values(row).some(value => cleanText(value)));

  if (!rows.length) {
    throw new Error('Nenhum colaborador foi encontrado na planilha.');
  }

  return { rows, sheetName };
}

function extractImportData(rows) {
  const companyRow =
    rows.find(row =>
      firstValue(row, [
        'Razão Social Unid.',
        'Razão Social Unidade',
        'Nome Unidade',
        'CNPJ Unidade'
      ])
    ) || rows[0];

  const nomeUnidade = firstValue(companyRow, ['Nome Unidade', 'Nome Fantasia']);
  const razaoSocial =
    firstValue(companyRow, [
      'Razão Social Unid.',
      'Razão Social Unidade',
      'Razão Social'
    ]) || nomeUnidade;

  if (!razaoSocial) {
    throw new Error('A Razão Social/Nome da Unidade não foi encontrada.');
  }

  const cnpj = firstValue(companyRow, ['CNPJ Unidade', 'CNPJ']);
  const cnae = firstValue(companyRow, [
    'CNAE 2.0',
    'CNAE',
    'CNAE Livre',
    'CNAE 7'
  ]);
  const grauRisco = firstValue(companyRow, ['Grau de Risco']);

  const enderecoBase = firstValue(companyRow, [
    'Endereço Unidade',
    'Endereco Unidade'
  ]);
  const numero = firstValue(companyRow, [
    'Número Endereço Unidade',
    'Numero Endereco Unidade'
  ]);
  const complemento = firstValue(companyRow, [
    'Complemento Endereço Unidade',
    'Complemento Endereco Unidade'
  ]);
  const bairro = firstValue(companyRow, ['Bairro Unidade']);
  const cep = firstValue(companyRow, ['CEP Unidade']);
  const cidade = firstValue(companyRow, ['Cidade Unidade']);
  const estado = firstValue(companyRow, ['Estado Unidade']);

  const endereco = joinParts([
    joinParts([enderecoBase, numero], ', '),
    complemento,
    bairro,
    cep ? `CEP ${cep}` : ''
  ]);

  const cidadeEstado = joinParts([cidade, estado], ' / ');
  const responsavel = firstValue(companyRow, [
    'Contato Unid',
    'Nome Gestor',
    'Identificação Gestor',
    'Responsável'
  ]);
  const email = firstValue(companyRow, [
    'E-mail Unidade',
    'Email Unidade',
    'E-mail da Unidade'
  ]);
  const telefone = firstValue(companyRow, [
    'Tel1 Unidade',
    'Telefone Comercial',
    'Telefone Celular',
    'Tel2 Unidade'
  ]);

  const sectorGroups = new Map();
  const allEmployees = new Set();

  rows.forEach((row, rowIndex) => {
    const sectorName = firstValue(row, [
      'Nome Setor',
      'Setor',
      'GHE',
      'Nome Centro Custo'
    ]);

    if (!sectorName) return;

    const cpf = onlyDigits(
      firstValue(row, ['CPF', 'CPF Funcionário', 'CPF Funcionario'])
    );
    const matricula = firstValue(row, ['Matrícula', 'Matricula', 'Matrícula RH']);
    const employeeName = firstValue(row, [
      'Nome Funcion',
      'Nome Funcionário',
      'Nome Funcionario',
      'Nome Social'
    ]);
    const birthDate = firstValue(row, ['Dt.Nascimento', 'Dt Nascimento']);

    const employeeKey =
      cpf ||
      normalizeKey(joinParts([matricula, employeeName, birthDate], '|')) ||
      `linha-${rowIndex + 1}`;

    const sectorKey = normalizeKey(sectorName);

    if (!sectorGroups.has(sectorKey)) {
      sectorGroups.set(sectorKey, {
        name: sectorName,
        employees: new Set()
      });
    }

    sectorGroups.get(sectorKey).employees.add(employeeKey);
    allEmployees.add(employeeKey);
  });

  const sectors = [...sectorGroups.values()]
    .map(sector => ({
      name: sector.name,
      employees: sector.employees.size
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  if (!sectors.length) {
    throw new Error(
      'Nenhum setor foi identificado. Verifique a coluna “Nome Setor” do Modelo 1.'
    );
  }

  const totalColabs = sectors.reduce(
    (total, sector) => total + Number(sector.employees || 0),
    0
  );

  return {
    company: {
      razaoSocial,
      nomeFantasia: nomeUnidade || razaoSocial,
      cnpj,
      cnae,
      grauRisco,
      endereco,
      cidadeEstado,
      responsavel,
      email,
      telefone,
      totalColabs,
      status: 'ATIVA'
    },
    sectors,
    identifiedEmployees: allEmployees.size
  };
}

async function findCompanyByCnpj(cnpj) {
  const digits = onlyDigits(cnpj);
  if (!digits) return null;

  const companies = await prisma.company.findMany({
    select: {
      id: true,
      cnpj: true
    }
  });

  return companies.find(company => onlyDigits(company.cnpj) === digits) || null;
}

router.post('/import', (req, res) => {
  upload.single('file')(req, res, async uploadError => {
    if (uploadError) {
      return res.status(400).json({
        error: uploadError.message || 'Erro ao receber a planilha.'
      });
    }

    try {
      if (!req.file?.buffer) {
        return res.status(400).json({ error: 'Selecione uma planilha para importar.' });
      }

      const { rows, sheetName } = rowsFromWorkbook(req.file.buffer);
      const imported = extractImportData(rows);
      const existing = await findCompanyByCnpj(imported.company.cnpj);

      const result = await prisma.$transaction(async tx => {
        let company;
        let mode = 'created';

        if (existing) {
          mode = 'updated';

          company = await tx.company.update({
            where: { id: existing.id },
            data: imported.company
          });

          const currentSectors = await tx.sector.findMany({
            where: { companyId: company.id }
          });

          for (const sector of imported.sectors) {
            const current = currentSectors.find(
              item => normalizeKey(item.name) === normalizeKey(sector.name)
            );

            if (current) {
              await tx.sector.update({
                where: { id: current.id },
                data: {
                  name: sector.name,
                  employees: sector.employees
                }
              });
            } else {
              await tx.sector.create({
                data: {
                  companyId: company.id,
                  name: sector.name,
                  employees: sector.employees
                }
              });
            }
          }
        } else {
          company = await tx.company.create({
            data: {
              ...imported.company,
              sectors: {
                create: imported.sectors
              }
            }
          });
        }

        const completeCompany = await tx.company.findUnique({
          where: { id: company.id },
          include: {
            sectors: {
              orderBy: { name: 'asc' }
            },
            assessments: true
          }
        });

        return { company: completeCompany, mode };
      });

      res.status(result.mode === 'created' ? 201 : 200).json({
        success: true,
        mode: result.mode,
        message:
          result.mode === 'created'
            ? 'Empresa e setores cadastrados automaticamente.'
            : 'Empresa e setores atualizados automaticamente pelo CNPJ.',
        source: {
          fileName: req.file.originalname,
          sheetName
        },
        summary: {
          sectors: imported.sectors.length,
          employees: imported.company.totalColabs,
          identifiedEmployees: imported.identifiedEmployees
        },
        company: result.company
      });
    } catch (error) {
      console.error('Erro na importação da empresa:', error);
      res.status(400).json({
        error: error.message || 'Não foi possível importar a planilha.'
      });
    }
  });
});

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
