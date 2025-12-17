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

import { notifyNewRequest, notifyRequestEdited, notifyRequestDeleted, notifyBulkRequestDeleted } from '../services/telegramBot';

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

        let where: any = { deletedAt: null }; // Filter out soft-deleted requests
        
        if (role === 'MANAGER') {
            where.requesterId = userId;
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
        console.error('Error fetching requests:', error);
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
                department: { select: { id: true, name: true, monthlyBudget: true } },
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

        // Get current request to check previous status
        const currentRequest = await prisma.request.findUnique({
            where: { id: Number(id) },
            include: { requester: true, department: { select: { name: true } } }
        });

        if (!currentRequest) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const previousStatus = currentRequest.status;

        // Prepare update data
        const updateData: any = { status };
        
        // Handle status-specific fields
        if (status === 'REJECTED') {
            // Require rejection reason when rejecting
            if (!rejectionReason) {
                return res.status(400).json({ error: 'Rejection reason is required' });
            }
            updateData.rejectionReason = rejectionReason;
        } else if (status === 'APPROVED') {
            // Clear rejection reason when approving
            updateData.rejectionReason = null;
            // Update cost if provided
            if (cost !== undefined && cost !== null) {
                updateData.cost = cost;
            }
        } else if (status === 'PENDING') {
            // When resetting to PENDING, clear rejection reason
            updateData.rejectionReason = null;
        }

        const request = await prisma.request.update({
            where: { id: Number(id) },
            data: updateData,
            include: { requester: true, department: { select: { name: true } } }
        });

        // Notify Manager via Telegram
        if (request.requester.telegramChatId) {
            let msg = '';
            const statusChanged = previousStatus !== status;
            
            if (status === 'APPROVED') {
                if (statusChanged && previousStatus === 'REJECTED') {
                    msg = `✅ *Request #${id} Status Changed*\n\n` +
                          `*Platform:* ${request.platformName}\n` +
                          `*Previous Status:* REJECTED\n` +
                          `*New Status:* APPROVED\n` +
                          `*Final Cost:* ${request.currency} ${request.cost}\n` +
                          `*Department:* ${request.department?.name || 'N/A'}\n\n` +
                          `Your request has been approved.`;
                } else {
                    msg = `✅ *Request #${id} Approved*\n\n` +
                          `*Platform:* ${request.platformName}\n` +
                          `*Final Cost:* ${request.currency} ${request.cost}\n` +
                          `*Department:* ${request.department?.name || 'N/A'}\n\n` +
                          `Your request has been approved.`;
                }
            } else if (status === 'REJECTED') {
                if (statusChanged && previousStatus === 'APPROVED') {
                    msg = `❌ *Request #${id} Status Changed*\n\n` +
                          `*Platform:* ${request.platformName}\n` +
                          `*Previous Status:* APPROVED\n` +
                          `*New Status:* REJECTED\n` +
                          `*Reason:* ${request.rejectionReason || 'No reason provided'}\n\n` +
                          `Your request has been rejected.`;
                } else {
                    msg = `❌ *Request #${id} Rejected*\n\n` +
                          `*Platform:* ${request.platformName}\n` +
                          `*Reason:* ${request.rejectionReason || 'No reason provided'}\n\n` +
                          `Please review and submit a new request if needed.`;
                }
            } else if (status === 'PENDING') {
                if (statusChanged) {
                    msg = `🔄 *Request #${id} Status Changed*\n\n` +
                          `*Platform:* ${request.platformName}\n` +
                          `*Previous Status:* ${previousStatus}\n` +
                          `*New Status:* PENDING\n` +
                          `*Department:* ${request.department?.name || 'N/A'}\n\n` +
                          `Your request status has been reset to pending for review.`;
                }
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

const updateRequestSchema = z.object({
    platformName: z.string().optional(),
    cost: z.number().positive().optional(),
    currency: z.string().optional(),
    departmentId: z.number().optional(),
    paymentFrequency: z.enum(['MONTHLY', 'YEARLY', 'ONE_TIME']).optional(),
    planType: z.string().optional(),
    url: z.string().url().optional().nullable(),
});

export const updateRequest = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.userId;
        const role = (req as any).user.role;
        const file = (req as any).file;

        // Only managers can edit requests
        if (role !== 'MANAGER') {
            return res.status(403).json({ error: 'Unauthorized - Only managers can edit requests' });
        }

        // Get current request
        const currentRequest = await prisma.request.findUnique({
            where: { id: Number(id) },
            include: {
                requester: { select: { name: true, id: true } },
                department: { select: { name: true } }
            }
        });

        if (!currentRequest) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Verify request belongs to the manager
        if (currentRequest.requesterId !== userId) {
            return res.status(403).json({ error: 'Unauthorized - You can only edit your own requests' });
        }

        // Verify request status is PENDING
        if (currentRequest.status !== 'PENDING') {
            return res.status(400).json({ error: 'You can only edit requests with PENDING status' });
        }

        // Parse FormData - convert strings to numbers
        const parsedBody: any = { ...req.body };
        if (parsedBody.cost) {
            parsedBody.cost = parseFloat(parsedBody.cost);
        }
        if (parsedBody.departmentId) {
            parsedBody.departmentId = parseInt(parsedBody.departmentId);
        }

        // Validate input
        const data = updateRequestSchema.parse(parsedBody);

        // If departmentId is being changed, verify manager has access to new department
        if (data.departmentId && data.departmentId !== currentRequest.departmentId) {
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

        // Track changed fields for notification
        const changedFields: string[] = [];
        Object.keys(data).forEach(key => {
            if (data[key as keyof typeof data] !== undefined && data[key as keyof typeof data] !== currentRequest[key as keyof typeof currentRequest]) {
                changedFields.push(key);
            }
        });

        // Handle file upload
        let attachmentUrl = currentRequest.attachmentUrl;
        if (file) {
            attachmentUrl = `/uploads/${file.filename}`;
            changedFields.push('attachmentUrl');
        }

        // Prepare update data
        const updateData: any = {
            ...data,
            status: 'PENDING', // Reset to PENDING after edit
            attachmentUrl,
        };

        // Remove undefined values
        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) {
                delete updateData[key];
            }
        });

        // Update request
        const updatedRequest = await prisma.request.update({
            where: { id: Number(id) },
            data: updateData,
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

        // Create audit log
        await prisma.auditLog.create({
            data: {
                actionType: 'REQUEST_EDITED',
                targetId: id.toString(),
                actorId: userId,
            },
        });

        // Notify accountants via Telegram
        try {
            const screenshotPath = file ? path.join(__dirname, '../../uploads', file.filename) : null;
            await notifyRequestEdited(updatedRequest, currentRequest.requester.name, changedFields, screenshotPath);
        } catch (notifyError: any) {
            console.error(`[Request] Failed to send Telegram notification for edit:`, notifyError?.message || notifyError);
            // Don't fail the request update if notification fails
        }

        res.json(updatedRequest);
    } catch (error: any) {
        console.error('Error updating request:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ 
                error: 'Invalid input', 
                details: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
            });
        }
        res.status(400).json({ error: error.message || 'Failed to update request' });
    }
};

