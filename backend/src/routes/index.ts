import { Router } from 'express';
import authRoutes from './auth.routes';
import warningRoutes from './warning.routes';
import reportRoutes from './report.routes';
import analyticsRoutes from './analytics.routes';
import coordinationRoutes from './coordination.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/warnings', warningRoutes);
router.use('/reports', reportRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/', coordinationRoutes);  // mounts /shelters, /rescue-teams, /dispatches, /supplies, /coordination-summary

router.get('/ping', (_req, res) => res.json({ success: true, data: 'pong' }));

export { router };