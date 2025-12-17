import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import ExcelJS from 'exceljs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

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

export const getDepartmentBudgets = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const role = (req as any).user.role;
        
        // Allow MANAGER, ADMIN, and ACCOUNTANT to access this endpoint
        if (role !== 'MANAGER' && role !== 'ADMIN' && role !== 'ACCOUNTANT') {
            return res.status(403).json({ error: 'Only managers, admins, and accountants can access department budgets' });
        }

        // Get date range from query parameters
        const { startDate, endDate } = req.query;
        
        let dateStart: Date | null = null;
        let dateEnd: Date | null = null;

        if (startDate && endDate) {
            dateStart = new Date(startDate as string);
            dateEnd = new Date(endDate as string);
            // Set to end of day
            dateEnd.setHours(23, 59, 59, 999);
        }

        let departments: any[] = [];

        // For managers, get only departments they have access to
        if (role === 'MANAGER') {
            const managerDepartments = await prisma.managerDepartment.findMany({
                where: { managerId: userId },
                include: {
                    department: {
                        include: {
                        requests: {
                            where: {
                                status: { in: ['ACTIVE', 'APPROVED'] }
                            }
                        }
                        }
                    }
                }
            });
            departments = managerDepartments.map(md => md.department);
        } else {
            // For ADMIN and ACCOUNTANT, get all departments
            const allDepartments = await prisma.department.findMany({
                include: {
                        requests: {
                            where: {
                                status: { in: ['ACTIVE', 'APPROVED'] }
                            }
                        }
                }
            });
            departments = allDepartments;
        }

        const budgetData = await Promise.all(
            departments.map(async (department) => {
                const totalBudget = Number(department.monthlyBudget);

                // Filter requests by date range if provided
                let relevantRequests = department.requests;
                
                if (dateStart && dateEnd) {
                    relevantRequests = department.requests.filter((req: any) => {
                        // Check if request was active during the date range
                        const reqStartDate = req.startDate ? new Date(req.startDate) : new Date(req.createdAt);
                        const reqRenewalDate = req.renewalDate ? new Date(req.renewalDate) : null;
                        
                        // Request is active if:
                        // 1. startDate is within range, OR
                        // 2. renewalDate is within range, OR
                        // 3. request spans the entire range (startDate < rangeStart && renewalDate > rangeEnd)
                        return (
                            (reqStartDate >= dateStart && reqStartDate <= dateEnd) ||
                            (reqRenewalDate && reqRenewalDate >= dateStart && reqRenewalDate <= dateEnd) ||
                            (reqStartDate <= dateStart && reqRenewalDate && reqRenewalDate >= dateEnd) ||
                            (reqStartDate <= dateStart && !reqRenewalDate)
                        );
                    });
                }

                // Calculate spent budget (normalize by payment frequency)
                const spentBudget = relevantRequests.reduce((sum: number, req: any) => {
                    let cost = Number(req.cost);
                    
                    // Normalize cost based on payment frequency
                    if (req.paymentFrequency === 'YEARLY') {
                        cost = cost / 12; // Monthly equivalent
                    } else if (req.paymentFrequency === 'ONE_TIME') {
                        // For one-time payments, only count if within date range
                        if (dateStart && dateEnd) {
                            const reqDate = req.startDate ? new Date(req.startDate) : new Date(req.createdAt);
                            if (reqDate < dateStart || reqDate > dateEnd) {
                                return sum; // Don't count if outside range
                            }
                        }
                    }
                    // MONTHLY payments are counted as-is
                    
                    return sum + cost;
                }, 0);

                const remainingBudget = totalBudget - spentBudget;
                const budgetUsagePercentage = totalBudget > 0 ? (spentBudget / totalBudget) * 100 : 0;

                // Format active requests for response
                const activeRequests = relevantRequests.map((req: any) => ({
                    id: req.id,
                    platformName: req.platformName,
                    cost: Number(req.cost),
                    currency: req.currency,
                    status: req.status,
                    startDate: req.startDate,
                    renewalDate: req.renewalDate,
                    paymentFrequency: req.paymentFrequency,
                    createdAt: req.createdAt,
                }));

                return {
                    id: department.id,
                    name: department.name,
                    totalBudget,
                    spentBudget: Math.round(spentBudget * 100) / 100, // Round to 2 decimal places
                    remainingBudget: Math.round(remainingBudget * 100) / 100,
                    budgetUsagePercentage: Math.round(budgetUsagePercentage * 100) / 100,
                    activeRequests,
                };
            })
        );

        res.json({ departments: budgetData });
    } catch (error) {
        console.error('Error fetching department budgets:', error);
        res.status(500).json({ error: 'Failed to fetch department budgets' });
    }
};

