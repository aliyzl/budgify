import { Router } from 'express';
import { createRequest, getRequests, updateRequestStatus, getRequestById, updateRequestCredentials, updateRequestPaymentInfo, getRequestCredentials, updateRequest, deleteRequest, bulkDeleteRequests } from '../controllers/requestController';
import { authenticateToken } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.use(authenticateToken); // Protect all routes

router.post('/', upload.single('screenshot'), createRequest);
router.post('/bulk-delete', bulkDeleteRequests);
router.get('/', getRequests);
router.get('/:id', getRequestById);
router.get('/:id/credentials', getRequestCredentials);
router.put('/:id', upload.single('screenshot'), updateRequest);
router.delete('/:id', deleteRequest);
router.patch('/:id/status', updateRequestStatus);
router.patch('/:id/credentials', updateRequestCredentials);
router.patch('/:id/payment', updateRequestPaymentInfo);

export default router;
