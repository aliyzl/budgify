import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import bot from '../services/telegramBot';
import { encrypt, decrypt } from '../utils/encryption';
import path from 'path';

// Helper to check budget
const checkBudget = async (departmentId: number, newCost: number) => {
    const department = await prisma.department.findUnique({
        where: { id: departmentId },
        include: { requests: true }
    });
    if (!department) return false;

    // Sum cost of all ACTIVE or APPROVED requests
    const currentUsage = department.requests
        .filter((r: any) => ['ACTIVE', 'APPROVED'].includes(r.status))
        .reduce((sum: number, r: any) => sum + Number(r.cost), 0);

    return (currentUsage + newCost) <= Number(department.monthlyBudget);
};

const createRequestSchema = z.object({
    platformName: z.string(),
    cost: z.number().positive(),
    currency: z.string().default('USD'),
    departmentId: z.number(),
    paymentFrequency: z.enum(['MONTHLY', 'YEARLY', 'ONE_TIME']).default('MONTHLY'),
    // Optional fields
    planType: z.string().optional(),
    url: z.string().url().optional(),
});

import { notifyNewRequest } from '../services/telegramBot';

export const createRequest = async (req: Request, res: Response) => {
    try {
        // Parse FormData - convert strings to numbers
        const parsedBody: any = { ...req.body };
        if (parsedBody.cost) {
            parsedBody.cost = parseFloat(parsedBody.cost);
        }
        if (parsedBody.departmentId) {
            parsedBody.departmentId = parseInt(parsedBody.departmentId);
        }
        
        const data = createRequestSchema.parse(parsedBody);
        const userId = (req as any).user.userId; // Auth middleware adds this
        const file = (req as any).file;

        // Fetch user name for notification
        const user = await prisma.user.findUnique({ where: { id: userId } });

        // Check if manager has access to this department
        if (user?.role === 'MANAGER') {
            const hasAccess = await prisma.managerDepartment.findFirst({
                where: {
                    managerId: userId,
                    departmentId: data.departmentId,
                },
            });
            
            if (!hasAccess) {
                return res.status(403).json({ error: 'You do not have access to this department' });
            }
        }

        // Budget check
        const isBudgetOk = await checkBudget(data.departmentId, data.cost);

        // Handle file upload
        let attachmentUrl = null;
        if (file) {
            // Store relative path for serving
            attachmentUrl = `/uploads/${file.filename}`;
        }

        const newRequest = await prisma.request.create({
            data: {
                ...data,
                requesterId: userId,
                status: 'PENDING',
                attachmentUrl,
            },
        });

        // Trigger Telegram Notification to Accountant
        if (user) {
            console.log(`[Request] Creating request #${newRequest.id}, triggering Telegram notification...`);
            try {
                await notifyNewRequest(newRequest, user.name, file ? path.join(__dirname, '../../uploads', file.filename) : null);
                console.log(`[Request] Telegram notification triggered for request #${newRequest.id}`);
            } catch (notifyError: any) {
                console.error(`[Request] Failed to send Telegram notification:`, notifyError?.message || notifyError);
                // Don't fail the request creation if notification fails
            }
        }

        res.status(201).json({ request: newRequest, budgetWarning: !isBudgetOk });
    } catch (error: any) {
        console.error('Error creating request:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ 
                error: 'Invalid input', 
                details: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
            });
        }
        res.status(400).json({ error: error.message || 'Invalid input' });
    }
};

