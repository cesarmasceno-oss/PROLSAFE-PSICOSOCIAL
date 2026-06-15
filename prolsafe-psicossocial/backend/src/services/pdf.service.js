import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { recommendationFor } from './recommendations.service.js';

export function generateReportPdf({ assessment, results, responseRate }) {
  const dir = path.resolve('reports');
  fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `relatorio-${assessment.id}.pdf`);
  const doc = new PDFDocument({ margin: 46, size: 'A4' });

  doc.pipe(fs.createWriteStream(filePath));

  const blue = '#0b3f75';
  const teal = '#0f766e';
  const text = '#334155';
  const light = '#f1f5f9';

  function resetX() {
    doc.x = 46;
  }

  function checkPage(space = 140) {
    if (doc.y + space > 760) {
      doc.addPage();
      resetX();
    }
  }

  function title(value) {
    checkPage(60);
    resetX();
    doc.moveDown(0.5);
    doc
      .fillColor(blue)
      .fontSize(15)
      .font('Helvetica-Bold')
      .text(value, 46, doc.y, { width: 500 });
    doc.moveDown(0.3);
  }

  function p(value) {
    resetX();
    doc
      .fillColor(text)
      .fontSize(10)
      .font('Helvetica')
      .text(value, 46, doc.y, {
        width: 500,
        lineGap: 2,
        align: 'justify'
      });
  }

  function riskColor(score) {
    if (score <= 1) return '#dc2626';
    if (score <= 2) return '#f97316';
    if (score <= 3) return '#eab308';
    return '#16a34a';
  }

  function riskLabel(score) {
    if (score <= 1) return 'Atenção crítica';
    if (score <= 2) return 'Atenção elevada';
    if (score <= 3) return 'Atenção moderada';
    return 'Atenção rotineira';
  }

  function drawLegend() {
    title('Legenda de classificação');

    const items = [
      ['0 a 1,0', 'Risco alto / Atenção crítica', '#dc2626'],
      ['1,1 a 2,0', 'Risco moderado / Atenção elevada', '#f97316'],
      ['2,1 a 3,0', 'Risco médio / Atenção moderada', '#eab308'],
      ['3,1 a 4,0', 'Risco baixo / Atenção rotineira', '#16a34a']
    ];

    let y = doc.y + 2;

    items.forEach(i => {
      doc.roundedRect(70, y, 16, 16, 4).fill(i[2]);

      doc
        .fillColor(text)
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text(i[0], 96, y + 3, { width: 60 });

      doc
        .font('Helvetica')
        .fontSize(8.5)
        .text(i[1], 165, y + 3, { width: 330 });

      y += 23;
    });

    doc.y = y + 4;
    resetX();
  }

  function drawDimensionBarChart(items) {
    title('Gráfico por dimensão psicossocial');

    const x = 70;
    let y = doc.y + 8;
    const labelW = 130;
    const barW = 280;
    const barH = 15;

    doc
      .fontSize(8.5)
      .fillColor('#64748b')
      .text('Score de 0 a 4', x + labelW, y - 10, { width: 300 });

    items.forEach(item => {
      const score = Number(item.score || 0);
      const color = riskColor(score);
      const width = Math.max(4, (score / 4) * barW);

      doc
        .fillColor(text)
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text(item.name, x, y, { width: labelW });

      doc.roundedRect(x + labelW, y, barW, barH, 4).fill('#e2e8f0');
      doc.roundedRect(x + labelW, y, width, barH, 4).fill(color);

      doc
        .fillColor(text)
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text(score.toFixed(2), x + labelW + barW + 12, y + 2, {
          width: 50
        });

      y += 30;
    });

    doc.y = y + 6;
    resetX();
  }

  function drawRadarChart(items) {
    title('Radar psicossocial');

    const centerX = 297;
    const centerY = doc.y + 112;
    const maxRadius = 76;
    const count = items.length || 1;

    doc.save();

    for (let level = 1; level <= 4; level++) {
      const r = (level / 4) * maxRadius;
      const points = [];

      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
        points.push({
          x: centerX + Math.cos(angle) * r,
          y: centerY + Math.sin(angle) * r
        });
      }

      doc.moveTo(points[0].x, points[0].y);
      points.forEach(pt => doc.lineTo(pt.x, pt.y));
      doc.closePath().strokeColor('#cbd5e1').lineWidth(0.7).stroke();
    }

    items.forEach((item, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
      const x2 = centerX + Math.cos(angle) * maxRadius;
      const y2 = centerY + Math.sin(angle) * maxRadius;

      doc
        .moveTo(centerX, centerY)
        .lineTo(x2, y2)
        .strokeColor('#e2e8f0')
        .stroke();

      const labelX = centerX + Math.cos(angle) * (maxRadius + 30);
      const labelY = centerY + Math.sin(angle) * (maxRadius + 30);

      doc
        .fillColor(text)
        .fontSize(7)
        .font('Helvetica-Bold')
        .text(item.name, labelX - 36, labelY - 5, {
          width: 72,
          align: 'center'
        });
    });

    const scorePoints = items.map((item, i) => {
      const score = Number(item.score || 0);
      const r = (score / 4) * maxRadius;
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;

      return {
        x: centerX + Math.cos(angle) * r,
        y: centerY + Math.sin(angle) * r
      };
    });

    if (scorePoints.length) {
      doc.moveTo(scorePoints[0].x, scorePoints[0].y);
      scorePoints.forEach(pt => doc.lineTo(pt.x, pt.y));
      doc.closePath().fillOpacity(0.18).fill(teal);
      doc.fillOpacity(1).strokeColor(teal).lineWidth(1.8).stroke();

      scorePoints.forEach(pt => {
        doc.circle(pt.x, pt.y, 2.6).fill(teal);
      });
    }

    doc.restore();
    doc.y = centerY + maxRadius + 28;
    resetX();
  }

  function drawRiskMatrix(items) {
    title('Matriz de risco psicossocial');

    const x = 58;
    const y = doc.y + 8;
    const cellW = 118;
    const cellH = 42;

    const groups = [
      {
        label: 'Atenção crítica',
        color: '#dc2626',
        items: items.filter(i => Number(i.score) <= 1)
      },
      {
        label: 'Atenção elevada',
        color: '#f97316',
        items: items.filter(i => Number(i.score) > 1 && Number(i.score) <= 2)
      },
      {
        label: 'Atenção moderada',
        color: '#eab308',
        items: items.filter(i => Number(i.score) > 2 && Number(i.score) <= 3)
      },
      {
        label: 'Atenção rotineira',
        color: '#16a34a',
        items: items.filter(i => Number(i.score) > 3)
      }
    ];

    let maxBoxY = y;

    groups.forEach((group, index) => {
      const colX = x + index * cellW;

      doc.roundedRect(colX, y, cellW - 10, 30, 8).fill(group.color);

      doc
        .fillColor('white')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(group.label, colX + 8, y + 9, {
          width: cellW - 26,
          align: 'center'
        });

      let boxY = y + 40;

      if (!group.items.length) {
        doc.roundedRect(colX, boxY, cellW - 10, cellH, 8).fill(light);
        doc
          .fillColor('#64748b')
          .fontSize(7.5)
          .text('Sem dimensões', colX + 8, boxY + 15, {
            width: cellW - 26,
            align: 'center'
          });

        maxBoxY = Math.max(maxBoxY, boxY + cellH);
      }

      group.items.forEach(item => {
        doc
          .roundedRect(colX, boxY, cellW - 10, cellH, 8)
          .fill('#f8fafc')
          .strokeColor('#e2e8f0')
          .stroke();

        doc
          .fillColor(text)
          .font('Helvetica-Bold')
          .fontSize(7.8)
          .text(item.name, colX + 8, boxY + 8, {
            width: cellW - 26,
            align: 'center'
          });

        doc
          .fillColor('#64748b')
          .font('Helvetica')
          .fontSize(7.5)
          .text(`Score ${Number(item.score).toFixed(2)}`, colX + 8, boxY + 25, {
            width: cellW - 26,
            align: 'center'
          });

        boxY += cellH + 6;
        maxBoxY = Math.max(maxBoxY, boxY);
      });
    });

    doc.y = maxBoxY + 10;
    resetX();

    p(
      'A matriz apresenta a priorização das dimensões conforme o nível de atenção identificado. Dimensões em vermelho e laranja devem ser priorizadas no plano de ação.'
    );
  }

  function actionPlanFor(dimension, score) {
    const level =
      score <= 1 ? 'CRITICO' :
      score <= 2 ? 'ELEVADO' :
      score <= 3 ? 'MODERADO' :
      'BAIXO';

    const base = {
      Demandas: {
        risk: 'Sobrecarga de trabalho, pressão por prazos e excesso de demandas.',
        action:
          'Revisar distribuição de tarefas, prazos, pausas, dimensionamento da equipe e fluxo de trabalho.'
      },
      Controle: {
        risk: 'Baixa autonomia e pouca participação nas decisões sobre o trabalho.',
        action:
          'Ampliar autonomia, participação nas decisões, flexibilidade operacional e liberdade de método.'
      },
      Relacionamentos: {
        risk:
          'Conflitos interpessoais, falhas de convivência, desrespeito ou risco de assédio.',
        action:
          'Implantar canais de escuta, orientar lideranças, reforçar política de respeito e combater assédio.'
      },
      Cargo: {
        risk:
          'Falta de clareza sobre funções, responsabilidades, metas e expectativas.',
        action:
          'Revisar descrições de cargo, alinhar responsabilidades, metas e comunicação das atribuições.'
      },
      Mudança: {
        risk:
          'Falhas de comunicação e baixa participação dos trabalhadores em processos de mudança.',
        action:
          'Melhorar comunicação sobre mudanças, envolver trabalhadores e acompanhar impactos organizacionais.'
      },
      'Apoio da Chefia': {
        risk:
          'Insuficiência de suporte, feedback, orientação ou escuta por parte da liderança.',
        action:
          'Capacitar lideranças, fortalecer feedback, escuta ativa, suporte técnico e acompanhamento da equipe.'
      },
      'Apoio dos Colegas': {
        risk: 'Baixa cooperação, integração ou suporte entre pares.',
        action:
          'Promover integração da equipe, cooperação entre setores, apoio entre colegas e fortalecimento do clima.'
      }
    };

    const item = base[dimension] || {
      risk: 'Fator psicossocial com necessidade de acompanhamento.',
      action:
        'Definir medidas preventivas, responsáveis, prazos e monitoramento periódico.'
    };

    const prazo =
      level === 'CRITICO' ? '15 dias' :
      level === 'ELEVADO' ? '30 dias' :
      level === 'MODERADO' ? '60 dias' :
      '90 dias';

    const priority =
      level === 'CRITICO' ? 'Alta / imediata' :
      level === 'ELEVADO' ? 'Alta' :
      level === 'MODERADO' ? 'Média' :
      'Baixa / monitoramento';

    return {
      dimension,
      score: Number(score).toFixed(2),
      risk: item.risk,
      action: item.action,
      owner: 'RH / Gestão / SST',
      deadline: prazo,
      priority,
      status: 'Pendente'
    };
  }

  function drawActionPlan(items) {
    checkPage(250);
    title('Plano de ação automático');

    p(
      'O plano de ação abaixo foi gerado automaticamente a partir dos resultados da avaliação psicossocial, priorizando dimensões com maior nível de atenção. As ações devem ser analisadas pela empresa, adaptadas à realidade organizacional e acompanhadas com evidências de execução.'
    );

    const plans = items
      .filter(i => Number(i.score) <= 3)
      .sort((a, b) => Number(a.score) - Number(b.score))
      .map(i => actionPlanFor(i.name, i.score));

    if (!plans.length) {
      p(
        'Não foram identificadas dimensões com necessidade de ação corretiva imediata. Recomenda-se manter as boas práticas existentes e realizar monitoramento periódico.'
      );
      return;
    }

    plans.forEach((plan, index) => {
      checkPage(132);

      const boxY = doc.y + 6;

      doc
        .roundedRect(46, boxY, 500, 112, 12)
        .fill('#f8fafc')
        .strokeColor('#e2e8f0')
        .stroke();

      doc
        .fillColor(blue)
        .font('Helvetica-Bold')
        .fontSize(10.5)
        .text(`${index + 1}. ${plan.dimension} — Score ${plan.score}`, 62, boxY + 12, {
          width: 470
        });

      doc
        .fillColor(text)
        .font('Helvetica')
        .fontSize(8.8)
        .text(`Risco identificado: ${plan.risk}`, 62, boxY + 32, {
          width: 460,
          lineGap: 1
        });

      doc.text(`Ação recomendada: ${plan.action}`, 62, boxY + 54, {
        width: 460,
        lineGap: 1
      });

      doc
        .font('Helvetica-Bold')
        .fontSize(8.8)
        .text('Responsável: ', 62, boxY + 81, { continued: true })
        .font('Helvetica')
        .text(plan.owner, { continued: false });

      doc
        .font('Helvetica-Bold')
        .text('Prazo: ', 62, boxY + 96, { continued: true })
        .font('Helvetica')
        .text(plan.deadline, { continued: true })
        .font('Helvetica-Bold')
        .text('   Prioridade: ', { continued: true })
        .font('Helvetica')
        .text(plan.priority);

      doc.y = boxY + 122;
      resetX();
    });
  }
