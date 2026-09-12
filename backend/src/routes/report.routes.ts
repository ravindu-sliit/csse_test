import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { authorizeRoles } from '../middleware/authorizeRoles';
import { validateRequest } from '../middleware/validateRequest';
import { submitReportSchema, verifyReportSchema, rejectReportSchema } from '../schemas/report.schema';
import { uploadMiddleware } from '../config/upload';
import {
  submitReport, uploadPhotos, getReports,
  getReport, getMyReports, verifyReport, rejectReport
} from '../controllers/report.controller';

const router = Router();
const officerRoles = ['DMC_OFFICER', 'DMC_DUTY_OFFICER'];

router.use(authenticateToken);

router.post('/', authorizeRoles('CITIZEN'), validateRequest(submitReportSchema), submitReport);
router.post('/upload-photos', authorizeRoles('CITIZEN'), uploadMiddleware.array('photos', 3), uploadPhotos);
router.get('/my-reports', authorizeRoles('CITIZEN'), getMyReports);
router.get('/', authorizeRoles(...officerRoles), getReports);
router.get('/:id', authenticateToken, getReport);
router.patch('/:id/verify', authorizeRoles(...officerRoles), validateRequest(verifyReportSchema), verifyReport);
router.patch('/:id/reject', authorizeRoles(...officerRoles), validateRequest(rejectReportSchema), rejectReport);

export default router;