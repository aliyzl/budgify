import { Router } from 'express';
import { addComment, getComments } from '../controllers/commentController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.post('/', addComment);
router.get('/:requestId', getComments);

export default router;