function maturityLabel(score) {
  if (score <= 1) return 'Ambiente psicossocial em nível crítico';
  if (score <= 2) return 'Ambiente psicossocial em atenção elevada';
  if (score <= 3) return 'Ambiente psicossocial em atenção moderada';
  return 'Ambiente psicossocial saudável / monitoramento rotineiro';
}

function interpretDimension(name, score) {
  const level =
    score <= 1 ? 'crítico' :
    score <= 2 ? 'elevado' :
    score <= 3 ? 'moderado' :
    'baixo';

  const texts = {
    Demandas: {
      crítico: 'Os resultados indicam exposição intensa a sobrecarga, pressão por prazos, ritmo elevado ou dificuldade de recuperação durante a jornada. Recomenda-se intervenção prioritária.',
      elevado: 'Os resultados apontam percepção relevante de pressão, volume de trabalho ou exigências organizacionais acima do ideal. Recomenda-se ação corretiva planejada.',
      moderado: 'Há sinais de atenção quanto à organização das demandas, prazos e pausas. Recomenda-se monitoramento e ajustes preventivos.',
      baixo: 'A dimensão apresenta condição favorável, indicando percepção adequada de equilíbrio entre demandas, ritmo de trabalho e capacidade de resposta.'
    },
    Controle: {
      crítico: 'Os resultados indicam baixa autonomia e pouca influência dos trabalhadores sobre a forma de realizar suas atividades. Recomenda-se intervenção gerencial.',
      elevado: 'Há percepção relevante de limitação de autonomia, participação ou flexibilidade no trabalho. Recomenda-se revisão das práticas de gestão.',
      moderado: 'A autonomia apresenta condição intermediária, exigindo acompanhamento e melhoria gradual da participação dos trabalhadores.',
      baixo: 'A dimensão apresenta condição favorável, indicando boa percepção de autonomia, liberdade de método e participação nas decisões.'
    },
    Relacionamentos: {
      crítico: 'Os resultados indicam ambiente relacional com risco significativo de conflitos, tensão interpessoal, desrespeito ou práticas inadequadas. Recomenda-se ação imediata.',
      elevado: 'Há sinais relevantes de conflitos, dificuldades de convivência ou fragilidade nas relações interpessoais. Recomenda-se atuação preventiva e corretiva.',
      moderado: 'A dimensão exige atenção preventiva, com fortalecimento da comunicação, respeito e canais de escuta.',
      baixo: 'A dimensão apresenta condição favorável, indicando relações interpessoais adequadas e ambiente de convivência saudável.'
    },
    Cargo: {
      crítico: 'Os resultados indicam baixa clareza sobre funções, responsabilidades, metas ou expectativas. Recomenda-se revisão imediata da organização do trabalho.',
      elevado: 'Há sinais relevantes de desalinhamento sobre atribuições e responsabilidades. Recomenda-se ajuste de comunicação e definição de papéis.',
      moderado: 'A clareza de cargo apresenta condição intermediária, exigindo acompanhamento, alinhamento e melhoria de processos.',
      baixo: 'A dimensão apresenta condição favorável, indicando boa compreensão das responsabilidades, metas e expectativas.'
    },
    Mudança: {
      crítico: 'Os resultados indicam falhas importantes na comunicação ou condução de mudanças organizacionais. Recomenda-se intervenção estruturada.',
      elevado: 'Há percepção relevante de fragilidade na comunicação, participação ou suporte durante mudanças. Recomenda-se plano de comunicação e acompanhamento.',
      moderado: 'A condução de mudanças exige atenção preventiva, com melhoria da comunicação e participação dos trabalhadores.',
      baixo: 'A dimensão apresenta condição favorável, indicando boa percepção de comunicação, suporte e transparência durante mudanças.'
    },
    'Apoio da Chefia': {
      crítico: 'Os resultados indicam insuficiência significativa de suporte, orientação, feedback ou escuta por parte da liderança. Recomenda-se atuação imediata junto às chefias.',
      elevado: 'Há percepção relevante de fragilidade no suporte da liderança. Recomenda-se capacitação gerencial e fortalecimento do feedback.',
      moderado: 'O apoio da chefia apresenta condição intermediária, exigindo acompanhamento e melhoria das práticas de liderança.',
      baixo: 'A dimensão apresenta condição favorável, indicando boa percepção de suporte, feedback e disponibilidade da liderança.'
    },
    'Apoio dos Colegas': {
      crítico: 'Os resultados indicam baixa cooperação, integração ou apoio entre pares. Recomenda-se intervenção para fortalecimento do clima de equipe.',
      elevado: 'Há percepção relevante de fragilidade na cooperação ou suporte entre colegas. Recomenda-se ações de integração e melhoria do clima.',
      moderado: 'O apoio entre colegas exige atenção preventiva, com estímulo à colaboração e integração.',
      baixo: 'A dimensão apresenta condição favorável, indicando boa cooperação, integração e apoio entre pares.'
    }
  };

  return texts[name]?.[level] || 'A dimensão apresenta resultado que deve ser acompanhado pela gestão, considerando o contexto organizacional e os demais indicadores do relatório.';
}

