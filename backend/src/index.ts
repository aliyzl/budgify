import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';

dotenv.config();

import authRoutes from './routes/authRoutes';
import requestRoutes from './routes/requestRoutes';
import botRoutes from './routes/botRoutes';
import departmentRoutes from './routes/departmentRoutes';
import commentRoutes from './routes/commentRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import userRoutes from './routes/userRoutes';
import { initCronJobs } from './services/cronService';
import bot from './services/telegramBot';

const app = express();
const port = process.env.PORT || 3000;

// Start Cron
initCronJobs();

app.use(cors());
app.use(express.json());

// Start Telegram Bot (polling mode for development) - non-blocking
if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN !== 'dummy_token') {
    console.log('Initializing Telegram bot...');
    // Launch bot asynchronously without blocking server startup
    // bot.launch() starts polling and runs indefinitely, so we don't await it
    setImmediate(async () => {
        try {
            // Verify bot token is valid first
            const botInfo = await bot.telegram.getMe();
            console.log(`✅ Telegram bot token verified - Bot: @${botInfo.username}`);
            
            // Import setBotReady
            const { setBotReady } = await import('./services/telegramBot');
            
            // Set bot as ready immediately - bot can send messages even while launch() is running
            setBotReady(true);
            console.log('Telegram bot marked as ready');
            
            // Launch bot (this starts polling and runs indefinitely)
            console.log('Starting Telegram bot polling...');
            bot.launch()
                .then(() => {
                    console.log('✅ Telegram bot polling started successfully');
                    console.log('Bot is now listening for updates (messages, callbacks, etc.)');
                })
                .catch((error: any) => {
                    console.error('❌ Failed to start Telegram bot polling:', error?.message || error);
                    console.error('Bot error stack:', error?.stack);
                    setBotReady(false);
                });
            
            // Add error handler for bot
            bot.catch((err: any, ctx: any) => {
                console.error(`[Telegram] Bot error occurred:`, err?.message || err);
                console.error(`[Telegram] Error context:`, {
                    updateType: ctx?.updateType,
                    userId: ctx?.from?.id,
                    username: ctx?.from?.username,
                    callbackData: ctx?.callbackQuery?.data
                });
            });
        } catch (error: any) {
            console.error('❌ Failed to verify Telegram bot token:', error?.message || error);
        }
    });
} else {
    console.log('⚠️ Telegram bot token not configured, skipping bot initialization');
}

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/auth', authRoutes);
app.use('/requests', requestRoutes);
app.use('/bot', botRoutes);
app.use('/departments', departmentRoutes);
app.use('/comments', commentRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/users', userRoutes);

app.get('/', (req, res) => {
    res.send('Corporate Subscription Manager API');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