export const getRequests = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const role = (req as any).user.role;

        let where = {};
        if (role === 'MANAGER') {
            where = { requesterId: userId };
        }
        // Accountant/Admin sees all

        const requests = await prisma.request.findMany({
            where,
            include: {
                requester: { select: { name: true, email: true } },
                department: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getRequestById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.userId;
        const role = (req as any).user.role;

        const request = await prisma.request.findUnique({
            where: { id: Number(id) },
            include: {
                requester: { select: { name: true, email: true, id: true } },
                department: { select: { name: true, monthlyBudget: true } },
                comments: {
                    include: {
                        user: { select: { name: true, role: true, id: true } }
                    },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Check access: Managers can only see their own requests
        if (role === 'MANAGER' && request.requesterId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        res.json(request);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateRequestStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason, cost } = req.body;
        const role = (req as any).user.role;

        if (role !== 'ACCOUNTANT' && role !== 'ADMIN') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const updateData: any = { status };
        if (status === 'REJECTED') updateData.rejectionReason = rejectionReason;
        if (status === 'APPROVED' && cost) updateData.cost = cost;

        const request = await prisma.request.update({
            where: { id: Number(id) },
            data: updateData,
            include: { requester: true, department: { select: { name: true } } }
        });

        // Notify Manager via Telegram
        if (request.requester.telegramChatId) {
            let msg = '';
            if (status === 'APPROVED') {
                msg = `✅ *Request #${id} Approved*\n\n` +
                      `*Platform:* ${request.platformName}\n` +
                      `*Final Cost:* ${request.currency} ${request.cost}\n` +
                      `*Department:* ${request.department?.name || 'N/A'}\n\n` +
                      `Your request has been approved and is now active.`;
            } else if (status === 'REJECTED') {
                msg = `❌ *Request #${id} Rejected*\n\n` +
                      `*Platform:* ${request.platformName}\n` +
                      `*Reason:* ${request.rejectionReason || 'No reason provided'}\n\n` +
                      `Please review and submit a new request if needed.`;
            } else if (status === 'ACTIVE') {
                msg = `🟢 *Request #${id} Activated*\n\n` +
                      `*Platform:* ${request.platformName}\n` +
                      `*Cost:* ${request.currency} ${request.cost}\n` +
                      `*Department:* ${request.department?.name || 'N/A'}\n\n` +
                      `Your subscription is now active.`;
            }

            if (msg) {
                await bot.telegram.sendMessage(request.requester.telegramChatId, msg, { parse_mode: 'Markdown' });
            }
        }

        res.json(request);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Failed to update request' });
    }
};

export const updateRequestCredentials = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { credentials } = req.body;
        const role = (req as any).user.role;
        const userId = (req as any).user.userId;

        // Only accountants and admins can add credentials
        if (role !== 'ACCOUNTANT' && role !== 'ADMIN') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (!credentials || typeof credentials !== 'string') {
            return res.status(400).json({ error: 'Credentials are required' });
        }

        // Encrypt credentials before storing
        const encryptedCredentials = encrypt(credentials);

        const request = await prisma.request.update({
            where: { id: Number(id) },
            data: { credentialVault: encryptedCredentials },
            include: { requester: true }
        });

        // Notify the manager that credentials are available
        if (request.requester.telegramChatId) {
            await bot.telegram.sendMessage(
                request.requester.telegramChatId,
                `🔐 *Credentials Added*\n\nCredentials for Request #${id} (${request.platformName}) have been securely stored. You can view them in the app.`,
                { parse_mode: 'Markdown' }
            );
        }

        res.json({ message: 'Credentials updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Failed to update credentials' });
    }
};

export const updateRequestPaymentInfo = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { exchangeRate, localCost, paymentCardId } = req.body;
        const role = (req as any).user.role;

        // Only accountants and admins can update payment info
        if (role !== 'ACCOUNTANT' && role !== 'ADMIN') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const updateData: any = {};
        if (exchangeRate !== undefined) updateData.exchangeRate = exchangeRate;
        if (localCost !== undefined) updateData.localCost = localCost;
        if (paymentCardId !== undefined) updateData.paymentCardId = paymentCardId;

        const request = await prisma.request.update({
            where: { id: Number(id) },
            data: updateData,
            include: { requester: true }
        });

        // Notify manager when payment info is updated
        if (request.requester.telegramChatId) {
            let updateMsg = `💳 *Payment Info Updated*\n\nRequest #${id} (${request.platformName})\n`;
            if (exchangeRate !== undefined) updateMsg += `Exchange Rate: ${exchangeRate}\n`;
            if (localCost !== undefined) updateMsg += `Local Cost: ${localCost}\n`;
            if (paymentCardId !== undefined) updateMsg += `Payment Card: ${paymentCardId}\n`;
            
            await bot.telegram.sendMessage(
                request.requester.telegramChatId,
                updateMsg,
                { parse_mode: 'Markdown' }
            );
        }

        res.json(request);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Failed to update payment info' });
    }
};

export const getRequestCredentials = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.userId;
        const role = (req as any).user.role;

        const request = await prisma.request.findUnique({
            where: { id: Number(id) },
            include: { requester: true }
        });

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Only the requesting manager can view credentials
        if (role === 'MANAGER' && request.requesterId !== userId) {
            return res.status(403).json({ error: 'Unauthorized - You can only view credentials for your own requests' });
        }

        // Admins and accountants can also view
        if (role !== 'MANAGER' && role !== 'ADMIN' && role !== 'ACCOUNTANT') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (!request.credentialVault) {
            return res.status(404).json({ error: 'No credentials stored for this request' });
        }

        // Decrypt credentials
        try {
            const decrypted = decrypt(request.credentialVault);
            res.json({ credentials: decrypted });
        } catch (error) {
            console.error('Decryption error:', error);
            res.status(500).json({ error: 'Failed to decrypt credentials' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
