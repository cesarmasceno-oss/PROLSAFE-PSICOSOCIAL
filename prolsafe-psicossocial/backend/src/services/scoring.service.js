export const RESPONSE_LABELS = ['Nunca', 'Raramente', 'Às vezes', 'Frequentemente', 'Sempre'];

export function normalizeAnswer(value, inverted = false) {
  // value: 0 a 4. Em dimensão invertida, maior frequência representa maior risco.
  return inverted ? 4 - value : value;
}

export function classifyScore(score) {
  if (score <= 1.0) return { level: 'ALTO', label: 'Risco alto / Atenção crítica', color: '#dc2626' };
  if (score <= 2.0) return { level: 'MODERADO', label: 'Risco moderado / Atenção elevada', color: '#f97316' };
  if (score <= 3.0) return { level: 'MEDIO', label: 'Risco médio / Atenção moderada', color: '#facc15' };
  return { level: 'BAIXO', label: 'Risco baixo / Atenção rotineira', color: '#16a34a' };
}

export function calculateResults(responses) {
  const dimensions = {};
  const sectors = {};
  let total = 0;
  let count = 0;
  let favorable = 0;
  let neutral = 0;
  let unfavorable = 0;

  for (const response of responses) {
    const sectorName = response.sector?.name || 'Não informado';
    sectors[sectorName] ??= { total: 0, count: 0, dimensions: {} };

    for (const answer of response.answers) {
      const dim = answer.question.dimension;
      const score = normalizeAnswer(answer.value, dim.inverted);
      dimensions[dim.name] ??= { total: 0, count: 0, items: [] };
      dimensions[dim.name].total += score;
      dimensions[dim.name].count++;
      dimensions[dim.name].items.push({ question: answer.question.text, score, raw: answer.value });
      sectors[sectorName].total += score;
      sectors[sectorName].count++;
      sectors[sectorName].dimensions[dim.name] ??= { total: 0, count: 0 };
      sectors[sectorName].dimensions[dim.name].total += score;
      sectors[sectorName].dimensions[dim.name].count++;
      total += score;
      count++;
      if (score >= 3.1) favorable++;
      else if (score >= 2.1) neutral++;
      else unfavorable++;
    }
  }

  const byDimension = Object.entries(dimensions).map(([name, d]) => {
    const score = d.count ? d.total / d.count : 0;
    return { name, score: Number(score.toFixed(2)), classification: classifyScore(score), items: d.items };
  }).sort((a, b) => a.score - b.score);

  const bySector = Object.entries(sectors).map(([name, s]) => {
    const score = s.count ? s.total / s.count : 0;
    const dims = Object.entries(s.dimensions).map(([dimension, d]) => ({
      dimension,
      score: Number((d.total / d.count).toFixed(2)),
      classification: classifyScore(d.total / d.count)
    }));
    return { name, score: Number(score.toFixed(2)), classification: classifyScore(score), dimensions: dims };
  }).sort((a, b) => a.score - b.score);

  const generalScore = count ? total / count : 0;
  return {
    generalScore: Number(generalScore.toFixed(2)),
    generalClassification: classifyScore(generalScore),
    byDimension,
    bySector,
    responseDistribution: {
      favorable: count ? Number(((favorable / count) * 100).toFixed(1)) : 0,
      neutral: count ? Number(((neutral / count) * 100).toFixed(1)) : 0,
      unfavorable: count ? Number(((unfavorable / count) * 100).toFixed(1)) : 0
    }
  };
}