function drawSummary() {
  title('Sumário');

  const items = [
    '1. Resumo Executivo',
    '2. Caracterização da Empresa',
    '3. Objetivo da Avaliação',
    '4. Método Utilizado',
    '5. Índice Geral Psicossocial ProlSafe',
    '6. Resultados por Dimensão',
    '7. Ranking Executivo de Dimensões',
    '8. Ranking por Setores',
    '9. Gráfico por Dimensão',
    '10. Radar Psicossocial',
    '11. Matriz de Risco Psicossocial',
    '12. Heatmap Psicossocial',
    '13. Plano de Ação Automático',
    '14. Conclusão Executiva',
    '15. Referências Técnicas'
  ];

  items.forEach(item => {
    doc.fillColor(text).font('Helvetica').fontSize(10).text(item, 70, doc.y + 2, {
      width: 460
    });
  });
}

function drawCompanyProfile() {
  title('Caracterização da empresa');

  const company = assessment.company;

  const rows = [
    ['Razão Social', company.razaoSocial || 'Não informado'],
    ['Nome Fantasia', company.nomeFantasia || 'Não informado'],
    ['CNPJ', company.cnpj || 'Não informado'],
    ['CNAE', company.cnae || 'Não informado'],
    ['Grau de Risco', company.grauRisco || 'Não informado'],
    ['Cidade/Estado', company.cidadeEstado || 'Não informado'],
    ['Total de Colaboradores', String(company.totalColabs || 0)],
    ['Setores Cadastrados', String(company.sectors?.length || 0)],
    ['Taxa de Resposta', `${responseRate}%`],
    ['Data de Emissão', new Date().toLocaleDateString('pt-BR')]
  ];

  let y = doc.y + 6;

  rows.forEach(([label, value], index) => {
    checkPage(28);

    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = col === 0 ? 46 : 302;
    const boxY = y + row * 46;

    doc.roundedRect(x, boxY, 235, 36, 8).fill('#f8fafc').strokeColor('#e2e8f0').stroke();

    doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(7.5).text(label, x + 10, boxY + 7, {
      width: 210
    });

    doc.fillColor(text).font('Helvetica-Bold').fontSize(9).text(value, x + 10, boxY + 20, {
      width: 210
    });
  });

  doc.y = y + Math.ceil(rows.length / 2) * 46 + 8;
  resetX();
}

