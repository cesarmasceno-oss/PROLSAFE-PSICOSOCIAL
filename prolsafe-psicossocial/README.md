# ProlSafe Psicossocial

Base funcional do sistema web para aplicação de questionários psicossociais, cálculo automático, dashboards e geração de relatório em PDF.

## Como rodar do zero

```bash
cd prolsafe-psicossocial
npm install
npm run install:all
cd backend
npx prisma generate --schema prisma.schema
npx prisma db push --schema prisma.schema
npm run seed
cd ..
npm run dev
```

Acesse:

- Sistema: http://localhost:5173
- API: http://localhost:3333/health

Login de teste:

- E-mail: admin@prolsafe.com.br
- Senha: admin123

## Observação

A versão anterior estava com as telas em modo demonstração. Nesta versão, o login, cadastro de empresas, criação de avaliação, link público do colaborador, registro de respostas, resultados e geração de PDF estão conectados ao back-end.
