import { Router } from 'express';
import { getAllUsers, createUser, updateUser, deleteUser, updateLanguagePreference } from '../controllers/userController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Language preference route - accessible to all authenticated users
router.patch('/me/language', authenticateToken, updateLanguagePreference);

// All other routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

router.get('/', getAllUsers);
router.post('/', createUser);
router.patch('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;