function drawGeneralIndex() {
  title('Índice Geral Psicossocial ProlSafe');

  const score = Number(results.generalScore || 0);
  const cls = results.generalClassification;
  const x = 70;
  const y = doc.y + 10;
  const w = 400;
  const h = 20;
  const markerX = x + Math.min(1, score / 4) * w;

  doc.fillColor(text).font('Helvetica').fontSize(10).text(
    `Score Geral: ${score.toFixed(2)} — ${cls.label}`,
    46,
    doc.y,
    { width: 500 }
  );

  doc.moveDown(0.5);

  const parts = [
    ['Crítico', '#dc2626'],
    ['Elevado', '#f97316'],
    ['Moderado', '#eab308'],
    ['Saudável', '#16a34a']
  ];

  parts.forEach((part, i) => {
    doc.rect(x + i * (w / 4), y + 28, w / 4, h).fill(part[1]);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(7.5).text(part[0], x + i * (w / 4), y + 34, {
      width: w / 4,
      align: 'center'
    });
  });

  doc.circle(markerX, y + 38, 6).fill('#0f172a');

  doc.fillColor(text).font('Helvetica-Bold').fontSize(10).text(maturityLabel(score), 46, y + 62, {
    width: 500
  });

  doc.y = y + 92;
  resetX();
}

