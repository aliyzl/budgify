import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import bot from '../services/telegramBot';

const addCommentSchema = z.object({
    content: z.string().min(1),
    requestId: z.number()
});

export const addComment = async (req: Request, res: Response) => {
    try {
        const { content, requestId } = addCommentSchema.parse(req.body);
        const userId = (req as any).user.userId;
        const userRole = (req as any).user.role;

        const comment = await prisma.requestComment.create({
            data: {
                content,
                requestId,
                userId
            },
            include: {
                user: { select: { name: true, role: true } },
                request: { include: { requester: true } }
            }
        });

        // Notify the other party via Telegram
        const request = comment.request;
        const senderName = comment.user.name;

        if (userRole === 'MANAGER') {
            // Find accountants to notify
            const accountants = await prisma.user.findMany({
                where: { role: 'ACCOUNTANT', telegramChatId: { not: null } }
            });
            for (const acc of accountants) {
                if (acc.telegramChatId) {
                    await bot.telegram.sendMessage(acc.telegramChatId,
                        `💬 *Comment on Request #${request.id}*\n\n` +
                        `*${senderName}:* ${content}`,
                        { parse_mode: 'Markdown' }
                    );
                }
            }
        } else {
            // Accountant commented, notify Manager
            if (request.requester.telegramChatId) {
                await bot.telegram.sendMessage(request.requester.telegramChatId,
                    `💬 *New Comment on Request #${request.id}*\n\n` +
                    `*${senderName}:* ${content}`,
                    { parse_mode: 'Markdown' }
                );
            }
        }

        res.status(201).json(comment);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Failed to add comment' });
    }
};

export const getComments = async (req: Request, res: Response) => {
    try {
        const requestId = Number(req.params.requestId);
        const comments = await prisma.requestComment.findMany({
            where: { requestId },
            include: { user: { select: { name: true, role: true, id: true } } },
            orderBy: { createdAt: 'asc' }
        });
        res.json(comments);
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
};
