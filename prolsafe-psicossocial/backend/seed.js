import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
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
    for (const text of questions[name]) {
      const exists = await prisma.question.findFirst({ where: { text, dimensionId: dim.id } });
      if (!exists) await prisma.question.create({ data: { text, dimensionId: dim.id } });
    }
  }
  const hash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({ where: { email: 'admin@prolsafe.com.br' }, update: { password: hash }, create: { name:'Administrador ProlSafe', email:'admin@prolsafe.com.br', password: hash, role:'ADMIN_PROLSAFE' } });
  const company = await prisma.company.upsert({
    where: { cnpj: '00000000000100' },
    update: {},
    create: { razaoSocial:'Empresa Demonstração LTDA', nomeFantasia:'Cliente Demonstração', cnpj:'00000000000100', cnae:'8630-5/03', grauRisco:'2', cidadeEstado:'Fortaleza/CE', responsavel:'Responsável Demo', email:'cliente@demo.com', telefone:'(85) 99999-9999', totalColabs: 40, status:'AVALIACAO_EM_ANDAMENTO', sectors: { create: [{name:'Administrativo', employees:10},{name:'Operacional', employees:20},{name:'Atendimento', employees:10}] } }
  });
  let assessment = await prisma.assessment.findFirst({ where: { companyId: company.id } });
  if (!assessment) await prisma.assessment.create({ data: { title:'Avaliação Psicossocial Inicial', companyId: company.id, publicToken: crypto.randomBytes(20).toString('hex') } });
}
main().then(()=>console.log('Seed concluído: admin@prolsafe.com.br / admin123')).finally(()=>prisma.$disconnect());