export const deleteRequest = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.userId;
        const role = (req as any).user.role;

        // Only managers can delete requests
        if (role !== 'MANAGER') {
            return res.status(403).json({ error: 'Unauthorized - Only managers can delete requests' });
        }

        // Get current request
        const currentRequest = await prisma.request.findUnique({
            where: { id: Number(id) },
            include: {
                requester: { select: { name: true, id: true } },
                department: { select: { name: true } }
            }
        });

        if (!currentRequest) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Verify request belongs to the manager
        if (currentRequest.requesterId !== userId) {
            return res.status(403).json({ error: 'Unauthorized - You can only delete your own requests' });
        }

        // Verify request status is PENDING
        if (currentRequest.status !== 'PENDING') {
            return res.status(400).json({ error: 'You can only delete requests with PENDING status' });
        }

        // Soft delete - set deletedAt timestamp
        await prisma.request.update({
            where: { id: Number(id) },
            data: { deletedAt: new Date() }
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                actionType: 'REQUEST_DELETED',
                targetId: id.toString(),
                actorId: userId,
            },
        });

        // Notify accountants via Telegram
        try {
            await notifyRequestDeleted(
                Number(id),
                currentRequest.platformName,
                currentRequest.requester.name,
                currentRequest.department?.name
            );
        } catch (notifyError: any) {
            console.error(`[Request] Failed to send Telegram notification for delete:`, notifyError?.message || notifyError);
            // Don't fail the request deletion if notification fails
        }

        res.json({ message: 'Request deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting request:', error);
        res.status(400).json({ error: error.message || 'Failed to delete request' });
    }
};

