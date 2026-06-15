import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth.routes.js';
import companyRoutes from './routes/company.routes.js';
import questionnaireRoutes from './routes/questionnaire.routes.js';
import assessmentRoutes from './routes/assessment.routes.js';
import resultRoutes from './routes/result.routes.js';
import reportRoutes from './routes/report.routes.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.APP_URL || '*'}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));
app.use('/reports-files', express.static('reports'));

app.get('/health', (_, res) => res.json({ ok: true, app: 'ProlSafe Psicossocial' }));
app.use('/auth', authRoutes);
app.use('/companies', companyRoutes);
app.use('/questionnaires', questionnaireRoutes);
app.use('/assessments', assessmentRoutes);
app.use('/results', resultRoutes);
app.use('/reports', reportRoutes);

const port = process.env.PORT || 3333;
app.listen(port, () => console.log(`ProlSafe Psicossocial API on :${port}`));
