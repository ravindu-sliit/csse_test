import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { authorizeRoles } from '../middleware/authorizeRoles';
import { getOverview, getShelterAnalytics, getResourceAnalytics, getAlertTimeline, generateReport, getReportHistory, getCompletedEvents, previewAnalyticsReport, generateAnalyticsReport, downloadAnalyticsReport, deleteAnalyticsReport } from '../controllers/analytics.controller';

const router = Router();
const officers = ['DMC_OFFICER', 'DMC_DUTY_OFFICER', 'DISTRICT_OFFICER', 'RESCUE_TEAM'];

router.use(authenticateToken);
router.get('/overview', authorizeRoles(...officers), getOverview);
router.get('/shelters', authorizeRoles(...officers), getShelterAnalytics);
router.get('/resources', authorizeRoles(...officers), getResourceAnalytics);
router.get('/alert-timeline', authorizeRoles(...officers), getAlertTimeline);
router.post('/generate', authorizeRoles('DMC_OFFICER', 'DMC_DUTY_OFFICER'), generateReport);
router.get('/history', authorizeRoles('DMC_OFFICER', 'DMC_DUTY_OFFICER'), getReportHistory);
router.get('/reports/events', authorizeRoles('DMC_OFFICER'), getCompletedEvents);
router.post('/reports/preview', authorizeRoles('DMC_OFFICER'), previewAnalyticsReport);
router.post('/reports/generate', authorizeRoles('DMC_OFFICER'), generateAnalyticsReport);
router.get('/reports', authorizeRoles('DMC_OFFICER'), getReportHistory);
router.get('/reports/:id/download', authorizeRoles('DMC_OFFICER'), downloadAnalyticsReport);
router.delete('/reports/:id', authorizeRoles('DMC_OFFICER'), deleteAnalyticsReport);

export default router;