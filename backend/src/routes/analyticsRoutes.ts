import { Router } from 'express';
import { getAnalytics, exportToExcel, exportToPDF } from '../controllers/analyticsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', getAnalytics);
router.get('/export/excel', exportToExcel);
router.get('/export/pdf', exportToPDF);

export default router;