export const bulkDeleteRequests = async (req: Request, res: Response) => {
    try {
        const { requestIds } = req.body;
        const userId = (req as any).user.userId;
        const role = (req as any).user.role;

        // Only managers can bulk delete requests
        if (role !== 'MANAGER') {
            return res.status(403).json({ error: 'Unauthorized - Only managers can bulk delete requests' });
        }

        // Validate input
        if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
            return res.status(400).json({ error: 'requestIds array is required and must not be empty' });
        }

        // Convert to numbers and validate
        const ids = requestIds.map(id => Number(id)).filter(id => !isNaN(id));
        if (ids.length === 0) {
            return res.status(400).json({ error: 'Invalid request IDs provided' });
        }

        // Fetch all requests
        const requests = await prisma.request.findMany({
            where: {
                id: { in: ids },
                deletedAt: null // Only get non-deleted requests
            },
            include: {
                requester: { select: { name: true, id: true } },
                department: { select: { name: true } }
            }
        });

        if (requests.length === 0) {
            return res.status(404).json({ error: 'No valid requests found to delete' });
        }

        // Validate all requests belong to the manager and are PENDING
        const invalidRequests = requests.filter(req => 
            req.requesterId !== userId || req.status !== 'PENDING'
        );

        if (invalidRequests.length > 0) {
            return res.status(403).json({ 
                error: 'Some requests cannot be deleted. You can only delete your own PENDING requests.',
                invalidIds: invalidRequests.map(r => r.id)
            });
        }

        // Get manager name for notification
        const manager = await prisma.user.findUnique({ 
            where: { id: userId },
            select: { name: true }
        });

        // Soft delete all valid requests
        const now = new Date();
        await prisma.request.updateMany({
            where: {
                id: { in: ids },
                requesterId: userId,
                status: 'PENDING',
                deletedAt: null
            },
            data: { deletedAt: now }
        });

        // Create audit log entries for each deletion
        const auditLogs = ids.map(requestId => ({
            actionType: 'REQUEST_DELETED',
            targetId: requestId.toString(),
            actorId: userId,
        }));
        await prisma.auditLog.createMany({
            data: auditLogs
        });

        // Collect deleted request information for notification
        const deletedRequestsInfo = requests.map(req => ({
            id: req.id,
            platformName: req.platformName,
            departmentName: req.department?.name
        }));

        // Send combined Telegram notification
        try {
            if (manager) {
                await notifyBulkRequestDeleted(deletedRequestsInfo, manager.name);
            }
        } catch (notifyError: any) {
            console.error(`[Request] Failed to send Telegram notification for bulk delete:`, notifyError?.message || notifyError);
            // Don't fail the bulk deletion if notification fails
        }

        res.json({ 
            message: `Successfully deleted ${requests.length} request(s)`,
            deletedCount: requests.length,
            deletedIds: ids
        });
    } catch (error: any) {
        console.error('Error bulk deleting requests:', error);
        res.status(400).json({ error: error.message || 'Failed to bulk delete requests' });
    }
};
