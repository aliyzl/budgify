import cron from 'node-cron';
import prisma from '../utils/prisma';
import bot from './telegramBot';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

// Run every day at 09:00 AM
export const initCronJobs = () => {
    // 1. Subscription Renewals
    cron.schedule('0 9 * * *', async () => {
        console.log('Running daily renewal check...');

        // Check for requests expiring in exactly 5 days
        const fiveDaysFromNow = new Date();
        fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
        // Rough check: Match the date part
        const startOfDay = new Date(fiveDaysFromNow.setHours(0, 0, 0, 0));
        const endOfDay = new Date(fiveDaysFromNow.setHours(23, 59, 59, 999));

        try {
            const expiringRequests = await prisma.request.findMany({
                where: {
                    status: 'ACTIVE',
                    renewalDate: {
                        gte: startOfDay,
                        lte: endOfDay
                    },
                    paymentFrequency: { in: ['MONTHLY', 'YEARLY'] }
                },
                include: { requester: true }
            });

            for (const req of expiringRequests) {
                if (req.requester.telegramChatId) {
                    await bot.telegram.sendMessage(req.requester.telegramChatId,
                        `📅 *Renewal Alert*\n` +
                        `Your subscription for *${req.platformName}* expires in 5 days.\n` +
                        `Do you want to renew it?`,
                        {
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [[
                                    { text: '✅ Yes, Renew', callback_data: `renew_yes_${req.id}` },
                                    { text: '❌ No, Cancel', callback_data: `renew_no_${req.id}` }
                                ]]
                            }
                        }
                    );
                }
            }
        } catch (error) {
            console.error('Error in daily renewal check:', error);
        }
    });

    // 2. Database Backup (Runs daily at 02:00 AM)
    cron.schedule('0 2 * * *', () => {
        console.log('Starting daily database backup...');
        const backupDir = path.join(__dirname, '../../backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup-${timestamp}.sql`;
        const filepath = path.join(backupDir, filename);

        // Assumes DATABASE_URL format: postgresql://user:pass@host:port/db
        // We'll use individual env vars for safety if possible, or parse safely.
        // For now, relying on 'pg_dump' using the connection string or ENV vars.
        // Since we are adding postgresql-client, we can use PGPASSWORD env var + pg_dump.

        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) {
            console.error('DATABASE_URL not found for backup');
            return;
        }

        const command = `pg_dump "${dbUrl}" > "${filepath}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Backup failed: ${error.message}`);
                return;
            }
            if (stderr) {
                // pg_dump often writes to stderr for info, so just log it
                console.log(`Backup process: ${stderr}`);
            }
            console.log(`Backup completed successfully: ${filename}`);
        });
    });
};
