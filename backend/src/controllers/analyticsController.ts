import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import ExcelJS from 'exceljs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

export const getAnalytics = async (req: Request, res: Response) => {
    try {
        const userRole = (req as any).user.role;
        // Limit to Admin/Accountant
        if (userRole !== 'ADMIN' && userRole !== 'ACCOUNTANT') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // 1. KPI Cards
        const totalRequests = await prisma.request.count();
        const activeRequests = await prisma.request.count({ where: { status: 'ACTIVE' } });
        const pendingRequests = await prisma.request.count({ where: { status: 'PENDING' } });

        // Calculate Monthly Spend (Approximate)
        // Ideally we normalize Yearly to /12.
        const allActiveApproved = await prisma.request.findMany({
            where: { status: { in: ['ACTIVE', 'APPROVED'] } }
        });

        const totalMonthlySpend = allActiveApproved.reduce((sum: number, req: any) => {
            let cost = Number(req.cost);
            if (req.paymentFrequency === 'YEARLY') cost = cost / 12;
            if (req.paymentFrequency === 'ONE_TIME') cost = 0; // Don't count in MRR
            return sum + cost;
        }, 0);

        // 2. Spend by Department
        const departments = await prisma.department.findMany({
            include: { requests: true }
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
            }
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

        // Get all requests with details
        const requests = await prisma.request.findMany({
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

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=subscriptions-${new Date().toISOString().split('T')[0]}.xlsx`);

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

        // Get analytics data
        const allActiveApproved = await prisma.request.findMany({
            where: { status: { in: ['ACTIVE', 'APPROVED'] } },
            include: {
                requester: { select: { name: true } },
                department: { select: { name: true } }
            }
        });

        const departments = await prisma.department.findMany({
            include: { requests: true }
        });

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=analytics-${new Date().toISOString().split('T')[0]}.pdf`);

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