// Helper function to fetch budget data (reused by export functions)
const fetchBudgetData = async (userId: number, role: string, dateStart: Date | null, dateEnd: Date | null) => {
    let departments: any[] = [];

    // For managers, get only departments they have access to
    if (role === 'MANAGER') {
        const managerDepartments = await prisma.managerDepartment.findMany({
            where: { managerId: userId },
            include: {
                department: {
                    include: {
                        requests: {
                            where: {
                                status: { in: ['ACTIVE', 'APPROVED'] }
                            }
                        }
                    }
                }
            }
        });
        departments = managerDepartments.map(md => md.department);
    } else {
        // For ADMIN and ACCOUNTANT, get all departments
        const allDepartments = await prisma.department.findMany({
            include: {
                        requests: {
                            where: {
                                status: { in: ['ACTIVE', 'APPROVED'] }
                            }
                        }
            }
        });
        departments = allDepartments;
    }

    const budgetData = await Promise.all(
        departments.map(async (department) => {
            const totalBudget = Number(department.monthlyBudget);

            // Filter requests by date range if provided
            let relevantRequests = department.requests;
            
            if (dateStart && dateEnd) {
                relevantRequests = department.requests.filter((req: any) => {
                    const reqStartDate = req.startDate ? new Date(req.startDate) : new Date(req.createdAt);
                    const reqRenewalDate = req.renewalDate ? new Date(req.renewalDate) : null;
                    
                    return (
                        (reqStartDate >= dateStart && reqStartDate <= dateEnd) ||
                        (reqRenewalDate && reqRenewalDate >= dateStart && reqRenewalDate <= dateEnd) ||
                        (reqStartDate <= dateStart && reqRenewalDate && reqRenewalDate >= dateEnd) ||
                        (reqStartDate <= dateStart && !reqRenewalDate)
                    );
                });
            }

            // Calculate spent budget (normalize by payment frequency)
            // Only count ACTIVE requests for budget calculation, not APPROVED
            const spentBudget = relevantRequests
                .filter((req: any) => req.status === 'ACTIVE')
                .reduce((sum: number, req: any) => {
                    let cost = Number(req.cost);
                    
                    if (req.paymentFrequency === 'YEARLY') {
                        cost = cost / 12;
                    } else if (req.paymentFrequency === 'ONE_TIME') {
                        if (dateStart && dateEnd) {
                            const reqDate = req.startDate ? new Date(req.startDate) : new Date(req.createdAt);
                            if (reqDate < dateStart || reqDate > dateEnd) {
                                return sum;
                            }
                        }
                    }
                    
                    return sum + cost;
                }, 0);

            const remainingBudget = totalBudget - spentBudget;
            const budgetUsagePercentage = totalBudget > 0 ? (spentBudget / totalBudget) * 100 : 0;

            const activeRequests = relevantRequests.map((req: any) => ({
                id: req.id,
                platformName: req.platformName,
                cost: Number(req.cost),
                currency: req.currency,
                status: req.status,
                startDate: req.startDate,
                renewalDate: req.renewalDate,
                paymentFrequency: req.paymentFrequency,
                createdAt: req.createdAt,
            }));

            return {
                id: department.id,
                name: department.name,
                totalBudget,
                spentBudget: Math.round(spentBudget * 100) / 100,
                remainingBudget: Math.round(remainingBudget * 100) / 100,
                budgetUsagePercentage: Math.round(budgetUsagePercentage * 100) / 100,
                activeRequests,
            };
        })
    );

    return budgetData;
};

