import { Router } from 'express';
import bot from '../services/telegramBot';

const router = Router();

// Webhook endpoint
router.post('/webhook', (req, res) => {
    bot.handleUpdate(req.body, res);
});

export default router;
