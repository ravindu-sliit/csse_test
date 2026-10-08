import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { authorizeRoles } from '../middleware/authorizeRoles';
import { validateRequest } from '../middleware/validateRequest';
import { createWarningSchema, cancelWarningSchema, escalateWarningSchema } from '../schemas/warning.schema';
import {
  createWarning, getWarnings, getWarning,
  getBroadcastStatus, cancelWarning, escalateWarning, getDashboardSummary
} from '../controllers/warning.controller';

const router = Router();
const allRoles = ['DMC_OFFICER', 'DMC_DUTY_OFFICER', 'DISTRICT_OFFICER', 'RESCUE_TEAM', 'CITIZEN'];
const officerRoles = ['DMC_OFFICER', 'DMC_DUTY_OFFICER', 'DISTRICT_OFFICER', 'RESCUE_TEAM'];

router.use(authenticateToken);

// Dashboard summary — accessible by all authenticated users
router.get('/dashboard-summary', authorizeRoles(...officerRoles), getDashboardSummary);

// Warning CRUD
router.post('/', authorizeRoles('DMC_OFFICER', 'DMC_DUTY_OFFICER'), validateRequest(createWarningSchema), createWarning);
router.get('/', authorizeRoles(...allRoles), getWarnings);  // citizens can read warnings
router.get('/:id', authorizeRoles(...allRoles), getWarning);
router.get('/:id/broadcast-status', authorizeRoles('DMC_OFFICER', 'DMC_DUTY_OFFICER'), getBroadcastStatus);
router.patch('/:id/cancel', authorizeRoles('DMC_OFFICER', 'DMC_DUTY_OFFICER'), validateRequest(cancelWarningSchema), cancelWarning);
router.patch('/:id/escalate', authorizeRoles('DMC_OFFICER', 'DMC_DUTY_OFFICER'), validateRequest(escalateWarningSchema), escalateWarning);

export default router;