function drawExecutiveRanking(items) {
  title('Ranking executivo de dimensões');

  const sorted = [...items].sort((a, b) => Number(a.score) - Number(b.score));

  let y = doc.y + 6;

  doc.fillColor(blue).font('Helvetica-Bold').fontSize(9);
  doc.text('Posição', 55, y, { width: 60 });
  doc.text('Dimensão', 120, y, { width: 180 });
  doc.text('Score', 315, y, { width: 60 });
  doc.text('Classificação', 390, y, { width: 130 });

  y += 18;

  sorted.forEach((item, index) => {
    checkPage(28);

    const color = riskColor(item.score);

    doc.roundedRect(46, y - 5, 500, 24, 6).fill('#f8fafc').strokeColor('#e2e8f0').stroke();

    doc.fillColor(text).font('Helvetica').fontSize(8.8);
    doc.text(`${index + 1}º`, 60, y, { width: 50 });
    doc.text(item.name, 120, y, { width: 180 });
    doc.font('Helvetica-Bold').text(Number(item.score).toFixed(2), 315, y, { width: 60 });

    doc.roundedRect(390, y - 2, 120, 16, 5).fill(color);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(7.3).text(riskLabel(item.score), 394, y + 2, {
      width: 112,
      align: 'center'
    });

    y += 29;
  });

  doc.y = y + 6;
  resetX();
}

