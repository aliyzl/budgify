import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import prisma from '../utils/prisma';

const createUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(1),
    role: z.enum(['MANAGER', 'ACCOUNTANT']), // Only allow MANAGER or ACCOUNTANT, not ADMIN
});

const updateUserSchema = z.object({
    email: z.string().email().optional(),
    name: z.string().min(1).optional(),
    role: z.enum(['MANAGER', 'ACCOUNTANT']).optional(),
    password: z.string().min(6).optional(),
});

export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

export const createUser = async (req: Request, res: Response) => {
    try {
        const { email, password, name, role } = createUserSchema.parse(req.body);

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash: hashedPassword,
                name,
                role,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
            },
        });

        // Log audit
        const actorId = (req as any).user.userId;
        await prisma.auditLog.create({
            data: {
                actionType: 'USER_CREATED',
                targetId: user.id.toString(),
                actorId,
            },
        });

        res.status(201).json(user);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.issues });
        }
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
};

export const updateUser = async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.id);
        const updateData = updateUserSchema.parse(req.body);

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!existingUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // If email is being updated, check for duplicates
        if (updateData.email && updateData.email !== existingUser.email) {
            const emailExists = await prisma.user.findUnique({
                where: { email: updateData.email },
            });
            if (emailExists) {
                return res.status(400).json({ error: 'Email already in use' });
            }
        }

        // Hash password if provided
        const dataToUpdate: any = { ...updateData };
        if (updateData.password) {
            dataToUpdate.passwordHash = await bcrypt.hash(updateData.password, 10);
            delete dataToUpdate.password;
        }

        // Update user
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: dataToUpdate,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        // Log audit
        const actorId = (req as any).user.userId;
        await prisma.auditLog.create({
            data: {
                actionType: 'USER_UPDATED',
                targetId: userId.toString(),
                actorId,
            },
        });

        res.json(updatedUser);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.issues });
        }
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
};

export const deleteUser = async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.id);

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!existingUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prevent deleting yourself
        const actorId = (req as any).user.userId;
        if (userId === actorId) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        // Delete user
        await prisma.user.delete({
            where: { id: userId },
        });

        // Log audit
        await prisma.auditLog.create({
            data: {
                actionType: 'USER_DELETED',
                targetId: userId.toString(),
                actorId,
            },
        });

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
};

const updateLanguagePreferenceSchema = z.object({
    preferredLanguage: z.enum(['en', 'fa']).optional(),
});

export const updateLanguagePreference = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { preferredLanguage } = updateLanguagePreferenceSchema.parse(req.body);

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { preferredLanguage },
            select: {
                id: true,
                preferredLanguage: true,
            },
        });

        res.json(updatedUser);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.issues });
        }
        console.error('Error updating language preference:', error);
        res.status(500).json({ error: 'Failed to update language preference' });
    }
};

