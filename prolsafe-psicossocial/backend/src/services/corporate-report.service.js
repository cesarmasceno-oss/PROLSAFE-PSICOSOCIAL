import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { generateReportPdf } from './pdf.service.js';

const A4 = [595.28, 841.89];

function color(hex) {
  const clean = hex.replace('#', '');
  const value = Number.parseInt(clean, 16);
  return rgb(
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255
  );
}

function cleanText(value, fallback = 'Não informado') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function formatDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function formatCnpj(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 14) return cleanText(value);
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

function wrapText(text, font, size, maxWidth) {
  const words = cleanText(text, '').split(' ').filter(Boolean);
  const lines = [];
  let current = '';

  words.forEach(word => {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  });

  if (current) lines.push(current);
  return lines;
}

function drawWrappedText(page, value, options) {
  const {
    x,
    y,
    width,
    font,
    size,
    lineHeight = size * 1.2,
    fill = color('#0b2442'),
    maxLines = 4
  } = options;

  const lines = wrapText(value, font, size, width).slice(0, maxLines);
  lines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - index * lineHeight,
      size,
      font,
      color: fill
    });
  });

  return y - Math.max(1, lines.length) * lineHeight;
}

async function loadFinishedPdf(filePath) {
  let lastError;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
        const bytes = fs.readFileSync(filePath);
        return await PDFDocument.load(bytes);
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw lastError || new Error('O relatório base não terminou de ser gerado.');
}

function findLogoPath() {
  const candidates = [
    path.resolve('src/assets/logo-prolsafe.png'),
    path.resolve('prolsafe-psicossocial/backend/src/assets/logo-prolsafe.png'),
    path.resolve(process.cwd(), 'src/assets/logo-prolsafe.png')
  ];

  return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

async function embedLogo(pdf) {
  const logoPath = findLogoPath();
  if (!logoPath) return null;

  try {
    return await pdf.embedPng(fs.readFileSync(logoPath));
  } catch (error) {
    console.warn('Não foi possível incorporar a logo ProlSafe:', error.message);
    return null;
  }
}

async function drawCorporateCover(pdf, assessment, responseRate, logo) {
  const page = pdf.addPage(A4);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const navy = color('#082b52');
  const deepBlue = color('#0b3f75');
  const teal = color('#0f8f8a');
  const ink = color('#102a43');
  const muted = color('#5f7287');
  const paper = color('#f5f8fb');
  const white = color('#ffffff');
  const border = color('#d9e3ed');

  page.drawRectangle({ x: 0, y: 0, width: A4[0], height: A4[1], color: paper });
  page.drawRectangle({ x: 0, y: 0, width: 24, height: A4[1], color: navy });

  page.drawRectangle({
    x: 405,
    y: 708,
    width: 190,
    height: 134,
    color: teal,
    opacity: 0.11
  });
  page.drawCircle({
    x: 525,
    y: 745,
    size: 92,
    color: deepBlue,
    opacity: 0.09
  });
  page.drawCircle({
    x: 565,
    y: 815,
    size: 44,
    color: teal,
    opacity: 0.2
  });

  if (logo) {
    const scale = Math.min(155 / logo.width, 78 / logo.height);
    page.drawImage(logo, {
      x: 56,
      y: 744,
      width: logo.width * scale,
      height: logo.height * scale
    });
  } else {
    page.drawRectangle({ x: 56, y: 756, width: 43, height: 43, color: teal });
    page.drawText('PS', {
      x: 69,
      y: 771,
      size: 14,
      font: bold,
      color: white
    });
    page.drawText('PROLSAFE', {
      x: 112,
      y: 778,
      size: 17,
      font: bold,
      color: navy
    });
  }

  page.drawText('RELATÓRIO TÉCNICO', {
    x: 57,
    y: 690,
    size: 9,
    font: bold,
    color: teal
  });

  let titleY = 645;
  titleY = drawWrappedText(page, 'Avaliação Organizacional', {
    x: 57,
    y: titleY,
    width: 455,
    font: bold,
    size: 31,
    lineHeight: 36,
    fill: navy,
    maxLines: 2
  });

  drawWrappedText(
    page,
    'Fatores de Risco Psicossociais Relacionados ao Trabalho',
    {
      x: 57,
      y: titleY - 10,
      width: 440,
      font: regular,
      size: 15,
      lineHeight: 21,
      fill: ink,
      maxLines: 3
    }
  );

  page.drawRectangle({ x: 57, y: 510, width: 70, height: 4, color: teal });
  page.drawRectangle({ x: 127, y: 510, width: 388, height: 1, color: border });

  page.drawRectangle({
    x: 57,
    y: 220,
    width: 480,
    height: 242,
    color: white,
    borderColor: border,
    borderWidth: 1
  });
  page.drawRectangle({ x: 57, y: 422, width: 480, height: 40, color: navy });
  page.drawText('IDENTIFICAÇÃO DO DOCUMENTO', {
    x: 76,
    y: 437,
    size: 10,
    font: bold,
    color: white
  });

  const company = assessment.company || {};
  const companyName = cleanText(company.nomeFantasia || company.razaoSocial);
  const legalName = cleanText(company.razaoSocial);
  const code = cleanText(assessment.id, '').slice(-8).toUpperCase();

  page.drawText('EMPRESA AVALIADA', {
    x: 76,
    y: 391,
    size: 8,
    font: bold,
    color: teal
  });
  drawWrappedText(page, companyName, {
    x: 76,
    y: 368,
    width: 420,
    font: bold,
    size: 19,
    lineHeight: 22,
    fill: navy,
    maxLines: 2
  });

  if (legalName !== companyName) {
    drawWrappedText(page, legalName, {
      x: 76,
      y: 323,
      width: 420,
      font: regular,
      size: 9,
      lineHeight: 12,
      fill: muted,
      maxLines: 2
    });
  }

  const infoRows = [
    ['CNPJ', formatCnpj(company.cnpj)],
    ['Instrumento', 'HSE-IT — avaliação organizacional'],
    ['Período de coleta', `${formatDate(assessment.startDate)} a ${formatDate(assessment.deadline || new Date())}`],
    ['Taxa de resposta', `${Number(responseRate || 0).toFixed(1).replace('.', ',')}%`]
  ];

  let infoY = 292;
  infoRows.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 76 + col * 230;
    const y = infoY - row * 58;

    page.drawText(label.toUpperCase(), {
      x,
      y,
      size: 7.5,
      font: bold,
      color: muted
    });
    drawWrappedText(page, value, {
      x,
      y: y - 18,
      width: 205,
      font: regular,
      size: 10,
      lineHeight: 13,
      fill: ink,
      maxLines: 2
    });
  });

  page.drawText('DOCUMENTO CONFIDENCIAL · USO ORGANIZACIONAL', {
    x: 57,
    y: 145,
    size: 8,
    font: bold,
    color: teal
  });
  drawWrappedText(
    page,
    'Este relatório apresenta resultados coletivos e não possui finalidade clínica, diagnóstica ou individual.',
    {
      x: 57,
      y: 123,
      width: 460,
      font: regular,
      size: 9,
      lineHeight: 13,
      fill: muted,
      maxLines: 2
    }
  );

  page.drawRectangle({ x: 57, y: 58, width: 480, height: 1, color: border });
  page.drawText('PROLSAFE · Saúde e Segurança Ocupacional', {
    x: 57,
    y: 39,
    size: 8,
    font: bold,
    color: navy
  });
  page.drawText(`Código PS-${code || 'RELATORIO'}`, {
    x: 390,
    y: 39,
    size: 8,
    font: regular,
    color: muted
  });
}

