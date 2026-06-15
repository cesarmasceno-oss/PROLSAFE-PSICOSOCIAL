import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
const dims = [
  ['Demandas', true], ['Controle', false], ['Relacionamentos', true], ['Cargo', false], ['Mudança', false], ['Apoio da Chefia', false], ['Apoio dos Colegas', false]
];
const questions = {
  Demandas: ['Tenho prazos incompatíveis com a carga de trabalho.', 'A quantidade de trabalho exige esforço excessivo.', 'Sinto pressão intensa para concluir minhas atividades.'],
  Controle: ['Tenho autonomia para organizar meu trabalho.', 'Posso decidir como executar minhas tarefas.', 'Tenho participação nas decisões que afetam meu trabalho.'],
  Relacionamentos: ['Há conflitos frequentes no ambiente de trabalho.', 'Já presenciei situações de desrespeito ou constrangimento.', 'O clima entre as pessoas prejudica a rotina.'],
  Cargo: ['Minhas responsabilidades são claras.', 'Entendo o que esperam da minha função.', 'Minhas metas são bem comunicadas.'],
  Mudança: ['As mudanças são comunicadas com antecedência.', 'Recebo orientação quando ocorrem mudanças.', 'Tenho oportunidade de tirar dúvidas sobre mudanças.'],
  'Apoio da Chefia': ['Minha chefia oferece apoio quando necessário.', 'Recebo feedback sobre meu trabalho.', 'Minha liderança escuta sugestões e dificuldades.'],
  'Apoio dos Colegas': ['Recebo apoio dos colegas quando preciso.', 'Há cooperação entre a equipe.', 'Sinto integração com meus colegas.']
};
async function main(){
  for (const [name, inverted] of dims) {
    const dim = await prisma.dimension.upsert({ where: { name }, update: { inverted }, create: { name, inverted } });
    for (const text of questions[name]) await prisma.question.create({ data: { text, dimensionId: dim.id } }).catch(()=>{});
  }
  const hash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({ where: { email: 'admin@prolsafe.com.br' }, update: {}, create: { name:'Administrador ProlSafe', email:'admin@prolsafe.com.br', password: hash, role:'ADMIN_PROLSAFE' } });
}
main().finally(()=>prisma.$disconnect());
