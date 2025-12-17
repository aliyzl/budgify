import { Router } from 'express';
import { getDepartments, getMyDepartments, createDepartment, updateDepartment, deleteDepartment } from '../controllers/departmentController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET is available to all authenticated users (for request creation)
// Returns filtered departments based on user role
router.get('/', getDepartments);

// Get departments accessible by current manager
router.get('/my', getMyDepartments);

// Create, update, delete require admin role
router.post('/', requireAdmin, createDepartment);
router.patch('/:id', requireAdmin, updateDepartment);
router.delete('/:id', requireAdmin, deleteDepartment);

export default router;
