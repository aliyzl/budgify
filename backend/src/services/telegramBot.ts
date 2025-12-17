import { Telegraf } from 'telegraf';
import prisma from '../utils/prisma';
import fs from 'fs';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || 'dummy_token');

// Track bot readiness (set externally when bot is launched)
let botReady = false;
export const setBotReady = (ready: boolean) => {
    botReady = ready;
};

// Middleware to log all updates
bot.use(async (ctx, next) => {
    const updateType = ctx.updateType;
    const userId = ctx.from?.id;
    const username = ctx.from?.username;
    
    if (updateType === 'callback_query') {
        const callbackData = (ctx as any).callbackQuery?.data;
        console.log(`[Telegram] Callback query received from user ${userId} (@${username}): ${callbackData}`);
    } else {
        console.log(`[Telegram] Update type: ${updateType} from user ${userId} (@${username})`);
    }
    
    await next();
});

bot.start(async (ctx) => {
    // Payload is passed as /start <payload>
    // Message format: "/start payload"
    const text = ctx.message.text;
    const payload = text.split(' ')[1];

    if (payload) {
        try {
            // Find user with this auth token
            const user = await prisma.user.findFirst({
                where: { telegramAuthToken: payload }
            });

            if (user) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        telegramChatId: ctx.from.id.toString(),
                        telegramAuthToken: null // One-time use
                    }
                });
                await ctx.reply(`Welcome ${user.name}! Your account has been successfully linked.`);
            } else {
                await ctx.reply('Invalid or expired linking token. Please try again from the web dashboard.');
            }
        } catch (e) {
            console.error(e);
            await ctx.reply('An error occurred during linking.');
        }
    } else {
        await ctx.reply('Welcome to Corporate Subscription Manager! Please link your account from the web dashboard to start.');
    }
});

// Action handlers
bot.action(/^approve_(\d+)$/, async (ctx) => {
    const requestId = ctx.match[1];
    const userId = ctx.from?.id;
    const username = ctx.from?.username;
    let callbackAnswered = false;
    
    console.log(`[Telegram] Approve action triggered for request #${requestId} by user ${userId} (@${username})`);
    
    try {
        // Answer callback query immediately to prevent timeout
        try {
            await ctx.answerCbQuery('Processing approval...');
            callbackAnswered = true;
        } catch (cbError: any) {
            console.error(`[Telegram] Failed to answer callback query initially:`, cbError?.message || cbError);
            // Continue anyway - we'll try again in error handler if needed
        }
        
        // Check if user is accountant or admin
        const telegramChatId = ctx.from.id.toString();
        console.log(`[Telegram] Looking up user with telegramChatId: ${telegramChatId}`);
        
        const user = await prisma.user.findUnique({ 
            where: { telegramChatId } 
        });
        
        console.log(`[Telegram] User lookup result:`, user ? { id: user.id, name: user.name, role: user.role } : 'User not found');
        
        if (!user || (user.role !== 'ACCOUNTANT' && user.role !== 'ADMIN')) {
            console.log(`[Telegram] Unauthorized approval attempt by user ${userId} (role: ${user?.role || 'not found'})`);
            if (!callbackAnswered) {
                try {
                    await ctx.answerCbQuery('Only accountants and admins can approve requests.', { show_alert: true });
                } catch (e) {
                    console.error(`[Telegram] Failed to answer callback query:`, e);
                }
            }
            await ctx.reply('❌ Only accountants and admins can approve requests.');
            return;
        }
        
        console.log(`[Telegram] User authorized, requesting final cost for request #${requestId}`);
        await ctx.reply(`Please enter the final cost for Request #${requestId} to confirm approval (or type 'same'):`, {
            reply_markup: { force_reply: true }
        });
    } catch (error: any) {
        console.error(`[Telegram] Error in approve action handler for request #${requestId}:`, error?.message || error);
        if (!callbackAnswered) {
            try {
                await ctx.answerCbQuery('An error occurred. Please try again.', { show_alert: true });
            } catch (cbError) {
                console.error(`[Telegram] Failed to answer callback query in error handler:`, cbError);
            }
        }
        try {
            await ctx.reply('❌ An error occurred while processing your approval request. Please try again.');
        } catch (replyError) {
            console.error(`[Telegram] Failed to send error message:`, replyError);
        }
    }
});

