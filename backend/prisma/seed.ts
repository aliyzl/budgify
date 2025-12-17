import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Create Users
    const admin = await prisma.user.upsert({
        where: { email: 'admin@corp.com' },
        update: {},
        create: {
            email: 'admin@corp.com',
            name: 'Admin User',
            passwordHash: hashedPassword,
            role: 'ADMIN',
        },
    });

    const accountant = await prisma.user.upsert({
        where: { email: 'accountant@corp.com' },
        update: {},
        create: {
            email: 'accountant@corp.com',
            name: 'Accountant User',
            passwordHash: hashedPassword,
            role: 'ACCOUNTANT',
        },
    });

    const manager = await prisma.user.upsert({
        where: { email: 'manager@corp.com' },
        update: {},
        create: {
            email: 'manager@corp.com',
            name: 'Manager User',
            passwordHash: hashedPassword,
            role: 'MANAGER',
        },
    });

    // Create Departments
    const deptIT = await prisma.department.upsert({
        where: { id: 1 },
        update: {},
        create: {
            name: 'IT Department',
            monthlyBudget: 5000,
            currentManagerId: manager.id,
        },
    });

    const deptMarketing = await prisma.department.upsert({
        where: { id: 2 },
        update: {},
        create: {
            name: 'Marketing',
            monthlyBudget: 2000,
            currentManagerId: manager.id,
        },
    });

    console.log({ admin, accountant, manager, deptIT, deptMarketing });
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
