const base = {
  Demandas: 'Equilibrar volume de tarefas, prazos, pausas, organização da rotina e prevenção de sobrecarga.',
  Controle: 'Ampliar autonomia, participação nas decisões, flexibilidade e liberdade de método.',
  Relacionamentos: 'Prevenir conflitos, fortalecer canais de escuta, respeito, combate ao assédio e convivência ética.',
  Cargo: 'Garantir clareza de funções, responsabilidades, metas e alinhamento de expectativas.',
  Mudança: 'Promover comunicação transparente, participação dos trabalhadores e acompanhamento das mudanças.',
  'Apoio da Chefia': 'Fortalecer liderança, feedback, escuta ativa e suporte técnico.',
  'Apoio dos Colegas': 'Estimular cooperação, integração, apoio entre pares e fortalecimento do clima organizacional.'
};

export function recommendationFor(dimension, level) {
  const text = base[dimension] || 'Implementar ações de melhoria, comunicação e monitoramento contínuo.';
  if (level === 'ALTO') return `Ação prioritária imediata: ${text} Definir responsáveis, prazo curto e acompanhamento sistemático.`;
  if (level === 'MODERADO') return `Ação corretiva recomendada: ${text} Monitorar indicadores e reavaliar após implantação.`;
  if (level === 'MEDIO') return `Ação preventiva: ${text} Manter acompanhamento periódico e ações de melhoria.`;
  return `Manutenção e monitoramento: ${text} Preservar boas práticas e reavaliar periodicamente.`;
}