bot.action(/^reject_(\d+)$/, async (ctx) => {
    const requestId = ctx.match[1];
    const userId = ctx.from?.id;
    const username = ctx.from?.username;
    let callbackAnswered = false;
    
    console.log(`[Telegram] Reject action triggered for request #${requestId} by user ${userId} (@${username})`);
    
    try {
        // Answer callback query immediately to prevent timeout
        try {
            await ctx.answerCbQuery('Processing rejection...');
            callbackAnswered = true;
        } catch (cbError: any) {
            console.error(`[Telegram] Failed to answer callback query initially:`, cbError?.message || cbError);
            // Continue anyway - we'll try again in error handler if needed
        }
        
        // Check if user is accountant or admin
        const telegramChatId = ctx.from.id.toString();
        console.log(`[Telegram] Looking up user with telegramChatId: ${telegramChatId}`);
        
        const user = await prisma.user.findUnique({ 
            where: { telegramChatId } 
        });
        
        console.log(`[Telegram] User lookup result:`, user ? { id: user.id, name: user.name, role: user.role } : 'User not found');
        
        if (!user || (user.role !== 'ACCOUNTANT' && user.role !== 'ADMIN')) {
            console.log(`[Telegram] Unauthorized rejection attempt by user ${userId} (role: ${user?.role || 'not found'})`);
            if (!callbackAnswered) {
                try {
                    await ctx.answerCbQuery('Only accountants and admins can reject requests.', { show_alert: true });
                } catch (e) {
                    console.error(`[Telegram] Failed to answer callback query:`, e);
                }
            }
            await ctx.reply('❌ Only accountants and admins can reject requests.');
            return;
        }
        
        console.log(`[Telegram] User authorized, requesting rejection reason for request #${requestId}`);
        await ctx.reply(`Please state the reason for rejecting Request #${requestId}:`, {
            reply_markup: { force_reply: true }
        });
    } catch (error: any) {
        console.error(`[Telegram] Error in reject action handler for request #${requestId}:`, error?.message || error);
        if (!callbackAnswered) {
            try {
                await ctx.answerCbQuery('An error occurred. Please try again.', { show_alert: true });
            } catch (cbError) {
                console.error(`[Telegram] Failed to answer callback query in error handler:`, cbError);
            }
        }
        try {
            await ctx.reply('❌ An error occurred while processing your rejection request. Please try again.');
        } catch (replyError) {
            console.error(`[Telegram] Failed to send error message:`, replyError);
        }
    }
});

