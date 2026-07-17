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
    sectors[sectorName] ??= {
      total: 0,
      count: 0,
      responseIds: new Set(),
      dimensions: {}
    };
    sectors[sectorName].responseIds.add(response.id);

    for (const answer of response.answers) {
      const dim = answer.question.dimension;
      const score = normalizeAnswer(answer.value, dim.inverted);

      dimensions[dim.name] ??= { total: 0, count: 0, items: [] };
      dimensions[dim.name].total += score;
      dimensions[dim.name].count += 1;
      dimensions[dim.name].items.push({
        question: answer.question.text,
        score,
        raw: answer.value
      });

      sectors[sectorName].total += score;
      sectors[sectorName].count += 1;
      sectors[sectorName].dimensions[dim.name] ??= { total: 0, count: 0 };
      sectors[sectorName].dimensions[dim.name].total += score;
      sectors[sectorName].dimensions[dim.name].count += 1;

      total += score;
      count += 1;

      if (score >= 3.1) favorable += 1;
      else if (score >= 2.1) neutral += 1;
      else unfavorable += 1;
    }
  }

  const byDimension = Object.entries(dimensions)
    .map(([name, dimension]) => {
      const score = dimension.count ? dimension.total / dimension.count : 0;
      return {
        name,
        score: Number(score.toFixed(2)),
        classification: classifyScore(score),
        items: dimension.items
      };
    })
    .sort((a, b) => a.score - b.score);

  const bySector = Object.entries(sectors)
    .map(([name, sector]) => {
      const score = sector.count ? sector.total / sector.count : 0;
      const dimensionsBySector = Object.entries(sector.dimensions)
        .map(([dimension, data]) => {
          const dimensionScore = data.count ? data.total / data.count : 0;
          return {
            dimension,
            score: Number(dimensionScore.toFixed(2)),
            classification: classifyScore(dimensionScore)
          };
        })
        .sort((a, b) => a.score - b.score);

      return {
        name,
        score: Number(score.toFixed(2)),
        responseCount: sector.responseIds.size,
        classification: classifyScore(score),
        dimensions: dimensionsBySector
      };
    })
    .sort((a, b) => a.score - b.score);

  const generalScore = count ? total / count : 0;

  return {
    generalScore: Number(generalScore.toFixed(2)),
    generalClassification: classifyScore(generalScore),
    responseCount: responses.length,
    byDimension,
    bySector,
    responseDistribution: {
      favorable: count ? Number(((favorable / count) * 100).toFixed(1)) : 0,
      neutral: count ? Number(((neutral / count) * 100).toFixed(1)) : 0,
      unfavorable: count ? Number(((unfavorable / count) * 100).toFixed(1)) : 0
    }
  };
}