export const exportBudgetsToExcel = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const role = (req as any).user.role;
        
        // Allow MANAGER, ADMIN, and ACCOUNTANT to access this endpoint
        if (role !== 'MANAGER' && role !== 'ADMIN' && role !== 'ACCOUNTANT') {
            return res.status(403).json({ error: 'Only managers, admins, and accountants can export department budgets' });
        }

        // Get date range from query parameters
        const { startDate, endDate } = req.query;
        
        let dateStart: Date | null = null;
        let dateEnd: Date | null = null;

        if (startDate && endDate) {
            dateStart = new Date(startDate as string);
            dateEnd = new Date(endDate as string);
            dateEnd.setHours(23, 59, 59, 999);
        }

        // Fetch budget data
        const budgetData = await fetchBudgetData(userId, role, dateStart, dateEnd);

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();

        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Summary');
        const totalDepartments = budgetData.length;
        const totalBudget = budgetData.reduce((sum, dept) => sum + dept.totalBudget, 0);
        const totalSpent = budgetData.reduce((sum, dept) => sum + dept.spentBudget, 0);
        const totalRemaining = budgetData.reduce((sum, dept) => sum + dept.remainingBudget, 0);

        summarySheet.columns = [
            { header: 'Metric', key: 'metric', width: 25 },
            { header: 'Value', key: 'value', width: 30 }
        ];

        summarySheet.addRow({ metric: 'Report Date Range', value: dateStart && dateEnd 
            ? `${dateStart.toLocaleDateString()} to ${dateEnd.toLocaleDateString()}`
            : 'All Time' });
        summarySheet.addRow({ metric: 'Total Departments', value: totalDepartments });
        summarySheet.addRow({ metric: 'Total Budget', value: `$${totalBudget.toFixed(2)}` });
        summarySheet.addRow({ metric: 'Total Spent', value: `$${totalSpent.toFixed(2)}` });
        summarySheet.addRow({ metric: 'Total Remaining', value: `$${totalRemaining.toFixed(2)}` });
        summarySheet.addRow({ metric: 'Generated', value: new Date().toLocaleString() });

        summarySheet.getRow(1).font = { bold: true };
        summarySheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Department Budgets Sheet
        const deptSheet = workbook.addWorksheet('Department Budgets');
        deptSheet.columns = [
            { header: 'Department Name', key: 'name', width: 25 },
            { header: 'Total Budget', key: 'totalBudget', width: 15 },
            { header: 'Spent Budget', key: 'spentBudget', width: 15 },
            { header: 'Remaining Budget', key: 'remainingBudget', width: 15 },
            { header: 'Usage %', key: 'usagePercentage', width: 12 },
            { header: 'Active Accounts', key: 'activeAccounts', width: 15 }
        ];

        budgetData.forEach(dept => {
            deptSheet.addRow({
                name: dept.name,
                totalBudget: `$${dept.totalBudget.toFixed(2)}`,
                spentBudget: `$${dept.spentBudget.toFixed(2)}`,
                remainingBudget: `$${dept.remainingBudget.toFixed(2)}`,
                usagePercentage: `${dept.budgetUsagePercentage.toFixed(2)}%`,
                activeAccounts: dept.activeRequests.length
            });
        });

        deptSheet.getRow(1).font = { bold: true };
        deptSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Active Accounts Sheet
        const accountsSheet = workbook.addWorksheet('Active Accounts');
        accountsSheet.columns = [
            { header: 'Department', key: 'department', width: 20 },
            { header: 'Platform', key: 'platform', width: 25 },
            { header: 'Cost', key: 'cost', width: 15 },
            { header: 'Currency', key: 'currency', width: 10 },
            { header: 'Frequency', key: 'frequency', width: 12 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Start Date', key: 'startDate', width: 15 },
            { header: 'Renewal Date', key: 'renewalDate', width: 15 },
            { header: 'Created', key: 'created', width: 15 }
        ];

        budgetData.forEach(dept => {
            dept.activeRequests.forEach((req: any) => {
                accountsSheet.addRow({
                    department: dept.name,
                    platform: req.platformName,
                    cost: `${req.currency} ${req.cost.toFixed(2)}`,
                    currency: req.currency,
                    frequency: req.paymentFrequency,
                    status: req.status,
                    startDate: req.startDate 
                        ? new Date(req.startDate).toLocaleDateString() 
                        : (req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'N/A'),
                    renewalDate: req.renewalDate ? new Date(req.renewalDate).toLocaleDateString() : 'N/A',
                    created: new Date(req.createdAt).toLocaleDateString()
                });
            });
        });

        accountsSheet.getRow(1).font = { bold: true };
        accountsSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Generate filename
        const today = new Date().toISOString().split('T')[0];
        let filename = `department-budgets-${today}`;
        if (dateStart && dateEnd) {
            const startStr = dateStart.toISOString().split('T')[0];
            const endStr = dateEnd.toISOString().split('T')[0];
            filename = `department-budgets-${startStr}-to-${endStr}`;
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error exporting budgets to Excel:', error);
        res.status(500).json({ error: 'Failed to export budgets to Excel' });
    }
};

