import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import ExcelJS from 'exceljs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

// Helper function to calculate date range based on period
const getDateRange = (period?: string, startDate?: string, endDate?: string): { start: Date | null, end: Date | null } => {
    const now = new Date();
    
    // Custom date range
    if (startDate && endDate) {
        return {
            start: new Date(startDate),
            end: new Date(endDate)
        };
    }
    
    // Predefined periods
    switch (period) {
        case 'last_month': {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            return { start, end: null };
        }
        case 'last_3_months': {
            const start = new Date(now);
            start.setMonth(start.getMonth() - 3);
            return { start, end: null };
        }
        case 'last_6_months': {
            const start = new Date(now);
            start.setMonth(start.getMonth() - 6);
            return { start, end: null };
        }
        case 'last_year': {
            const start = new Date(now);
            start.setFullYear(start.getFullYear() - 1);
            return { start, end: null };
        }
        case 'all_time':
        default:
            return { start: null, end: null };
    }
};

// Helper function to build date filter for Prisma
const buildDateFilter = (start: Date | null, end: Date | null) => {
    const filter: any = {};
    if (start) {
        filter.gte = start;
    }
    if (end) {
        filter.lte = end;
    }
    return Object.keys(filter).length > 0 ? filter : undefined;
};

export const getAnalytics = async (req: Request, res: Response) => {
    try {
        const userRole = (req as any).user.role;
        // Limit to Admin/Accountant
        if (userRole !== 'ADMIN' && userRole !== 'ACCOUNTANT') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Parse query parameters
        const period = req.query.period as string | undefined;
        const startDate = req.query.startDate as string | undefined;
        const endDate = req.query.endDate as string | undefined;
        const departmentIdsParam = req.query.departmentIds as string | undefined;
        const departmentIdParam = req.query.departmentId as string | undefined;
        
        const { start, end } = getDateRange(period, startDate, endDate);
        const dateFilter = buildDateFilter(start, end);

        // Parse department IDs (support both single and multiple)
        let departmentIds: number[] | undefined = undefined;
        if (departmentIdsParam) {
            departmentIds = departmentIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        } else if (departmentIdParam) {
            const singleId = parseInt(departmentIdParam);
            if (!isNaN(singleId)) {
                departmentIds = [singleId];
            }
        }

        // Build base where clause with date and department filters
        const baseWhere: any = { deletedAt: null };
        if (dateFilter) {
            baseWhere.createdAt = dateFilter;
        }
        if (departmentIds && departmentIds.length > 0) {
            baseWhere.departmentId = { in: departmentIds };
        }

        // 1. KPI Cards
        const totalRequests = await prisma.request.count({ where: baseWhere });
        
        const activeWhere = { ...baseWhere, status: 'ACTIVE' };
        const activeRequests = await prisma.request.count({ where: activeWhere });
        
        const pendingWhere = { ...baseWhere, status: 'PENDING' };
        const pendingRequests = await prisma.request.count({ where: pendingWhere });

        // Calculate Monthly Spend (Approximate)
        // For monthly spend, we need to consider requests that are ACTIVE or APPROVED
        // and were created/updated within the period
        const allActiveApprovedWhere: any = { 
            status: { in: ['ACTIVE', 'APPROVED'] },
            deletedAt: null
        };
        if (dateFilter) {
            // For monthly spend, consider requests created in the period
            allActiveApprovedWhere.createdAt = dateFilter;
        }
        if (departmentIds && departmentIds.length > 0) {
            allActiveApprovedWhere.departmentId = { in: departmentIds };
        }
        
        const allActiveApproved = await prisma.request.findMany({
            where: allActiveApprovedWhere
        });

        const totalMonthlySpend = allActiveApproved.reduce((sum: number, req: any) => {
            let cost = Number(req.cost);
            if (req.paymentFrequency === 'YEARLY') cost = cost / 12;
            if (req.paymentFrequency === 'ONE_TIME') cost = 0; // Don't count in MRR
            return sum + cost;
        }, 0);

        // 2. Spend by Department
        // If departments are filtered, only show those departments
        const departmentWhere: any = {};
        if (departmentIds && departmentIds.length > 0) {
            departmentWhere.id = { in: departmentIds };
        }
        
        const departments = await prisma.department.findMany({
            where: departmentWhere,
            include: { 
                requests: {
                    where: (() => {
                        const reqWhere: any = { deletedAt: null };
                        if (dateFilter) {
                            reqWhere.createdAt = dateFilter;
                        }
                        return reqWhere;
                    })()
                }
            }
        });

        const spendByDepartment = departments.map((dept: any) => {
            const spend = dept.requests
                .filter((r: any) => ['ACTIVE', 'APPROVED'].includes(r.status))
                .reduce((sum: number, r: any) => {
                    let cost = Number(r.cost);
                    if (r.paymentFrequency === 'YEARLY') cost = cost / 12;
                    return sum + cost;
                }, 0);
            return { name: dept.name, value: Math.round(spend) };
        });

        // Get all departments list for frontend selector
        const allDepartments = await prisma.department.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        });

        // 3. Top Platforms by Cost
        // Group by platform name manually since Prisma groupBy can be tricky with calculated fields
        const platformMap: Record<string, number> = {};
        allActiveApproved.forEach((r: any) => {
            let cost = Number(r.cost);
            if (r.paymentFrequency === 'YEARLY') cost = cost / 12;
            if (r.paymentFrequency === 'ONE_TIME') cost = 0;

            platformMap[r.platformName] = (platformMap[r.platformName] || 0) + cost;
        });

        const spendByPlatform = Object.entries(platformMap)
            .map(([name, value]) => ({ name, value: Math.round(value) }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        res.json({
            kpi: {
                totalRequests,
                activeRequests,
                pendingRequests,
                totalMonthlySpend: Math.round(totalMonthlySpend)
            },
            charts: {
                spendByDepartment,
                spendByPlatform
            },
            period: period || 'all_time',
            dateRange: start && end ? { start, end } : start ? { start } : null,
            departments: allDepartments,
            selectedDepartmentIds: departmentIds || []
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed' });
    }
};

export const exportToExcel = async (req: Request, res: Response) => {
    try {
        const userRole = (req as any).user.role;
        if (userRole !== 'ADMIN' && userRole !== 'ACCOUNTANT') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Parse query parameters for time and department filtering
        const period = req.query.period as string | undefined;
        const startDate = req.query.startDate as string | undefined;
        const endDate = req.query.endDate as string | undefined;
        const departmentIdsParam = req.query.departmentIds as string | undefined;
        const departmentIdParam = req.query.departmentId as string | undefined;
        
        const { start, end } = getDateRange(period, startDate, endDate);
        const dateFilter = buildDateFilter(start, end);

        // Parse department IDs
        let departmentIds: number[] | undefined = undefined;
        if (departmentIdsParam) {
            departmentIds = departmentIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        } else if (departmentIdParam) {
            const singleId = parseInt(departmentIdParam);
            if (!isNaN(singleId)) {
                departmentIds = [singleId];
            }
        }

        // Build where clause
        const where: any = { deletedAt: null };
        if (dateFilter) {
            where.createdAt = dateFilter;
        }
        if (departmentIds && departmentIds.length > 0) {
            where.departmentId = { in: departmentIds };
        }

        // Get requests with details, filtered by time period
        const requests = await prisma.request.findMany({
            where,
            include: {
                requester: { select: { name: true, email: true } },
                department: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Subscription Requests');

        // Add headers
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Platform', key: 'platformName', width: 20 },
            { header: 'Cost', key: 'cost', width: 15 },
            { header: 'Currency', key: 'currency', width: 10 },
            { header: 'Frequency', key: 'paymentFrequency', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Department', key: 'department', width: 20 },
            { header: 'Requester', key: 'requester', width: 25 },
            { header: 'Created', key: 'createdAt', width: 20 }
        ];

        // Add data
        requests.forEach(request => {
            worksheet.addRow({
                id: request.id,
                platformName: request.platformName,
                cost: request.cost,
                currency: request.currency,
                paymentFrequency: request.paymentFrequency,
                status: request.status,
                department: request.department.name,
                requester: `${request.requester.name} (${request.requester.email})`,
                createdAt: new Date(request.createdAt).toLocaleDateString()
            });
        });

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        const periodSuffix = period ? `-${period}` : '';
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=subscriptions-${new Date().toISOString().split('T')[0]}${periodSuffix}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to export Excel' });
    }
};

export const exportToPDF = async (req: Request, res: Response) => {
    try {
        const userRole = (req as any).user.role;
        if (userRole !== 'ADMIN' && userRole !== 'ACCOUNTANT') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Parse query parameters for time and department filtering
        const period = req.query.period as string | undefined;
        const startDate = req.query.startDate as string | undefined;
        const endDate = req.query.endDate as string | undefined;
        const departmentIdsParam = req.query.departmentIds as string | undefined;
        const departmentIdParam = req.query.departmentId as string | undefined;
        
        const { start, end } = getDateRange(period, startDate, endDate);
        const dateFilter = buildDateFilter(start, end);

        // Parse department IDs
        let departmentIds: number[] | undefined = undefined;
        if (departmentIdsParam) {
            departmentIds = departmentIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        } else if (departmentIdParam) {
            const singleId = parseInt(departmentIdParam);
            if (!isNaN(singleId)) {
                departmentIds = [singleId];
            }
        }

        // Build where clause for active/approved requests
        const allActiveApprovedWhere: any = { 
            status: { in: ['ACTIVE', 'APPROVED'] },
            deletedAt: null
        };
        if (dateFilter) {
            allActiveApprovedWhere.createdAt = dateFilter;
        }
        if (departmentIds && departmentIds.length > 0) {
            allActiveApprovedWhere.departmentId = { in: departmentIds };
        }

        // Get analytics data
        const allActiveApproved = await prisma.request.findMany({
            where: allActiveApprovedWhere,
            include: {
                requester: { select: { name: true } },
                department: { select: { name: true } }
            }
        });

        const departmentWhere: any = {};
        if (departmentIds && departmentIds.length > 0) {
            departmentWhere.id = { in: departmentIds };
        }

        const departments = await prisma.department.findMany({
            where: departmentWhere,
            include: { 
                requests: {
                    where: (() => {
                        const reqWhere: any = { deletedAt: null };
                        if (dateFilter) {
                            reqWhere.createdAt = dateFilter;
                        }
                        return reqWhere;
                    })()
                }
            }
        });

        const doc = new PDFDocument({ margin: 50 });
        const periodSuffix = period ? `-${period}` : '';
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=analytics-${new Date().toISOString().split('T')[0]}${periodSuffix}.pdf`);

        doc.pipe(res);

        // Title
        doc.fontSize(20).text('Subscription Management Analytics', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown(2);

        // Summary
        doc.fontSize(16).text('Summary', { underline: true });
        doc.moveDown();

        const totalMonthlySpend = allActiveApproved.reduce((sum: number, req: any) => {
            let cost = Number(req.cost);
            if (req.paymentFrequency === 'YEARLY') cost = cost / 12;
            if (req.paymentFrequency === 'ONE_TIME') cost = 0;
            return sum + cost;
        }, 0);

        doc.fontSize(12)
            .text(`Total Monthly Spend: $${Math.round(totalMonthlySpend)}`, { indent: 20 })
            .text(`Active Subscriptions: ${allActiveApproved.length}`, { indent: 20 });
        doc.moveDown(2);

        // Department Breakdown
        doc.fontSize(16).text('Spend by Department', { underline: true });
        doc.moveDown();

        departments.forEach((dept: any) => {
            const spend = dept.requests
                .filter((r: any) => ['ACTIVE', 'APPROVED'].includes(r.status))
                .reduce((sum: number, r: any) => {
                    let cost = Number(r.cost);
                    if (r.paymentFrequency === 'YEARLY') cost = cost / 12;
                    return sum + cost;
                }, 0);
            
            doc.fontSize(12).text(`${dept.name}: $${Math.round(spend)}/month`, { indent: 20 });
        });

        doc.end();
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to export PDF' });
    }
};