// Handle text replies
bot.on('text', async (ctx) => {
    const replyTo = ctx.message.reply_to_message;
    const userId = ctx.from?.id;
    const userMessage = ctx.message.text;
    
    // Check if it's a reply to our prompt
    if (replyTo && 'text' in replyTo) {
        const text = replyTo.text;
        console.log(`[Telegram] Text reply received from user ${userId} in response to: ${text?.substring(0, 50)}...`);

        // Reject Pattern match
        const rejectMatch = text?.match(/rejecting Request #(\d+)/);
        if (rejectMatch) {
            const requestId = Number(rejectMatch[1]);
            console.log(`[Telegram] Processing rejection for request #${requestId} by user ${userId}`);
            
            try {
                // Verify user is accountant or admin
                const sender = await prisma.user.findUnique({ 
                    where: { telegramChatId: ctx.from.id.toString() } 
                });
                
                if (!sender || (sender.role !== 'ACCOUNTANT' && sender.role !== 'ADMIN')) {
                    console.log(`[Telegram] Unauthorized rejection text reply by user ${userId}`);
                    await ctx.reply('❌ You are not authorized to reject requests.');
                    return;
                }
                
                const req = await prisma.request.findUnique({ 
                    where: { id: requestId }, 
                    include: { requester: true, department: { select: { name: true } } } 
                });
                
                if (!req) {
                    console.log(`[Telegram] Request #${requestId} not found for rejection`);
                    await ctx.reply('❌ Request not found.');
                    return;
                }

                await prisma.request.update({
                    where: { id: requestId },
                    data: { status: 'REJECTED', rejectionReason: userMessage }
                });
                console.log(`[Telegram] Request #${requestId} marked as REJECTED by user ${userId}`);
                await ctx.reply(`✅ Request #${requestId} has been marked as REJECTED.`);

                // Notify Manager
                if (req.requester.telegramChatId) {
                    try {
                        await bot.telegram.sendMessage(req.requester.telegramChatId,
                            `❌ *Request #${requestId} Rejected*\n\n` +
                            `*Platform:* ${req.platformName}\n` +
                            `*Department:* ${req.department?.name || 'N/A'}\n` +
                            `*Reason:* ${userMessage}\n\n` +
                            `Please review and submit a new request if needed.`,
                            { parse_mode: 'Markdown' }
                        );
                        console.log(`[Telegram] Rejection notification sent to manager (chatId: ${req.requester.telegramChatId})`);
                    } catch (notifyError: any) {
                        console.error(`[Telegram] Failed to notify manager of rejection:`, notifyError?.message || notifyError);
                    }
                }
            } catch (error: any) {
                console.error(`[Telegram] Error processing rejection for request #${requestId}:`, error?.message || error);
                await ctx.reply('❌ An error occurred while processing the rejection. Please try again.');
            }
            return;
        }

        // Approve Pattern match
        const approveMatch = text?.match(/cost for Request #(\d+)/);
        if (approveMatch) {
            const requestId = Number(approveMatch[1]);
            console.log(`[Telegram] Processing approval for request #${requestId} by user ${userId} with cost: ${userMessage}`);
            
            try {
                // Verify user is accountant or admin
                const sender = await prisma.user.findUnique({ 
                    where: { telegramChatId: ctx.from.id.toString() } 
                });
                
                if (!sender || (sender.role !== 'ACCOUNTANT' && sender.role !== 'ADMIN')) {
                    console.log(`[Telegram] Unauthorized approval text reply by user ${userId}`);
                    await ctx.reply('❌ You are not authorized to approve requests.');
                    return;
                }

                let finalCost;
                if (userMessage.toLowerCase().includes('same')) {
                    const req = await prisma.request.findUnique({ where: { id: requestId } });
                    finalCost = req?.cost;
                    console.log(`[Telegram] Using same cost: ${finalCost}`);
                } else {
                    const parsed = parseFloat(userMessage);
                    if (isNaN(parsed)) {
                        console.log(`[Telegram] Invalid cost number provided: ${userMessage}`);
                        await ctx.reply("❌ Invalid number. Please try approving again.");
                        return;
                    }
                    finalCost = parsed;
                    console.log(`[Telegram] Using new cost: ${finalCost}`);
                }

                const req = await prisma.request.findUnique({ 
                    where: { id: requestId }, 
                    include: { requester: true, department: { select: { name: true } } } 
                });
                
                if (!req) {
                    console.log(`[Telegram] Request #${requestId} not found for approval`);
                    await ctx.reply('❌ Request not found.');
                    return;
                }

                await prisma.request.update({
                    where: { id: requestId },
                    data: { status: 'APPROVED', cost: finalCost }
                });
                console.log(`[Telegram] Request #${requestId} marked as APPROVED by user ${userId} with cost ${finalCost}`);
                await ctx.reply(`✅ Request #${requestId} has been APPROVED.`);

                // Notify Manager
                if (req.requester.telegramChatId) {
                    try {
                        await bot.telegram.sendMessage(req.requester.telegramChatId,
                            `✅ *Request #${requestId} Approved*\n\n` +
                            `*Platform:* ${req.platformName}\n` +
                            `*Final Cost:* ${req.currency} ${finalCost}\n` +
                            `*Department:* ${req.department?.name || 'N/A'}\n\n` +
                            `Your request has been approved and is now active.`,
                            { parse_mode: 'Markdown' }
                        );
                        console.log(`[Telegram] Approval notification sent to manager (chatId: ${req.requester.telegramChatId})`);
                    } catch (notifyError: any) {
                        console.error(`[Telegram] Failed to notify manager of approval:`, notifyError?.message || notifyError);
                    }
                }
            } catch (error: any) {
                console.error(`[Telegram] Error processing approval for request #${requestId}:`, error?.message || error);
                await ctx.reply('❌ An error occurred while processing the approval. Please try again.');
            }
            return;
        }
        // Generic Comment Handling (if not approve/reject)
        const requestIdMatch = text?.match(/Request #(\d+)/);
        if (requestIdMatch) {
            const requestId = Number(requestIdMatch[1]);
            console.log(`[Telegram] Processing comment for request #${requestId} by user ${userId}`);

            try {
                // 1. Save Comment to DB
                // Need to find User ID from Telegram ID
                const sender = await prisma.user.findUnique({ where: { telegramChatId: ctx.from.id.toString() } });

                if (sender) {
                    await prisma.requestComment.create({
                        data: {
                            content: userMessage,
                            requestId,
                            userId: sender.id
                        }
                    });
                    console.log(`[Telegram] Comment saved for request #${requestId} by user ${userId}`);
                    await ctx.reply('✅ Comment saved.');

                    // 2. Notify Other Party
                    const request = await prisma.request.findUnique({ where: { id: requestId }, include: { requester: true } });
                    if (request) {
                        // If Sender is Accountant -> Notify Manager
                        if (sender.role === 'ACCOUNTANT' || sender.role === 'ADMIN') {
                            if (request.requester.telegramChatId) {
                                try {
                                    await bot.telegram.sendMessage(request.requester.telegramChatId,
                                        `💬 *New Comment on Request #${requestId}*\n\n*${sender.name}:* ${userMessage}`,
                                        { parse_mode: 'Markdown' }
                                    );
                                    console.log(`[Telegram] Comment notification sent to manager (chatId: ${request.requester.telegramChatId})`);
                                } catch (notifyError: any) {
                                    console.error(`[Telegram] Failed to notify manager of comment:`, notifyError?.message || notifyError);
                                }
                            }
                        } else {
                            // If Sender is Manager (Requester) -> Notify Accountants
                            const accountants = await prisma.user.findMany({
                                where: { role: 'ACCOUNTANT', telegramChatId: { not: null } }
                            });
                            for (const acc of accountants) {
                                if (acc.telegramChatId && acc.telegramChatId !== ctx.from.id.toString()) { // Don't echo to self
                                    try {
                                        await bot.telegram.sendMessage(acc.telegramChatId,
                                            `💬 *New Comment on Request #${requestId}*\n\n*${sender.name} (Manager):* ${userMessage}`,
                                            { parse_mode: 'Markdown' }
                                        );
                                        console.log(`[Telegram] Comment notification sent to accountant (chatId: ${acc.telegramChatId})`);
                                    } catch (notifyError: any) {
                                        console.error(`[Telegram] Failed to notify accountant of comment:`, notifyError?.message || notifyError);
                                    }
                                }
                            }
                        }
                    }
                } else {
                    console.log(`[Telegram] User ${userId} not found in database for comment`);
                    await ctx.reply('❌ User not found. Please link your Telegram account first.');
                }
            } catch (error: any) {
                console.error(`[Telegram] Error processing comment for request #${requestId}:`, error?.message || error);
                await ctx.reply('❌ An error occurred while saving the comment. Please try again.');
            }
            return;
        }
    }
});

bot.action(/^renew_yes_(\d+)$/, async (ctx) => {
    const requestId = Number(ctx.match[1]);
    await ctx.answerCbQuery('Processing renewal...');

    try {
        const originalReq = await prisma.request.findUnique({ where: { id: requestId } });
        if (originalReq) {
            // Clone request
            const { id, createdAt, updatedAt, status, ...data } = originalReq;
            const newRequest = await prisma.request.create({
                data: {
                    ...data,
                    status: 'PENDING', // Needs approval again
                    planType: (data.planType || '') + ' (Renewal)',
                }
            });

            await ctx.reply(`Renewal request created (ID: ${newRequest.id}). Sent to Accountant for approval.`);

            // Notify Accountant
            // Need to fetch requester name
            const requester = await prisma.user.findUnique({ where: { id: originalReq.requesterId } });
            if (requester) {
                await notifyNewRequest(newRequest, requester.name);
            }
        }
    } catch (e) {
        console.error(e);
        await ctx.reply('Failed to create renewal request.');
    }
});

bot.action(/^renew_no_(\d+)$/, async (ctx) => {
    const requestId = Number(ctx.match[1]);
    await prisma.request.update({
        where: { id: requestId },
        data: { status: 'EXPIRED' }
        // Logic says "Will Expire", but effectively we can mark it or just let it die. 
        // PRD says: "System marks status Will Expire. Admin/Accountant can see this in logs, but no notification is sent."
    });
    await ctx.reply('Subscription marked to expire. No renewal request created.');
    await ctx.answerCbQuery();
});

export const notifyNewRequest = async (request: any, requesterName: string, screenshotPath?: string | null) => {
    try {
        console.log(`[Telegram] Notifying about new request #${request.id} from ${requesterName}`);
        
        // Check if bot is ready (give it a moment if not)
        if (!botReady) {
            console.log('[Telegram] Bot not ready yet, waiting 2 seconds...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Try to verify bot is working
            try {
                await bot.telegram.getMe();
                botReady = true;
                console.log('[Telegram] Bot verified and ready');
            } catch (e) {
                console.error('[Telegram] Bot verification failed:', e);
                // Continue anyway - bot might still work
            }
        }
        
        // Find all accountants and admins with telegramChatId
        const accountants = await prisma.user.findMany({
            where: { 
                role: { in: ['ACCOUNTANT', 'ADMIN'] },
                telegramChatId: { not: null } 
            }
        });
        
        console.log(`[Telegram] Found ${accountants.length} accountant(s)/admin(s) with Telegram linked`);
        
        if (accountants.length === 0) {
            console.log('[Telegram] No accountants/admins with linked Telegram accounts found. Skipping notification.');
            return;
        }

        // Get department name for better context
        const department = await prisma.department.findUnique({
            where: { id: request.departmentId },
            select: { name: true }
        });

        const messageText = `🚨 *New Purchase Request*\n\n` +
            `*Platform:* ${request.platformName}\n` +
            (request.planType ? `*Plan:* ${request.planType}\n` : '') +
            `*Cost:* ${request.currency} ${request.cost}\n` +
            `*Department:* ${department?.name || 'N/A'}\n` +
            `*User:* ${requesterName}\n` +
            `*Frequency:* ${request.paymentFrequency}\n` +
            `*Request ID:* #${request.id}`;

        // Build keyboard - only include View Details if FRONTEND_URL is a public URL (not localhost)
        const frontendUrl = process.env.FRONTEND_URL || '';
        const isPublicUrl = frontendUrl && !frontendUrl.includes('localhost') && !frontendUrl.includes('127.0.0.1');
        
        const keyboard: any = {
            inline_keyboard: [
                [
                    { text: '✅ Approve', callback_data: `approve_${request.id}` },
                    { text: '❌ Reject', callback_data: `reject_${request.id}` }
                ]
            ]
        };
        
        // Only add View Details button if URL is public (Telegram doesn't allow localhost URLs)
        if (isPublicUrl) {
            keyboard.inline_keyboard.push([
                { text: '🔍 View Details', url: `${frontendUrl}/requests/${request.id}` }
            ]);
        }

        for (const acc of accountants) {
            if (acc.telegramChatId) {
                try {
                    console.log(`[Telegram] Sending notification to ${acc.name} (${acc.role}) - Chat ID: ${acc.telegramChatId}`);
                    
                    // If screenshot exists, send it with caption
                    if (screenshotPath) {
                        try {
                            if (fs.existsSync(screenshotPath)) {
                                await bot.telegram.sendPhoto(
                                    acc.telegramChatId,
                                    { source: screenshotPath },
                                    {
                                        caption: messageText,
                                        parse_mode: 'Markdown',
                                        reply_markup: keyboard
                                    }
                                );
                                console.log(`[Telegram] Photo notification sent to ${acc.name}`);
                            } else {
                                // Fallback to text message if file doesn't exist
                                await bot.telegram.sendMessage(acc.telegramChatId, messageText, {
                                    parse_mode: 'Markdown',
                                    reply_markup: keyboard
                                });
                                console.log(`[Telegram] Text notification sent to ${acc.name} (screenshot not found)`);
                            }
                        } catch (photoError) {
                            console.error(`[Telegram] Error sending photo to ${acc.name}, falling back to text:`, photoError);
                            await bot.telegram.sendMessage(acc.telegramChatId, messageText, {
                                parse_mode: 'Markdown',
                                reply_markup: keyboard
                            });
                            console.log(`[Telegram] Text notification sent to ${acc.name} (fallback)`);
                        }
                    } else {
                        // No screenshot, send text message
                        await bot.telegram.sendMessage(acc.telegramChatId, messageText, {
                            parse_mode: 'Markdown',
                            reply_markup: keyboard
                        });
                        console.log(`[Telegram] Text notification sent to ${acc.name}`);
                    }
                } catch (error: any) {
                    console.error(`[Telegram] Failed to send notification to ${acc.name}:`, error?.message || error);
                }
            }
        }
        
        console.log(`[Telegram] Finished sending notifications for request #${request.id}`);
    } catch (error) {
        console.error('Failed to send telegram notification', error);
    }
};

export default bot;
