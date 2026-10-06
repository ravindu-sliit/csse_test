import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { authorizeRoles } from '../middleware/authorizeRoles';
import { getOverview, getShelterAnalytics, getResourceAnalytics, getAlertTimeline, generateReport, getReportHistory } from '../controllers/analytics.controller';

const router = Router();
const officers = ['DMC_OFFICER', 'DMC_DUTY_OFFICER', 'DISTRICT_OFFICER', 'RESCUE_TEAM'];

router.use(authenticateToken);
router.get('/overview', authorizeRoles(...officers), getOverview);
router.get('/shelters', authorizeRoles(...officers), getShelterAnalytics);
router.get('/resources', authorizeRoles(...officers), getResourceAnalytics);
router.get('/alert-timeline', authorizeRoles(...officers), getAlertTimeline);
router.post('/generate', authorizeRoles('DMC_OFFICER', 'DMC_DUTY_OFFICER'), generateReport);
router.get('/history', authorizeRoles('DMC_OFFICER', 'DMC_DUTY_OFFICER'), getReportHistory);

export default router;