async function decorateInternalPages(pdf, assessment, logo) {
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = color('#082b52');
  const teal = color('#0f8f8a');
  const muted = color('#5f7287');
  const border = color('#d9e3ed');
  const white = color('#ffffff');

  const pages = pdf.getPages();
  const totalPages = pages.length;
  const companyName = cleanText(
    assessment.company?.nomeFantasia || assessment.company?.razaoSocial,
    'Empresa avaliada'
  );

  pages.forEach((page, index) => {
    if (index === 0) return;

    const { width, height } = page.getSize();

    page.drawRectangle({
      x: 0,
      y: height - 60,
      width,
      height: 60,
      color: white,
      opacity: 0.97
    });

    if (logo) {
      const scale = Math.min(82 / logo.width, 34 / logo.height);
      page.drawImage(logo, {
        x: 46,
        y: height - 49,
        width: logo.width * scale,
        height: logo.height * scale
      });
    } else {
      page.drawText('PROLSAFE', {
        x: 46,
        y: height - 36,
        size: 10,
        font: bold,
        color: navy
      });
    }

    page.drawText('Relatório de Avaliação Psicossocial Organizacional', {
      x: 146,
      y: height - 32,
      size: 8,
      font: bold,
      color: navy
    });

    page.drawText(companyName.slice(0, 56), {
      x: 146,
      y: height - 45,
      size: 7,
      font: regular,
      color: muted
    });

    page.drawLine({
      start: { x: 46, y: height - 58 },
      end: { x: width - 46, y: height - 58 },
      thickness: 1,
      color: border
    });

    page.drawLine({
      start: { x: 46, y: 38 },
      end: { x: width - 46, y: 38 },
      thickness: 1,
      color: border
    });

    page.drawText('PROLSAFE · Documento confidencial de uso organizacional', {
      x: 46,
      y: 22,
      size: 6.8,
      font: regular,
      color: muted
    });

    page.drawText(`Página ${index + 1} de ${totalPages}`, {
      x: width - 126,
      y: 22,
      size: 7,
      font: bold,
      color: teal
    });
  });
}

export async function generateCorporateReportPdf(args) {
  const filePath = generateReportPdf(args);
  const sourcePdf = await loadFinishedPdf(filePath);
  const finalPdf = await PDFDocument.create();
  const logo = await embedLogo(finalPdf);

  await drawCorporateCover(finalPdf, args.assessment, args.responseRate, logo);

  const sourceIndexes = sourcePdf.getPageIndices();
  const contentIndexes = sourceIndexes.length > 1
    ? sourceIndexes.slice(1)
    : sourceIndexes;

  const copiedPages = await finalPdf.copyPages(sourcePdf, contentIndexes);
  copiedPages.forEach(page => finalPdf.addPage(page));

  await decorateInternalPages(finalPdf, args.assessment, logo);

  const finalBytes = await finalPdf.save();
  fs.writeFileSync(filePath, finalBytes);

  return filePath;
}
