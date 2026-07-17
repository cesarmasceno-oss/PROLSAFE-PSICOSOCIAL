import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const PAGE = {
  width: 595.28,
  height: 841.89,
  margin: 46,
  contentWidth: 503.28,
  bottom: 760
};

const COLORS = {
  navy: '#082b52',
  blue: '#0b3f75',
  teal: '#0f8f8a',
  text: '#24364b',
  muted: '#64748b',
  light: '#f5f8fb',
  border: '#d9e3ed',
  critical: '#dc2626',
  elevated: '#f97316',
  moderate: '#eab308',
  routine: '#16a34a',
  white: '#ffffff'
};

function formatDate(value) {
  if (!value) return 'Não informado';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function formatCnpj(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 14) return value || 'Não informado';
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

function clean(value, fallback = 'Não informado') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function riskColor(score) {
  const value = Number(score || 0);
  if (value <= 1) return COLORS.critical;
  if (value <= 2) return COLORS.elevated;
  if (value <= 3) return COLORS.moderate;
  return COLORS.routine;
}

function riskLabel(score) {
  const value = Number(score || 0);
  if (value <= 1) return 'Risco alto / Atenção crítica';
  if (value <= 2) return 'Risco moderado / Atenção elevada';
  if (value <= 3) return 'Risco médio / Atenção moderada';
  return 'Risco baixo / Atenção rotineira';
}

function priorityForScore(score) {
  const value = Number(score || 0);
  if (value <= 1) return { label: 'Crítica', deadline: '15 dias' };
  if (value <= 2) return { label: 'Alta', deadline: '30 dias' };
  if (value <= 3) return { label: 'Média', deadline: '60 dias' };
  return { label: 'Monitoramento', deadline: '90 dias' };
}

function maturityLabel(score) {
  const value = Number(score || 0);
  if (value <= 1) return 'Ambiente psicossocial em nível crítico';
  if (value <= 2) return 'Ambiente psicossocial em atenção elevada';
  if (value <= 3) return 'Ambiente psicossocial em atenção moderada';
  return 'Ambiente psicossocial favorável, com manutenção e monitoramento';
}

function dimensionGuidance(name) {
  const data = {
    Demandas: {
      finding: 'Pressão por prazos, volume de trabalho, ritmo intenso, pausas insuficientes ou distribuição inadequada das atividades.',
      action: 'Revisar o dimensionamento da equipe, a distribuição das tarefas, os prazos, as pausas e os fluxos de trabalho.',
      evidence: 'Ata de reunião, plano de redistribuição, cronograma, registro de pausas ou revisão do fluxo.'
    },
    Controle: {
      finding: 'Baixa autonomia, participação limitada nas decisões e pouca flexibilidade sobre métodos e organização do trabalho.',
      action: 'Ampliar a participação dos trabalhadores, a autonomia operacional e os espaços de decisão sobre a execução das tarefas.',
      evidence: 'Registro de reuniões, atualização de procedimentos, pesquisa interna ou delegação formal de autonomia.'
    },
    Relacionamentos: {
      finding: 'Conflitos, falhas de comunicação, desrespeito, tensão interpessoal ou risco de práticas de assédio.',
      action: 'Fortalecer canais de escuta, regras de convivência, prevenção ao assédio, mediação de conflitos e comunicação respeitosa.',
      evidence: 'Política interna, registro de treinamento, canal de escuta, ata de mediação ou campanha educativa.'
    },
    Cargo: {
      finding: 'Falta de clareza sobre funções, metas, responsabilidades, limites de atuação e expectativas organizacionais.',
      action: 'Revisar descrições de cargo, responsabilidades, metas, fluxos de comunicação e alinhamento de expectativas.',
      evidence: 'Descrição de cargo revisada, matriz de responsabilidades, procedimento ou registro de alinhamento.'
    },
    Mudança: {
      finding: 'Comunicação insuficiente e baixa participação dos trabalhadores durante mudanças organizacionais.',
      action: 'Estruturar a comunicação das mudanças, envolver os trabalhadores e acompanhar impactos sobre a organização do trabalho.',
      evidence: 'Plano de comunicação, cronograma de mudança, ata de reunião ou registro de acompanhamento.'
    },
    'Apoio da Chefia': {
      finding: 'Insuficiência de suporte, feedback, orientação, reconhecimento ou disponibilidade por parte da liderança.',
      action: 'Capacitar lideranças, estruturar feedbacks, fortalecer escuta ativa e melhorar o acompanhamento das equipes.',
      evidence: 'Registro de capacitação, agenda de feedback, plano de desenvolvimento ou ata de acompanhamento.'
    },
    'Apoio dos Colegas': {
      finding: 'Baixa cooperação, integração, acolhimento ou suporte entre colegas e setores.',
      action: 'Promover integração, cooperação entre pares, alinhamento de equipe e práticas de apoio mútuo.',
      evidence: 'Registro de integração, reunião de equipe, ação de clima ou procedimento de cooperação.'
    }
  };
  return data[name] || {
    finding: 'Fator psicossocial que demanda análise do contexto organizacional.',
    action: 'Definir medidas preventivas ou corretivas, responsáveis, prazos, indicadores e evidências.',
    evidence: 'Registro da medida adotada e evidência de acompanhamento.'
  };
}

function interpretDimension(name, score) {
  const value = Number(score || 0);
  const level =
    value <= 1 ? 'crítico' :
    value <= 2 ? 'elevado' :
    value <= 3 ? 'moderado' :
    'favorável';

  const guidance = dimensionGuidance(name);

  if (level === 'crítico') {
    return `O resultado indica condição crítica na dimensão ${name}, compatível com ${guidance.finding.toLowerCase()} Recomenda-se intervenção prioritária, com definição imediata de responsáveis, prazo e monitoramento.`;
  }

  if (level === 'elevado') {
    return `A dimensão ${name} apresentou atenção elevada, sugerindo presença relevante de ${guidance.finding.toLowerCase()} Recomenda-se ação corretiva planejada e acompanhamento da efetividade.`;
  }

  if (level === 'moderado') {
    return `A dimensão ${name} apresentou atenção moderada. Há sinais preventivos relacionados a ${guidance.finding.toLowerCase()} Recomenda-se monitoramento e adoção de ajustes antes de eventual agravamento.`;
  }

  return `A dimensão ${name} apresentou condição favorável. Recomenda-se manter as práticas existentes, acompanhar indicadores e realizar reavaliação periódica.`;
}

function joinPortuguese(items) {
  const values = [...new Set((items || []).filter(Boolean))];
  if (!values.length) return 'Não se aplica';
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} e ${values[1]}`;
  return `${values.slice(0, -1).join(', ')} e ${values.at(-1)}`;
}

function buildLocalizedPoints(results) {
  const points = [];

  (results.bySector || []).forEach(sector => {
    (sector.dimensions || []).forEach(item => {
      const score = Number(item.score || 0);
      if (score <= 2) {
        const guidance = dimensionGuidance(item.dimension);
        points.push({
          sector: sector.name,
          dimension: item.dimension,
          score,
          classification: riskLabel(score),
          priority: priorityForScore(score).label,
          finding: guidance.finding
        });
      }
    });
  });

  return points
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);
}

function buildActionPlans(results) {
  const globalByDimension = new Map(
    (results.byDimension || []).map(item => [item.name, item])
  );
  const dimensionNames = new Set(globalByDimension.keys());

  (results.bySector || []).forEach(sector => {
    (sector.dimensions || []).forEach(item => dimensionNames.add(item.dimension));
  });

  const plans = [];

  dimensionNames.forEach(dimension => {
    const globalItem = globalByDimension.get(dimension);
    const globalScore = globalItem ? Number(globalItem.score || 0) : null;
    const sectorResults = [];

    (results.bySector || []).forEach(sector => {
      const item = (sector.dimensions || []).find(
        dimensionItem => dimensionItem.dimension === dimension
      );

      if (item && Number(item.score) <= 3) {
        sectorResults.push({
          sector: sector.name,
          score: Number(item.score)
        });
      }
    });

    const globalNeedsAction = globalScore !== null && globalScore <= 3;
    if (!globalNeedsAction && !sectorResults.length) return;

    sectorResults.sort((a, b) => a.score - b.score);
    const scores = [
      ...(globalNeedsAction ? [globalScore] : []),
      ...sectorResults.map(item => item.score)
    ];
    const worstScore = Math.min(...scores);
    const priority = priorityForScore(worstScore);
    const guidance = dimensionGuidance(dimension);
    const prioritySectors = sectorResults
      .filter(item => item.score <= 2)
      .map(item => item.sector);
    const monitoredSectors = sectorResults
      .filter(item => item.score > 2)
      .map(item => item.sector);

    plans.push({
      dimension,
      score: worstScore,
      globalScore,
      classification: riskLabel(worstScore),
      scope: globalNeedsAction ? 'Organizacional e setorial' : 'Setorial',
      sectors: sectorResults.map(item => item.sector),
      prioritySectors,
      monitoredSectors,
      finding: guidance.finding,
      action: guidance.action,
      owner: 'RH / Liderança / SST',
      deadline: priority.deadline,
      priority: priority.label,
      status: 'Pendente',
      evidence: guidance.evidence
    });
  });

  return plans.sort((a, b) => a.score - b.score);
}

export function generateReportPdf({ assessment, results, responseRate }) {
  const dir = path.resolve('reports');
  fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `relatorio-${assessment.id}.pdf`);
  const doc = new PDFDocument({
    margin: PAGE.margin,
    size: 'A4',
    bufferPages: true,
    info: {
      Title: 'Relatório de Avaliação Organizacional de Riscos Psicossociais',
      Author: 'ProlSafe Saúde e Segurança Ocupacional',
      Subject: 'Avaliação organizacional dos fatores de risco psicossociais relacionados ao trabalho'
    }
  });

  const output = fs.createWriteStream(filePath);
  doc.pipe(output);

  let pageNumber = 1;
  doc.on('pageAdded', () => {
    pageNumber += 1;
    doc.x = PAGE.margin;
    doc.y = 74;
  });

  const sectionPages = {};
  const summaryRows = [];

  const company = assessment.company || {};
  const responses = assessment.responses || [];
  const sectors = company.sectors || [];
  const responseCount = responses.length;
  const respondingSectorNames = new Set(
    responses.map(response => response.sector?.name).filter(Boolean)
  );
  const sectorsWithoutResponses = sectors
    .filter(sector => !respondingSectorNames.has(sector.name))
    .map(sector => sector.name);
  const collectionStart = assessment.startDate;
  const collectionEnd = assessment.deadline || new Date();
  const reportCode = `PS-${String(assessment.id || '').slice(-8).toUpperCase()}`;
  const minimumResponses = 3;
  const dimensionItems = (results.byDimension || []).map(item => ({
    ...item,
    score: Number(item.score || 0)
  }));
  const sectorItems = results.bySector || [];
  const localizedPoints = buildLocalizedPoints(results);
  const actionPlans = buildActionPlans(results);
  const technicalName = clean(
    process.env.REPORT_TECHNICAL_NAME,
    'ProlSafe Saúde e Segurança Ocupacional'
  );
  const technicalRole = clean(
    process.env.REPORT_TECHNICAL_ROLE,
    'Equipe Técnica de Saúde e Segurança Ocupacional'
  );
  const technicalRegistration = clean(
    process.env.REPORT_TECHNICAL_REGISTRATION,
    'Não informado'
  );

  function ensureSpace(space = 100) {
    if (doc.y + space > PAGE.bottom) {
      doc.addPage();
    }
  }

  function startSection(id, label, options = {}) {
    if (options.newPage && doc.y > 100) doc.addPage();
    sectionPages[id] = pageNumber;
    if (!options.hideTitle) {
      ensureSpace(70);
      doc
        .fillColor(COLORS.blue)
        .font('Helvetica-Bold')
        .fontSize(16)
        .text(label, PAGE.margin, doc.y, { width: PAGE.contentWidth });
      doc
        .moveTo(PAGE.margin, doc.y + 5)
        .lineTo(PAGE.margin + 76, doc.y + 5)
        .strokeColor(COLORS.teal)
        .lineWidth(2)
        .stroke();
      doc.moveDown(0.65);
    }
  }

  function paragraph(value, options = {}) {
    ensureSpace(options.space || 65);
    doc
      .fillColor(options.color || COLORS.text)
      .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(options.size || 9.6)
      .text(clean(value, ''), PAGE.margin, doc.y, {
        width: PAGE.contentWidth,
        align: options.align || 'justify',
        lineGap: options.lineGap ?? 2
      });
    doc.moveDown(options.after ?? 0.45);
  }

  function note(value) {
    ensureSpace(70);
    const y = doc.y;
    const height = doc.heightOfString(value, {
      width: PAGE.contentWidth - 34,
      font: 'Helvetica',
      fontSize: 8.8,
      lineGap: 2
    }) + 24;

    doc.roundedRect(PAGE.margin, y, PAGE.contentWidth, height, 8)
      .fill(COLORS.light)
      .strokeColor(COLORS.border)
      .stroke();

    doc
      .fillColor(COLORS.text)
      .font('Helvetica')
      .fontSize(8.8)
      .text(value, PAGE.margin + 17, y + 12, {
        width: PAGE.contentWidth - 34,
        lineGap: 2
      });

    doc.y = y + height + 10;
  }

  function infoGrid(rows) {
  const columns = 2;
  const gap = 12;
  const boxWidth = (PAGE.contentWidth - gap) / columns;
  const boxHeight = 56;

  for (let i = 0; i < rows.length; i += columns) {
    ensureSpace(boxHeight + 12);

    const rowY = doc.y;
    const rowItems = rows.slice(i, i + columns);

    rowItems.forEach(([label, value], col) => {
      const x = PAGE.margin + col * (boxWidth + gap);
      const y = rowY;

      doc
        .roundedRect(x, y, boxWidth, boxHeight, 8)
        .fill(COLORS.light)
        .strokeColor(COLORS.border)
        .stroke();

      doc
        .fillColor(COLORS.muted)
        .font("Helvetica-Bold")
        .fontSize(7.2)
        .text(String(label).toUpperCase(), x + 12, y + 10, {
          width: boxWidth - 24,
          lineBreak: false
        });

      doc
        .fillColor(COLORS.text)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(clean(value), x + 12, y + 27, {
          width: boxWidth - 24,
          height: 20,
          ellipsis: true
        });
    });

    doc.y = rowY + boxHeight + 10;
  }
}

  function drawClassificationTable() {
    const rows = [
      ['0,00 a 1,00', 'Risco alto', 'Atenção crítica', COLORS.critical, 'Intervenção prioritária e imediata.'],
      ['1,01 a 2,00', 'Risco moderado', 'Atenção elevada', COLORS.elevated, 'Ação corretiva planejada e acompanhamento.'],
      ['2,01 a 3,00', 'Risco médio', 'Atenção moderada', COLORS.moderate, 'Monitoramento e medidas preventivas.'],
      ['3,01 a 4,00', 'Risco baixo', 'Atenção rotineira', COLORS.routine, 'Manutenção das boas práticas e reavaliação.']
    ];

    ensureSpace(165);
    const widths = [88, 92, 110, 213];
    let y = doc.y;

    ['Faixa', 'Classificação', 'Nível de atenção', 'Interpretação'].forEach((label, index) => {
      const x = PAGE.margin + widths.slice(0, index).reduce((a, b) => a + b, 0);
      doc.rect(x, y, widths[index], 26).fill(COLORS.navy);
      doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(7.5)
        .text(label, x + 6, y + 9, { width: widths[index] - 12, align: 'center' });
    });

    y += 26;
    rows.forEach(row => {
      row.slice(0, 3).forEach((value, index) => {
        const x = PAGE.margin + widths.slice(0, index).reduce((a, b) => a + b, 0);
        doc.rect(x, y, widths[index], 38).fill(COLORS.light).strokeColor(COLORS.border).stroke();
        doc.fillColor(index === 2 ? row[3] : COLORS.text)
          .font(index === 2 ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(7.6)
          .text(value, x + 6, y + 12, { width: widths[index] - 12, align: 'center' });
      });

      const x = PAGE.margin + widths.slice(0, 3).reduce((a, b) => a + b, 0);
      doc.rect(x, y, widths[3], 38).fill(COLORS.light).strokeColor(COLORS.border).stroke();
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(7.4)
        .text(row[4], x + 8, y + 9, { width: widths[3] - 16, align: 'left' });
      y += 38;
    });

    doc.y = y + 8;
  }

  function drawGeneralIndex() {
    ensureSpace(150);
    const score = Number(results.generalScore || 0);
    const y = doc.y;

    doc.roundedRect(PAGE.margin, y, PAGE.contentWidth, 118, 12)
      .fill(COLORS.light)
      .strokeColor(COLORS.border)
      .stroke();

    doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(8)
      .text('ÍNDICE GERAL PSICOSSOCIAL PROLSAFE', PAGE.margin + 18, y + 16);

    doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(27)
      .text(score.toFixed(2).replace('.', ','), PAGE.margin + 18, y + 38, { width: 86 });

    doc.fillColor(riskColor(score)).font('Helvetica-Bold').fontSize(10)
      .text(riskLabel(score), PAGE.margin + 110, y + 43, { width: 340 });

    const barX = PAGE.margin + 18;
    const barY = y + 78;
    const barW = PAGE.contentWidth - 36;
    const segment = barW / 4;
    [COLORS.critical, COLORS.elevated, COLORS.moderate, COLORS.routine].forEach((colorValue, index) => {
      doc.rect(barX + index * segment, barY, segment, 14).fill(colorValue);
    });

    const marker = barX + Math.max(0, Math.min(1, score / 4)) * barW;
    doc.circle(marker, barY + 7, 5).fill(COLORS.navy);

    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.5)
      .text(maturityLabel(score), PAGE.margin + 18, y + 99, {
        width: PAGE.contentWidth - 36,
        align: 'center'
      });

    doc.y = y + 130;
  }

  function drawRanking(items, labelKey, titleText) {
    ensureSpace(80);
    paragraph(titleText, { bold: true, color: COLORS.blue, size: 11, after: 0.25 });
    const sorted = [...items].sort((a, b) => Number(a.score) - Number(b.score));

    let y = doc.y;
    const widths = [50, 200, 65, 188];
    ['Pos.', labelKey, 'Score', 'Classificação'].forEach((label, index) => {
      const x = PAGE.margin + widths.slice(0, index).reduce((a, b) => a + b, 0);
      doc.rect(x, y, widths[index], 24).fill(COLORS.navy);
      doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(7.5)
        .text(label, x + 5, y + 8, { width: widths[index] - 10, align: 'center' });
    });
    y += 24;

    sorted.forEach((item, index) => {
      if (y + 31 > PAGE.bottom) {
        doc.y = y;
        doc.addPage();
        y = doc.y;
      }

      const name = item.name || item.dimension;
      [String(index + 1), name, Number(item.score).toFixed(2).replace('.', ','), riskLabel(item.score)]
        .forEach((value, colIndex) => {
          const x = PAGE.margin + widths.slice(0, colIndex).reduce((a, b) => a + b, 0);
          doc.rect(x, y, widths[colIndex], 29)
            .fill(index % 2 === 0 ? COLORS.light : COLORS.white)
            .strokeColor(COLORS.border)
            .stroke();

          doc.fillColor(colIndex === 3 ? riskColor(item.score) : COLORS.text)
            .font(colIndex === 2 || colIndex === 3 ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(7.5)
            .text(value, x + 5, y + 9, {
              width: widths[colIndex] - 10,
              align: colIndex === 1 ? 'left' : 'center',
              ellipsis: true
            });
        });
      y += 29;
    });

    doc.y = y + 10;
  }

  function drawParticipationTable(items) {
    ensureSpace(110);
    paragraph('Participação registrada por setor', {
      bold: true,
      color: COLORS.blue,
      size: 11,
      after: 0.25
    });

    const widths = [176, 86, 126, 115];
    const headers = ['Setor', 'Respostas', 'Colaboradores informados', 'Taxa setorial'];
    let y = doc.y;

    headers.forEach((label, index) => {
      const x = PAGE.margin + widths.slice(0, index).reduce((a, b) => a + b, 0);
      doc.rect(x, y, widths[index], 27).fill(COLORS.navy);
      doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(7.2)
        .text(label, x + 5, y + 7, {
          width: widths[index] - 10,
          align: 'center'
        });
    });
    y += 27;

    const sorted = [...items].sort(
      (a, b) => Number(b.responseCount || 0) - Number(a.responseCount || 0)
    );

    sorted.forEach((item, index) => {
      if (y + 31 > PAGE.bottom) {
        doc.y = y;
        doc.addPage();
        y = doc.y;
      }

      const registeredSector = sectors.find(
        sector => clean(sector.name, '').toLowerCase() === clean(item.name, '').toLowerCase()
      );
      const employees = Number(registeredSector?.employees || 0);
      const responsesBySector = Number(item.responseCount || 0);
      const rate = employees > 0
        ? `${((responsesBySector / employees) * 100).toFixed(1).replace('.', ',')}%`
        : 'Não calculada';
      const values = [item.name, responsesBySector, employees || 'Não informado', rate];

      values.forEach((value, colIndex) => {
        const x = PAGE.margin + widths.slice(0, colIndex).reduce((a, b) => a + b, 0);
        doc.rect(x, y, widths[colIndex], 30)
          .fill(index % 2 === 0 ? COLORS.light : COLORS.white)
          .strokeColor(COLORS.border)
          .stroke();
        doc.fillColor(COLORS.text)
          .font(colIndex === 1 || colIndex === 3 ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(7.5)
          .text(String(value), x + 5, y + 10, {
            width: widths[colIndex] - 10,
            align: colIndex === 0 ? 'left' : 'center',
            ellipsis: true
          });
      });
      y += 30;
    });

    doc.y = y + 10;
  }

  function drawDimensionBars(items) {
    ensureSpace(250);
    const labelWidth = 145;
    const barWidth = 280;
    let y = doc.y + 6;

    items.forEach(item => {
      if (y + 31 > PAGE.bottom) {
        doc.y = y;
        doc.addPage();
        y = doc.y;
      }

      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8)
        .text(item.name, PAGE.margin, y + 2, { width: labelWidth - 8 });

      doc.roundedRect(PAGE.margin + labelWidth, y, barWidth, 14, 4).fill(COLORS.border);
      const width = Math.max(3, Math.min(barWidth, Number(item.score || 0) / 4 * barWidth));
      doc.roundedRect(PAGE.margin + labelWidth, y, width, 14, 4).fill(riskColor(item.score));

      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8)
        .text(Number(item.score).toFixed(2).replace('.', ','), PAGE.margin + labelWidth + barWidth + 12, y + 2, {
          width: 55
        });
      y += 29;
    });

    doc.y = y + 4;
  }

  function drawHeatmap() {
    const dimensions = dimensionItems.map(item => item.name);
    if (!sectorItems.length || !dimensions.length) {
      paragraph('Não foram identificados dados suficientes para construção do heatmap.');
      return;
    }

    ensureSpace(150);
    const firstCol = 104;
    const cellWidth = (PAGE.contentWidth - firstCol) / dimensions.length;
    const cellHeight = 30;
    let y = doc.y;

    doc.rect(PAGE.margin, y, firstCol, cellHeight).fill(COLORS.navy);
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(7)
      .text('Setor', PAGE.margin + 5, y + 11, { width: firstCol - 10 });

    dimensions.forEach((dimension, index) => {
      const x = PAGE.margin + firstCol + index * cellWidth;
      doc.rect(x, y, cellWidth, cellHeight).fill(COLORS.navy);
      doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(6.2)
        .text(dimension.slice(0, 10), x + 2, y + 8, {
          width: cellWidth - 4,
          align: 'center'
        });
    });

    y += cellHeight;

    sectorItems.forEach(sector => {
      if (y + cellHeight > PAGE.bottom) {
        doc.y = y;
        doc.addPage();
        y = doc.y;
      }

      doc.rect(PAGE.margin, y, firstCol, cellHeight)
        .fill(COLORS.light)
        .strokeColor(COLORS.border)
        .stroke();
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(7)
        .text(sector.name, PAGE.margin + 5, y + 10, {
          width: firstCol - 10,
          ellipsis: true
        });

      dimensions.forEach((dimension, index) => {
        const x = PAGE.margin + firstCol + index * cellWidth;
        const result = (sector.dimensions || []).find(item => item.dimension === dimension);
        const score = result ? Number(result.score) : null;

        doc.rect(x, y, cellWidth, cellHeight)
          .fill(score === null ? COLORS.border : riskColor(score))
          .strokeColor(COLORS.white)
          .stroke();

        doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(7)
          .text(score === null ? '—' : score.toFixed(1).replace('.', ','), x, y + 10, {
            width: cellWidth,
            align: 'center'
          });
      });

      y += cellHeight;
    });

    doc.y = y + 10;
  }

  function drawDimensionInterpretations() {
    dimensionItems.forEach(item => {
      ensureSpace(90);
      const y = doc.y;
      const height = Math.max(
        76,
        doc.heightOfString(interpretDimension(item.name, item.score), {
          width: PAGE.contentWidth - 34,
          font: 'Helvetica',
          fontSize: 8.5,
          lineGap: 2
        }) + 51
      );

      doc.roundedRect(PAGE.margin, y, PAGE.contentWidth, height, 9)
        .fill(COLORS.light)
        .strokeColor(COLORS.border)
        .stroke();

      doc.rect(PAGE.margin, y, 6, height).fill(riskColor(item.score));

      doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(10)
        .text(`${item.name} · ${Number(item.score).toFixed(2).replace('.', ',')}`, PAGE.margin + 18, y + 13, {
          width: 240
        });

      doc.fillColor(riskColor(item.score)).font('Helvetica-Bold').fontSize(8)
        .text(riskLabel(item.score), PAGE.margin + 270, y + 15, {
          width: PAGE.contentWidth - 288,
          align: 'right'
        });

      doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.5)
        .text(interpretDimension(item.name, item.score), PAGE.margin + 18, y + 35, {
          width: PAGE.contentWidth - 36,
          lineGap: 2
        });

      doc.y = y + height + 10;
    });
  }

  function drawCriticalPoints() {
    if (!localizedPoints.length) {
      note('Não foram identificados pontos setoriais classificados como atenção crítica ou elevada. Os resultados moderados permanecem apresentados no heatmap e devem ser acompanhados preventivamente.');
      return;
    }

    localizedPoints.forEach((point, index) => {
      ensureSpace(70);
      const y = doc.y;

      doc.roundedRect(PAGE.margin, y, PAGE.contentWidth, 60, 8)
        .fill(COLORS.light)
        .strokeColor(COLORS.border)
        .stroke();

      doc.circle(PAGE.margin + 19, y + 18, 8).fill(riskColor(point.score));
      doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(7)
        .text(String(index + 1), PAGE.margin + 15, y + 15, { width: 8, align: 'center' });

      doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(9)
        .text(`${point.sector} · ${point.dimension}`, PAGE.margin + 36, y + 11, {
          width: 310
        });

      doc.fillColor(riskColor(point.score)).font('Helvetica-Bold').fontSize(8)
        .text(`${point.score.toFixed(2).replace('.', ',')} · ${point.priority}`, PAGE.margin + 360, y + 12, {
          width: 125,
          align: 'right'
        });

      doc.fillColor(COLORS.text).font('Helvetica').fontSize(8)
        .text(point.finding, PAGE.margin + 36, y + 31, {
          width: PAGE.contentWidth - 54,
          lineGap: 1,
          height: 23,
          ellipsis: true
        });

      doc.y = y + 69;
    });

    note('Foram destacados somente os pontos setoriais classificados como atenção crítica ou elevada. Os resultados moderados permanecem disponíveis no heatmap e no plano de ação consolidado.');
  }

  function drawActionPlan() {
    if (!actionPlans.length) {
      note('Não foram identificadas dimensões gerais ou cruzamentos setor × dimensão com necessidade de ação corretiva ou preventiva. Recomenda-se manter as boas práticas, documentar ações de manutenção e realizar nova avaliação no período definido pela gestão de SST.');
      return;
    }

    paragraph('Resumo das prioridades consolidadas', {
      bold: true,
      color: COLORS.blue,
      size: 11,
      after: 0.25
    });

    const widths = [165, 74, 91, 173];
    let summaryY = doc.y;
    ['Dimensão', 'Pior score', 'Prioridade', 'Abrangência'].forEach((label, index) => {
      const x = PAGE.margin + widths.slice(0, index).reduce((a, b) => a + b, 0);
      doc.rect(x, summaryY, widths[index], 26).fill(COLORS.navy);
      doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(7.3)
        .text(label, x + 5, summaryY + 8, {
          width: widths[index] - 10,
          align: 'center'
        });
    });
    summaryY += 26;

    actionPlans.forEach((plan, index) => {
      if (summaryY + 31 > PAGE.bottom) {
        doc.y = summaryY;
        doc.addPage();
        summaryY = doc.y;
      }

      const sectorCountLabel = plan.sectors.length
        ? `${plan.sectors.length} setor${plan.sectors.length === 1 ? '' : 'es'}`
        : 'sem setor específico';
      const coverage = plan.globalScore !== null && Number(plan.globalScore) <= 3
        ? `Organizacional + ${sectorCountLabel}`
        : sectorCountLabel;
      const values = [
        plan.dimension,
        plan.score.toFixed(2).replace('.', ','),
        plan.priority,
        coverage
      ];

      values.forEach((value, colIndex) => {
        const x = PAGE.margin + widths.slice(0, colIndex).reduce((a, b) => a + b, 0);
        doc.rect(x, summaryY, widths[colIndex], 29)
          .fill(index % 2 === 0 ? COLORS.light : COLORS.white)
          .strokeColor(COLORS.border)
          .stroke();
        doc.fillColor(colIndex === 2 ? riskColor(plan.score) : COLORS.text)
          .font(colIndex === 1 || colIndex === 2 ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(7.4)
          .text(String(value), x + 5, summaryY + 9, {
            width: widths[colIndex] - 10,
            align: colIndex === 0 ? 'left' : 'center',
            ellipsis: true
          });
      });
      summaryY += 29;
    });
    doc.y = summaryY + 12;

    actionPlans.forEach((plan, index) => {
      ensureSpace(192);
      const y = doc.y;
      const height = 180;
      const prioritized = plan.prioritySectors.length
        ? joinPortuguese(plan.prioritySectors)
        : 'Nenhum setor em atenção crítica ou elevada';
      const monitored = plan.monitoredSectors.length
        ? joinPortuguese(plan.monitoredSectors)
        : 'Não se aplica';

      doc.roundedRect(PAGE.margin, y, PAGE.contentWidth, height, 10)
        .fill(COLORS.light)
        .strokeColor(COLORS.border)
        .stroke();
      doc.rect(PAGE.margin, y, 7, height).fill(riskColor(plan.score));

      doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(10)
        .text(`${index + 1}. ${plan.dimension}`, PAGE.margin + 18, y + 13, {
          width: 250,
          ellipsis: true
        });
      doc.fillColor(riskColor(plan.score)).font('Helvetica-Bold').fontSize(8)
        .text(`${plan.score.toFixed(2).replace('.', ',')} · ${plan.priority}`, PAGE.margin + 285, y + 15, {
          width: 200,
          align: 'right'
        });

      doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(6.8)
        .text('ABRANGÊNCIA', PAGE.margin + 18, y + 36);
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(7.8)
        .text(`${plan.scope}. Setores prioritários: ${prioritized}. Setores em monitoramento: ${monitored}.`, PAGE.margin + 18, y + 48, {
          width: PAGE.contentWidth - 36,
          height: 27,
          lineGap: 1,
          ellipsis: true
        });

      doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(6.8)
        .text('ACHADO', PAGE.margin + 18, y + 77);
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(7.8)
        .text(plan.finding, PAGE.margin + 18, y + 89, {
          width: PAGE.contentWidth - 36,
          height: 25,
          lineGap: 1,
          ellipsis: true
        });

      doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(6.8)
        .text('AÇÃO CONSOLIDADA', PAGE.margin + 18, y + 118);
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(7.8)
        .text(plan.action, PAGE.margin + 18, y + 130, {
          width: PAGE.contentWidth - 36,
          height: 25,
          lineGap: 1,
          ellipsis: true
        });

      const metaY = y + 154;
      const meta = [
        ['Responsável', plan.owner],
        ['Prazo', plan.deadline],
        ['Status', plan.status]
      ];
      meta.forEach(([label, value], metaIndex) => {
        const width = (PAGE.contentWidth - 30) / 3;
        const x = PAGE.margin + 15 + metaIndex * width;
        doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(6.3)
          .text(label.toUpperCase(), x, metaY, { width: width - 8, align: 'center' });
        doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(7.1)
          .text(value, x, metaY + 10, { width: width - 8, align: 'center' });
      });

      doc.y = y + height + 10;
    });

    note('Evidências esperadas: atas, registros de treinamento, procedimentos revisados, planos de comunicação, cronogramas, indicadores, fotografias, listas de presença ou outros documentos que comprovem a execução e o acompanhamento das medidas.');
  }

  // Página-base de capa. Será substituída pela capa corporativa no pós-processamento.
  doc.rect(0, 0, PAGE.width, PAGE.height).fill(COLORS.navy);
  doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(24)
    .text('Relatório de Avaliação Organizacional', PAGE.margin, 315, {
      width: PAGE.contentWidth,
      align: 'center'
    });
  doc.font('Helvetica').fontSize(12)
    .text('Fatores de Risco Psicossociais Relacionados ao Trabalho', PAGE.margin, 355, {
      width: PAGE.contentWidth,
      align: 'center'
    });

  // Sumário.
  doc.addPage();
  startSection('sumario', 'Sumário');
  const summaryItems = [
    ['identificacao', '1. Identificação e controle do documento'],
    ['resumo', '2. Resumo executivo'],
    ['empresa', '3. Caracterização da empresa e da avaliação'],
    ['metodologia', '4. Objetivo, metodologia e critérios'],
    ['participacao', '5. Perfil de participação'],
    ['resultados', '6. Resultados gerais e por dimensão'],
    ['setores', '7. Resultados e pontos de atenção por setor'],
    ['plano', '8. Plano de ação consolidado'],
    ['conclusao', '9. Conclusão técnica'],
    ['responsabilidade', '10. Responsabilidade técnica e validação'],
    ['referencias', '11. Referências e limitações']
  ];

  summaryItems.forEach(([id, label]) => {
    const y = doc.y + 4;
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(9.5)
      .text(label, PAGE.margin + 14, y, { width: 410 });
    doc.moveTo(PAGE.margin + 270, y + 9)
      .lineTo(PAGE.margin + 445, y + 9)
      .strokeColor(COLORS.border)
      .dash(1, { space: 2 })
      .stroke()
      .undash();
    summaryRows.push({ id, y });
    doc.y = y + 29;
  });

  note('Documento confidencial de uso organizacional. Os resultados são coletivos e não devem ser utilizados para diagnóstico clínico ou avaliação individual de trabalhadores.');

  // 1. Identificação.
  doc.addPage();
  startSection('identificacao', '1. Identificação e controle do documento');
  infoGrid([
    ['Código do relatório', reportCode],
    ['Versão', '1.1'],
    ['Empresa avaliada', company.nomeFantasia || company.razaoSocial],
    ['Razão social', company.razaoSocial],
    ['CNPJ', formatCnpj(company.cnpj)],
    ['Data de emissão', formatDate(new Date())],
    ['Período de coleta', `${formatDate(collectionStart)} a ${formatDate(collectionEnd)}`],
    ['Instrumento', 'HSE-IT – avaliação organizacional'],
    ['Responsável técnico', technicalName],
    ['Finalidade', 'Gestão preventiva dos riscos psicossociais']
  ]);

  startSection('resumo', '2. Resumo executivo');
  paragraph(
    `Este relatório apresenta os resultados da Avaliação Psicossocial Organizacional realizada na empresa ${clean(company.razaoSocial)}. A análise foi conduzida em nível geral, por dimensão e por setor, com o objetivo de identificar fatores protetivos, pontos de atenção e prioridades para prevenção e melhoria contínua das condições de trabalho.`
  );
  paragraph(
    `Foram registradas ${responseCount} respostas válidas, correspondendo a uma taxa de participação de ${Number(responseRate || 0).toFixed(1).replace('.', ',')}%. O score geral foi ${Number(results.generalScore || 0).toFixed(2).replace('.', ',')}, classificado como ${results.generalClassification?.label || riskLabel(results.generalScore)}.`
  );
  drawGeneralIndex();

  const worstDimensions = [...dimensionItems]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(item => item.name)
    .join(', ');

  paragraph(
    `As dimensões com menores escores relativos foram ${worstDimensions || 'não identificadas'}. Mesmo quando o resultado geral é favorável, a leitura setorial deve ser considerada, pois médias organizacionais podem ocultar pontos de atenção localizados.`
  );

  startSection('empresa', '3. Caracterização da empresa e da avaliação', { newPage: true });
  infoGrid([
    ['Razão social', company.razaoSocial],
    ['Nome fantasia', company.nomeFantasia],
    ['CNPJ', formatCnpj(company.cnpj)],
    ['CNAE', company.cnae],
    ['Grau de risco', company.grauRisco],
    ['Cidade/Estado', company.cidadeEstado],
    ['Endereço', company.endereco],
    ['Responsável da empresa', company.responsavel],
    ['Total de colaboradores', company.totalColabs || 0],
    ['Setores cadastrados', sectors.length],
    ['Respostas válidas', responseCount],
    ['Taxa de participação', `${Number(responseRate || 0).toFixed(1).replace('.', ',')}%`]
  ]);
  paragraph(
    `A avaliação foi disponibilizada no período de ${formatDate(collectionStart)} a ${formatDate(collectionEnd)}. A participação foi considerada de forma coletiva, preservando-se o anonimato e a confidencialidade dos respondentes.`
  );

  startSection('metodologia', '4. Objetivo, metodologia e critérios', { newPage: true });
  paragraph(
    'O objetivo da avaliação é identificar, de forma organizacional e coletiva, fatores psicossociais relacionados ao trabalho que possam demandar prevenção, controle, monitoramento ou melhoria das condições de trabalho. A avaliação não possui finalidade clínica, diagnóstica ou individual.'
  );
  paragraph(
    'Foi utilizado questionário estruturado inspirado no HSE Management Standards Indicator Tool, contemplando as dimensões Demandas, Controle, Relacionamentos, Cargo, Mudança, Apoio da Chefia e Apoio dos Colegas. As respostas foram registradas em escala de frequência de cinco pontos: Nunca, Raramente, Às vezes, Frequentemente e Sempre.'
  );
  paragraph(
    'As respostas foram normalizadas em escala de 0 a 4. Nas perguntas em que maior frequência representa maior exposição, foi aplicada inversão da pontuação. Os resultados correspondem à média das respostas válidas, com classificação automática por faixas de score.'
  );
  drawClassificationTable();
  note(
    `Para preservar a confidencialidade, recomenda-se interpretar resultados setoriais com cautela quando houver menos de ${minimumResponses} respondentes no setor. O resultado deve ser utilizado em conjunto com observações do trabalho, entrevistas, indicadores de saúde e demais informações do gerenciamento de riscos ocupacionais.`
  );

  startSection('participacao', '5. Perfil de participação', { newPage: true });
  infoGrid([
    ['Colaboradores informados', company.totalColabs || 0],
    ['Respostas válidas', responseCount],
    ['Taxa de participação', `${Number(responseRate || 0).toFixed(1).replace('.', ',')}%`],
    ['Setores com respostas', respondingSectorNames.size],
    ['Setores cadastrados', sectors.length],
    ['Setores sem respostas', sectorsWithoutResponses.length]
  ]);

  if (sectorItems.length) {
    drawParticipationTable(sectorItems);
    paragraph(
      'A taxa setorial é calculada com base no número de respostas e no quantitativo de colaboradores informado para cada setor. Divergências cadastrais podem produzir percentuais acima de 100% e devem ser conferidas pela empresa.'
    );
  }

  if (sectorsWithoutResponses.length) {
    note(`Setores sem respostas registradas: ${sectorsWithoutResponses.join(', ')}.`);
  } else {
    note('Todos os setores cadastrados apresentaram ao menos uma resposta registrada.');
  }

  startSection('resultados', '6. Resultados gerais e por dimensão', { newPage: true });
  drawGeneralIndex();
  drawRanking(dimensionItems, 'Dimensão', 'Ranking executivo das dimensões');
  ensureSpace(285);
  paragraph('Gráfico comparativo dos escores por dimensão:', { bold: true, color: COLORS.blue, size: 11 });
  drawDimensionBars(dimensionItems);
  paragraph('Interpretação técnica por dimensão:', { bold: true, color: COLORS.blue, size: 11 });
  drawDimensionInterpretations();

  startSection('setores', '7. Resultados e pontos de atenção por setor', { newPage: true });
  if (sectorItems.length) {
    drawRanking(sectorItems, 'Setor', 'Ranking executivo dos setores');
    paragraph(
      'O ranking setorial permite comparar a percepção média entre os setores. Resultados menos favoráveis não representam diagnóstico do setor, mas indicam necessidade de investigação e acompanhamento do contexto de trabalho.'
    );
    paragraph('Heatmap setor × dimensão:', { bold: true, color: COLORS.blue, size: 11 });
    drawHeatmap();
    paragraph('Pontos de atenção localizados:', { bold: true, color: COLORS.blue, size: 11 });
    drawCriticalPoints();
  } else {
    note('Não foram identificados dados suficientes para análise setorial.');
  }

  startSection('plano', '8. Plano de ação consolidado', { newPage: true });
  paragraph(
    'O plano de ação foi consolidado por dimensão para evitar duplicidades entre resultados organizacionais e setoriais. A empresa deve validar cada medida, designar responsáveis, definir datas reais, registrar evidências e acompanhar sua efetividade.'
  );
  drawActionPlan();

  startSection('conclusao', '9. Conclusão técnica', { newPage: true });
  paragraph(
    `Com base nas respostas coletadas, a organização apresentou score geral de ${Number(results.generalScore || 0).toFixed(2).replace('.', ',')}, classificado como ${results.generalClassification?.label || riskLabel(results.generalScore)}.`
  );

  if (actionPlans.length) {
    const mostCritical = actionPlans
      .slice(0, 5)
      .map(plan => {
        const sectorsLabel = plan.prioritySectors.length
          ? ` (${joinPortuguese(plan.prioritySectors)})`
          : '';
        return `${plan.dimension}${sectorsLabel}`;
      })
      .join('; ');

    paragraph(
      `Foram identificados pontos que justificam medidas preventivas ou corretivas, com destaque para: ${mostCritical}. Esses achados devem ser analisados considerando a organização real do trabalho, o número de participantes e outras evidências disponíveis.`
    );
  } else {
    paragraph(
      'Não foram identificados resultados com necessidade de intervenção corretiva imediata. Recomenda-se manter as práticas favoráveis, formalizar ações de manutenção e acompanhar periodicamente os indicadores psicossociais.'
    );
  }

  paragraph(
    'Recomenda-se integrar as medidas ao gerenciamento de riscos ocupacionais, acompanhar responsáveis, prazos e evidências, comunicar os resultados de maneira coletiva e programar nova avaliação após a implementação das medidas ou na periodicidade definida pela gestão de SST.'
  );
  note(
    'A interpretação deste relatório deve preservar o anonimato, evitar exposição individual e considerar que os resultados representam a percepção dos participantes no período da coleta.'
  );

  startSection('responsabilidade', '10. Responsabilidade técnica e validação');
  infoGrid([
    ['Responsável pela emissão', technicalName],
    ['Função', technicalRole],
    ['Registro profissional', technicalRegistration],
    ['Data de emissão', formatDate(new Date())]
  ]);
  paragraph(
    'Este documento foi gerado a partir dos dados consolidados da avaliação organizacional. A validação final das medidas propostas deve considerar a realidade do trabalho, as evidências disponíveis e a análise do profissional responsável pelo gerenciamento de riscos ocupacionais.'
  );
  ensureSpace(95);
  const signatureY = doc.y + 12;
  doc.moveTo(PAGE.margin + 20, signatureY + 45)
    .lineTo(PAGE.margin + 230, signatureY + 45)
    .strokeColor(COLORS.border)
    .stroke();
  doc.moveTo(PAGE.margin + 273, signatureY + 45)
    .lineTo(PAGE.margin + 483, signatureY + 45)
    .strokeColor(COLORS.border)
    .stroke();
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5)
    .text('Responsável técnico', PAGE.margin + 20, signatureY + 52, {
      width: 210,
      align: 'center'
    });
  doc.text('Representante da empresa', PAGE.margin + 273, signatureY + 52, {
    width: 210,
    align: 'center'
  });
  doc.y = signatureY + 78;

  startSection('referencias', '11. Referências e limitações');
  paragraph(
    'Referências técnicas: HSE Management Standards Indicator Tool; princípios de gerenciamento de riscos ocupacionais; práticas de prevenção dos fatores de risco psicossociais relacionados ao trabalho; Lei Geral de Proteção de Dados Pessoais – LGPD.'
  );
  paragraph(
    'Limitações: os resultados dependem da participação, da compreensão das perguntas e do contexto existente durante a coleta. Médias organizacionais podem não representar igualmente todos os grupos. O relatório não substitui avaliação clínica, análise ergonômica, investigação de assédio, diagnóstico médico ou outras avaliações específicas.'
  );
  paragraph(
    'Documento elaborado pelo sistema ProlSafe Psicossocial para subsidiar decisões organizacionais e ações preventivas em saúde e segurança ocupacional.',
    { bold: true, align: 'center', color: COLORS.blue }
  );

  // Preenche a paginação do sumário.
  doc.switchToPage(1);
  summaryRows.forEach(row => {
    const page = sectionPages[row.id] || '—';
    doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(9.5)
      .text(String(page), PAGE.margin + 456, row.y, {
        width: 32,
        align: 'right'
      });
  });

  doc.end();
  return filePath;
}