export const exportBudgetsToPDF = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const role = (req as any).user.role;
        
        // Allow MANAGER, ADMIN, and ACCOUNTANT to access this endpoint
        if (role !== 'MANAGER' && role !== 'ADMIN' && role !== 'ACCOUNTANT') {
            return res.status(403).json({ error: 'Only managers, admins, and accountants can export department budgets' });
        }

        // Get date range from query parameters
        const { startDate, endDate } = req.query;
        
        let dateStart: Date | null = null;
        let dateEnd: Date | null = null;

        if (startDate && endDate) {
            dateStart = new Date(startDate as string);
            dateEnd = new Date(endDate as string);
            dateEnd.setHours(23, 59, 59, 999);
        }

        // Fetch budget data
        const budgetData = await fetchBudgetData(userId, role, dateStart, dateEnd);

        const doc = new PDFDocument({ margin: 50 });
        
        // Generate filename
        const today = new Date().toISOString().split('T')[0];
        let filename = `department-budgets-${today}`;
        if (dateStart && dateEnd) {
            const startStr = dateStart.toISOString().split('T')[0];
            const endStr = dateEnd.toISOString().split('T')[0];
            filename = `department-budgets-${startStr}-to-${endStr}`;
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);

        doc.pipe(res);

        // Title
        doc.fontSize(20).text('Department Budgets Report', { align: 'center' });
        doc.moveDown();
        
        // Date range
        if (dateStart && dateEnd) {
            doc.fontSize(12).text(
                `Date Range: ${dateStart.toLocaleDateString()} to ${dateEnd.toLocaleDateString()}`,
                { align: 'center' }
            );
        } else {
            doc.fontSize(12).text('Date Range: All Time', { align: 'center' });
        }
        
        doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown(2);

        // Summary Section
        const totalDepartments = budgetData.length;
        const totalBudget = budgetData.reduce((sum, dept) => sum + dept.totalBudget, 0);
        const totalSpent = budgetData.reduce((sum, dept) => sum + dept.spentBudget, 0);
        const totalRemaining = budgetData.reduce((sum, dept) => sum + dept.remainingBudget, 0);

        doc.fontSize(16).text('Summary', { underline: true });
        doc.moveDown();
        doc.fontSize(12)
            .text(`Total Departments: ${totalDepartments}`, { indent: 20 })
            .text(`Total Budget: $${totalBudget.toFixed(2)}`, { indent: 20 })
            .text(`Total Spent: $${totalSpent.toFixed(2)}`, { indent: 20 })
            .text(`Total Remaining: $${totalRemaining.toFixed(2)}`, { indent: 20 });
        doc.moveDown(2);

        // Department Details
        budgetData.forEach((dept, index) => {
            if (index > 0) {
                doc.addPage();
            }

            doc.fontSize(16).text(dept.name, { underline: true });
            doc.moveDown();
            
            doc.fontSize(12)
                .text(`Total Budget: $${dept.totalBudget.toFixed(2)}`, { indent: 20 })
                .text(`Spent Budget: $${dept.spentBudget.toFixed(2)}`, { indent: 20 })
                .text(`Remaining Budget: $${dept.remainingBudget.toFixed(2)}`, { indent: 20 })
                .text(`Usage: ${dept.budgetUsagePercentage.toFixed(2)}%`, { indent: 20 })
                .text(`Active Accounts: ${dept.activeRequests.length}`, { indent: 20 });
            
            doc.moveDown();

            if (dept.activeRequests.length > 0) {
                doc.fontSize(14).text('Active Accounts:', { indent: 20 });
                doc.moveDown(0.5);
                
                dept.activeRequests.forEach((req: any) => {
                    const startDateStr = req.startDate 
                        ? new Date(req.startDate).toLocaleDateString() 
                        : (req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'N/A');
                    const renewalDateStr = req.renewalDate 
                        ? new Date(req.renewalDate).toLocaleDateString() 
                        : 'N/A';
                    
                    doc.fontSize(10)
                        .text(`${req.platformName} - ${req.currency} ${req.cost.toFixed(2)} (${req.paymentFrequency})`, { indent: 40 })
                        .text(`Status: ${req.status} | Start: ${startDateStr} | Renewal: ${renewalDateStr}`, { indent: 40 });
                    doc.moveDown(0.3);
                });
            } else {
                doc.fontSize(12).text('No active accounts in this period.', { indent: 20 });
            }

            doc.moveDown();
        });

        doc.end();
    } catch (error) {
        console.error('Error exporting budgets to PDF:', error);
        res.status(500).json({ error: 'Failed to export budgets to PDF' });
    }
};
