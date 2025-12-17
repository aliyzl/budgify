import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';

const createDepartmentSchema = z.object({
    name: z.string().min(1, 'Department name is required'),
    monthlyBudget: z.number().positive('Monthly budget must be a positive number'),
    currentManagerId: z.number().int().positive().optional().nullable(),
    managerIds: z.array(z.number().int().positive()).optional(),
});

const updateDepartmentSchema = z.object({
    name: z.string().min(1).optional(),
    monthlyBudget: z.number().positive().optional(),
    currentManagerId: z.number().int().positive().optional().nullable(),
    managerIds: z.array(z.number().int().positive()).optional(),
});

export const getDepartments = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        
        // If user is a manager, only return departments they have access to
        if (user.role === 'MANAGER') {
            const managerDepartments = await prisma.managerDepartment.findMany({
                where: { managerId: user.userId },
                include: {
                    department: {
                        include: {
                            manager: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                },
                            },
                            managerDepartments: {
                                include: {
                                    manager: {
                                        select: {
                                            id: true,
                                            name: true,
                                            email: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });
            
            const departments = managerDepartments.map(md => ({
                id: md.department.id,
                name: md.department.name,
                monthlyBudget: md.department.monthlyBudget,
                currentManagerId: md.department.currentManagerId,
                manager: md.department.manager,
                managers: md.department.managerDepartments.map(md2 => md2.manager),
            }));
            
            return res.json(departments);
        }
        
        // Admin and Accountant see all departments
        const departments = await prisma.department.findMany({
            select: {
                id: true,
                name: true,
                monthlyBudget: true,
                currentManagerId: true,
                manager: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                managerDepartments: {
                    include: {
                        manager: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                name: 'asc',
            },
        });
        
        const formattedDepartments = departments.map(dept => ({
            id: dept.id,
            name: dept.name,
            monthlyBudget: dept.monthlyBudget,
            currentManagerId: dept.currentManagerId,
            manager: dept.manager,
            managers: dept.managerDepartments.map(md => md.manager),
        }));
        
        res.json(formattedDepartments);
    } catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).json({ error: 'Failed to fetch departments' });
    }
};

export const getMyDepartments = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        
        if (!user || user.role !== 'MANAGER') {
            return res.status(403).json({ error: 'Only managers can access this endpoint' });
        }
        
        const managerDepartments = await prisma.managerDepartment.findMany({
            where: { managerId: userId },
            include: {
                department: {
                    include: {
                        manager: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
            },
        });
        
        const departments = managerDepartments.map(md => ({
            id: md.department.id,
            name: md.department.name,
            monthlyBudget: md.department.monthlyBudget,
            currentManagerId: md.department.currentManagerId,
            manager: md.department.manager,
        }));
        
        res.json(departments);
    } catch (error) {
        console.error('Error fetching my departments:', error);
        res.status(500).json({ error: 'Failed to fetch departments' });
    }
};

export const createDepartment = async (req: Request, res: Response) => {
    try {
        const data = createDepartmentSchema.parse(req.body);

        // Validate manager if provided
        if (data.currentManagerId) {
            const manager = await prisma.user.findUnique({
                where: { id: data.currentManagerId },
            });

            if (!manager) {
                return res.status(404).json({ error: 'Manager not found' });
            }

            if (manager.role !== 'MANAGER') {
                return res.status(400).json({ error: 'Assigned user must have MANAGER role' });
            }
        }

        // Validate all managers if provided
        const managerIds = data.managerIds || (data.currentManagerId ? [data.currentManagerId] : []);
        if (managerIds.length > 0) {
            for (const managerId of managerIds) {
                const manager = await prisma.user.findUnique({
                    where: { id: managerId },
                });

                if (!manager) {
                    return res.status(404).json({ error: `Manager with ID ${managerId} not found` });
                }

                if (manager.role !== 'MANAGER') {
                    return res.status(400).json({ error: `User with ID ${managerId} must have MANAGER role` });
                }
            }
        }

        // Create department
        const department = await prisma.department.create({
            data: {
                name: data.name,
                monthlyBudget: data.monthlyBudget,
                currentManagerId: data.currentManagerId || (managerIds.length > 0 ? managerIds[0] : null),
                managerDepartments: managerIds.length > 0 ? {
                    create: managerIds.map(managerId => ({
                        managerId,
                    })),
                } : undefined,
            },
            include: {
                manager: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                managerDepartments: {
                    include: {
                        manager: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
            },
        });

        // Log audit
        const actorId = (req as any).user.userId;
        await prisma.auditLog.create({
            data: {
                actionType: 'DEPARTMENT_CREATED',
                targetId: department.id.toString(),
                actorId,
            },
        });

        const formattedDepartment = {
            id: department.id,
            name: department.name,
            monthlyBudget: department.monthlyBudget,
            currentManagerId: department.currentManagerId,
            manager: department.manager,
            managers: department.managerDepartments.map(md => md.manager),
        };

        res.status(201).json(formattedDepartment);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.issues });
        }
        console.error('Error creating department:', error);
        res.status(500).json({ error: 'Failed to create department' });
    }
};

export const updateDepartment = async (req: Request, res: Response) => {
    try {
        const departmentId = parseInt(req.params.id);
        const updateData = updateDepartmentSchema.parse(req.body);

        // Check if department exists
        const existingDepartment = await prisma.department.findUnique({
            where: { id: departmentId },
        });

        if (!existingDepartment) {
            return res.status(404).json({ error: 'Department not found' });
        }

        // Handle manager assignments if provided
        let managerIdsToAssign: number[] = [];
        if (updateData.managerIds !== undefined) {
            managerIdsToAssign = updateData.managerIds;
        } else if (updateData.currentManagerId !== undefined && updateData.currentManagerId !== null) {
            // If only currentManagerId is provided, use it as the only manager
            managerIdsToAssign = [updateData.currentManagerId];
        }

        // Validate all managers if provided
        if (managerIdsToAssign.length > 0) {
            for (const managerId of managerIdsToAssign) {
                const manager = await prisma.user.findUnique({
                    where: { id: managerId },
                });

                if (!manager) {
                    return res.status(404).json({ error: `Manager with ID ${managerId} not found` });
                }

                if (manager.role !== 'MANAGER') {
                    return res.status(400).json({ error: `User with ID ${managerId} must have MANAGER role` });
                }
            }
        }

        // Prepare update data (exclude managerIds from direct update)
        const { managerIds, ...updateDataWithoutManagers } = updateData;

        // Update department
        const updatedDepartment = await prisma.department.update({
            where: { id: departmentId },
            data: {
                ...updateDataWithoutManagers,
                // Update currentManagerId if provided, otherwise keep first manager from managerIds
                currentManagerId: updateData.currentManagerId !== undefined 
                    ? updateData.currentManagerId 
                    : (managerIdsToAssign.length > 0 ? managerIdsToAssign[0] : undefined),
            },
            include: {
                manager: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                managerDepartments: {
                    include: {
                        manager: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
            },
        });

        // Update manager assignments if provided
        if (updateData.managerIds !== undefined) {
            // Delete existing assignments
            await prisma.managerDepartment.deleteMany({
                where: { departmentId },
            });

            // Create new assignments
            if (managerIdsToAssign.length > 0) {
                await prisma.managerDepartment.createMany({
                    data: managerIdsToAssign.map(managerId => ({
                        managerId,
                        departmentId,
                    })),
                    skipDuplicates: true,
                });
            }

            // Refresh department with updated managers
            const refreshedDepartment = await prisma.department.findUnique({
                where: { id: departmentId },
                include: {
                    manager: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    managerDepartments: {
                        include: {
                            manager: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                },
                            },
                        },
                    },
                },
            });

            const formattedDepartment = {
                id: refreshedDepartment!.id,
                name: refreshedDepartment!.name,
                monthlyBudget: refreshedDepartment!.monthlyBudget,
                currentManagerId: refreshedDepartment!.currentManagerId,
                manager: refreshedDepartment!.manager,
                managers: refreshedDepartment!.managerDepartments.map(md => md.manager),
            };

            // Log audit
            const actorId = (req as any).user.userId;
            await prisma.auditLog.create({
                data: {
                    actionType: 'DEPARTMENT_UPDATED',
                    targetId: departmentId.toString(),
                    actorId,
                },
            });

            return res.json(formattedDepartment);
        }

        // Log audit
        const actorId = (req as any).user.userId;
        await prisma.auditLog.create({
            data: {
                actionType: 'DEPARTMENT_UPDATED',
                targetId: departmentId.toString(),
                actorId,
            },
        });

        const formattedDepartment = {
            id: updatedDepartment.id,
            name: updatedDepartment.name,
            monthlyBudget: updatedDepartment.monthlyBudget,
            currentManagerId: updatedDepartment.currentManagerId,
            manager: updatedDepartment.manager,
            managers: updatedDepartment.managerDepartments.map(md => md.manager),
        };

        res.json(formattedDepartment);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.issues });
        }
        console.error('Error updating department:', error);
        res.status(500).json({ error: 'Failed to update department' });
    }
};

export const deleteDepartment = async (req: Request, res: Response) => {
    try {
        const departmentId = parseInt(req.params.id);

        // Check if department exists
        const existingDepartment = await prisma.department.findUnique({
            where: { id: departmentId },
            include: {
                requests: true,
            },
        });

        if (!existingDepartment) {
            return res.status(404).json({ error: 'Department not found' });
        }

        // Check if department has requests
        if (existingDepartment.requests.length > 0) {
            return res.status(400).json({
                error: 'Cannot delete department with existing requests',
                requestCount: existingDepartment.requests.length,
            });
        }

        // Delete department
        await prisma.department.delete({
            where: { id: departmentId },
        });

        // Log audit
        const actorId = (req as any).user.userId;
        await prisma.auditLog.create({
            data: {
                actionType: 'DEPARTMENT_DELETED',
                targetId: departmentId.toString(),
                actorId,
            },
        });

        res.json({ message: 'Department deleted successfully' });
    } catch (error) {
        console.error('Error deleting department:', error);
        res.status(500).json({ error: 'Failed to delete department' });
    }
};