function drawSectorRanking() {
  title('Ranking executivo por setores');

  const sectors = results.bySector || [];

  if (!sectors.length) {
    p('Não foram identificados dados suficientes para ranking por setores.');
    return;
  }

  let y = doc.y + 6;

  doc.fillColor(blue).font('Helvetica-Bold').fontSize(9);
  doc.text('Posição', 55, y, { width: 60 });
  doc.text('Setor', 120, y, { width: 210 });
  doc.text('Score', 345, y, { width: 60 });
  doc.text('Classificação', 410, y, { width: 120 });

  y += 18;

  sectors.forEach((sector, index) => {
    checkPage(28);

    doc.roundedRect(46, y - 5, 500, 24, 6).fill('#f8fafc').strokeColor('#e2e8f0').stroke();

    doc.fillColor(text).font('Helvetica').fontSize(8.8);
    doc.text(`${index + 1}º`, 60, y, { width: 50 });
    doc.text(sector.name, 120, y, { width: 210 });
    doc.font('Helvetica-Bold').text(Number(sector.score).toFixed(2), 345, y, { width: 60 });

    doc.roundedRect(410, y - 2, 115, 16, 5).fill(riskColor(sector.score));
    doc.fillColor('white').font('Helvetica-Bold').fontSize(7).text(riskLabel(sector.score), 414, y + 2, {
      width: 107,
      align: 'center'
    });

    y += 29;
  });

  doc.y = y + 6;
  resetX();
}

