import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../utils/prisma';

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string(),
    role: z.enum(['MANAGER']).default('MANAGER'), // Public registration only allows MANAGER role
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, name, role } = registerSchema.parse(req.body);
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: { email, passwordHash: hashedPassword, name, role },
        });

        res.status(201).json({ id: user.id, email: user.email });
    } catch (error) {
        res.status(400).json({ error: 'Invalid input or user already exists (check logs)' });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !await bcrypt.compare(password, user.passwordHash)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET as string, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
    } catch (error) {
        res.status(400).json({ error: 'Invalid input' });
    }
};

import crypto from 'crypto';

export const getTelegramLink = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        // Generate random token
        const token = crypto.randomBytes(16).toString('hex');

        await prisma.user.update({
            where: { id: userId },
            data: { telegramAuthToken: token }
        });

        const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'YourBotName';
        res.json({ link: `https://t.me/${botUsername}?start=${token}` });
    } catch (error) {
        res.status(500).json({ error: 'Could not generate link' });
    }
};
