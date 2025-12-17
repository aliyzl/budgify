import { Router } from 'express';
import { login, register, getTelegramLink } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/telegram-link', authenticateToken, getTelegramLink);

export default router;