function drawHeatmap(items) {
  title('Heatmap psicossocial por setor e dimensão');

  const sectors = results.bySector || [];
  const dimensions = items.map(i => i.name);

  if (!sectors.length || !dimensions.length) {
    p('Não foram identificados dados suficientes para construção do heatmap psicossocial.');
    return;
  }

  const x = 46;
  let y = doc.y + 8;
  const firstColW = 95;
  const cellW = Math.min(58, (500 - firstColW) / dimensions.length);
  const cellH = 28;

  doc.fillColor(blue).font('Helvetica-Bold').fontSize(7.2);
  doc.text('Setor', x + 4, y + 8, { width: firstColW - 8 });

  dimensions.forEach((dim, i) => {
    doc.text(dim.slice(0, 8), x + firstColW + i * cellW, y + 4, {
      width: cellW,
      align: 'center'
    });
  });

  y += cellH;

  sectors.forEach(sector => {
    checkPage(38);

    doc.roundedRect(x, y, firstColW - 3, cellH, 4).fill('#f8fafc').strokeColor('#e2e8f0').stroke();
    doc.fillColor(text).font('Helvetica-Bold').fontSize(7.5).text(sector.name, x + 5, y + 9, {
      width: firstColW - 10
    });

    dimensions.forEach((dim, i) => {
      const found = sector.dimensions?.find(d => d.dimension === dim);
      const score = found ? Number(found.score) : null;
      const color = score === null ? '#cbd5e1' : riskColor(score);

      const cellX = x + firstColW + i * cellW;

      doc.roundedRect(cellX, y, cellW - 3, cellH, 4).fill(color);
      doc.fillColor('white').font('Helvetica-Bold').fontSize(7).text(
        score === null ? '-' : score.toFixed(1),
        cellX,
        y + 9,
        { width: cellW - 3, align: 'center' }
      );
    });

    y += cellH + 5;
  });

  doc.y = y + 8;
  resetX();

  p('O heatmap permite identificar rapidamente quais setores e dimensões concentram os maiores níveis de atenção psicossocial.');
}

function drawExecutiveConclusion(items) {
  title('Conclusão executiva');

  const sorted = [...items].sort((a, b) => Number(a.score) - Number(b.score));
  const worst = sorted.slice(0, 3).map(i => i.name).join(', ');
  const score = Number(results.generalScore || 0);

  p(
    `A organização apresentou score geral de ${score.toFixed(2)}, classificado como ${results.generalClassification.label}. As dimensões que demandam maior atenção neste ciclo avaliativo são: ${worst || 'não identificadas'}.`
  );

  p(
    'Recomenda-se que a empresa priorize as ações de maior impacto organizacional, formalize responsáveis e prazos, registre evidências das medidas adotadas e realize acompanhamento periódico dos indicadores psicossociais.'
  );

  p(
    'Sugere-se nova avaliação após a implementação das medidas propostas ou em periodicidade definida pela gestão de SST, de modo a monitorar evolução, efetividade das ações e melhoria contínua do ambiente de trabalho.'
  );
}

function drawFinalPage() {
  doc.addPage();

  doc.rect(0, 0, 595, 842).fill(blue);

  doc.fillColor('white').font('Helvetica-Bold').fontSize(30).text('PROLSAFE', 46, 260, {
    width: 500,
    align: 'center'
  });

  doc.fontSize(15).text('Saúde e Segurança do Trabalho', 46, 300, {
    width: 500,
    align: 'center'
  });

  doc.moveDown(3);

  doc.fontSize(18).text('Avaliação Organizacional dos', 46, 390, {
    width: 500,
    align: 'center'
  });

  doc.text('Fatores de Risco Psicossociais', 46, 418, {
    width: 500,
    align: 'center'
  });

  doc.fontSize(11).text('Relatório técnico gerado pelo sistema ProlSafe Psicossocial.', 46, 510, {
    width: 500,
    align: 'center'
  });

  doc.fontSize(10).text('Fortaleza - CE', 46, 650, {
    width: 500,
    align: 'center'
  });
}
  const dimensionItems = (results.byDimension || []).map(d => ({
    name: d.name,
    score: Number(d.score || 0),
    classification: d.classification
  }));

  doc.rect(0, 0, 595, 170).fill(blue);

  doc
    .fillColor('white')
    .fontSize(22)
    .font('Helvetica-Bold')
    .text('Relatório de Avaliação Organizacional', 46, 52, {
      width: 500
    });

  doc
    .fontSize(14)
    .text('Fatores de Risco Psicossociais Relacionados ao Trabalho', 46, 84, {
      width: 500
    });

  doc
    .fontSize(11)
    .text(`Empresa: ${assessment.company.razaoSocial}`, 46, 124, {
      width: 500
    });

  doc.text(
    `CNPJ: ${assessment.company.cnpj || 'Não informado'} | Emissão: ${new Date().toLocaleDateString('pt-BR')}`,
    46,
    141,
    { width: 500 }
  );

  doc.addPage();

drawSummary();
doc.addPage();

  title('Resumo executivo');

drawCompanyProfile();
drawGeneralIndex();

  p(
    `A avaliação psicossocial da empresa ${assessment.company.razaoSocial} foi realizada com base no método HSE-IT, contemplando as dimensões Demandas, Controle, Relacionamentos, Cargo, Mudança, Apoio da Chefia e Apoio dos Colegas. O score geral foi ${results.generalScore}, classificado como ${results.generalClassification.label}. A taxa de resposta apurada foi de ${responseRate}%.`
  );

drawExecutiveRanking(dimensionItems);
drawSectorRanking();
  drawLegend();

  title('Objetivo da avaliação');

  p(
    'Identificar, de forma organizacional e coletiva, fatores psicossociais relacionados ao trabalho que possam demandar medidas de prevenção, controle, monitoramento e melhoria contínua do ambiente laboral. A avaliação não possui finalidade clínica, diagnóstica ou individual.'
  );

  title('Método e instrumento utilizado');

  p(
    'Foi utilizado questionário estruturado inspirado no método HSE-IT, com escala de respostas de cinco pontos: Nunca, Raramente, Às vezes, Frequentemente e Sempre. Algumas dimensões possuem pontuação invertida quando maior frequência indica maior exposição ao risco.'
  );

drawHeatmap(dimensionItems);

  checkPage(300);
  drawDimensionBarChart(dimensionItems);

  checkPage(260);
  drawRadarChart(dimensionItems);

  checkPage(260);
  drawRiskMatrix(dimensionItems);

  checkPage(220);
  title('Síntese geral por dimensão psicossocial');

  dimensionItems.forEach(d => {
    checkPage(78);

    const classification = d.classification || {
      color: riskColor(d.score),
      label: riskLabel(d.score),
      level: 'MEDIO'
    };

    doc
      .fillColor(classification.color || riskColor(d.score))
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(
        `${d.name}: ${Number(d.score).toFixed(2)} — ${
          classification.label || riskLabel(d.score)
        }`,
        46,
        doc.y,
        { width: 500 }
      );

    doc.moveDown(0.15);
    p(recommendationFor(d.name, classification.level));
    doc.moveDown(0.35);
  });

  title('Ranking por setores');

  if (results.bySector?.length) {
    results.bySector.forEach(s => {
      checkPage(28);
      p(`${s.name}: score ${s.score} — ${s.classification.label}`);
    });
  } else {
    p('Não foram identificados dados suficientes para ranking por setores.');
  }

  title('Distribuição das respostas');

  p(
    `Favoráveis: ${results.responseDistribution.favorable}%. Neutras: ${results.responseDistribution.neutral}%. Desfavoráveis: ${results.responseDistribution.unfavorable}%.`
  );

  drawActionPlan(dimensionItems);

  title('Diretrizes para gestão dos riscos psicossociais');

  p(
    'Recomenda-se priorizar dimensões classificadas como atenção crítica ou elevada, criar plano de ação com responsáveis e prazos, realizar comunicação institucional, acompanhar indicadores, registrar evidências de conclusão e programar reavaliações periódicas.'
  );

  title('Conclusão');

  p(
    'Com base nos dados coletados, recomenda-se que a empresa conduza o plano de ação considerando a hierarquia das dimensões mais críticas, preservando o anonimato dos colaboradores e utilizando os resultados para melhoria organizacional, prevenção de agravos e fortalecimento da gestão em SST.'
  );

drawExecutiveConclusion(dimensionItems);

  title('Referências técnicas');

  p(
    'HSE Management Standards; fundamentos de gestão de riscos ocupacionais; princípios de confidencialidade, anonimização e proteção de dados aplicáveis à LGPD.'
  );



  doc.end();

  return filePath;
}