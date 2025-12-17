# Corporate Subscription Manager

A comprehensive web application for managing corporate subscriptions, purchase requests, and budget tracking with role-based access control and Telegram bot integration.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Default Users](#default-users)
- [Getting Started Checklist](#getting-started-checklist)
- [PM2 Process Management](#pm2-process-management)
- [Development](#-development)
- [Production Deployment](#production-deployment)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)
- [Additional Resources](#additional-resources)
- [License](#license)

## 🎯 Overview

Corporate Subscription Manager is a full-stack application designed to streamline the process of managing corporate subscription requests. It provides a centralized platform where managers can submit subscription requests, accountants can review and approve them, and administrators can oversee the entire system.

### Key Capabilities

- **Request Management**: Submit, track, and manage subscription requests
- **Department Management**: Organize requests by departments with budget tracking
- **Multi-Manager Support**: Assign multiple managers to departments
- **Approval Workflow**: Streamlined approval/rejection process for accountants
- **Telegram Integration**: Real-time notifications via Telegram bot
- **Budget Tracking**: Monitor department budgets and spending
- **File Attachments**: Upload screenshots and documents with requests
- **Audit Logging**: Track all system changes and user actions

## ✨ Features

- 🔐 **Role-Based Access Control**: Admin, Accountant, and Manager roles with appropriate permissions
- 📊 **Dashboard Analytics**: View requests, budgets, and spending overview
- 💬 **Comments System**: Communication between managers and accountants
- 🔔 **Telegram Notifications**: Real-time updates for request status changes
- 📁 **Department Management**: Create and manage departments with budget limits
- 📎 **File Uploads**: Attach screenshots and documents to requests
- 🔄 **Request Status Tracking**: PENDING → APPROVED/REJECTED → ACTIVE → EXPIRED
- 📈 **Budget Warnings**: Alerts when requests exceed department budgets
- 🔍 **Search & Filter**: Find requests by status, department, or date
- 📱 **Responsive Design**: Works on desktop and mobile devices

## 🏗️ Architecture

This application consists of:

- **Backend**: Node.js/Express/TypeScript API server
- **Frontend**: React/Vite application with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Process Management**: PM2 for process monitoring and management
- **Telegram Bot**: Node.js bot for notifications and interactions

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **PostgreSQL** 15+ (see [SETUP_POSTGRES.md](./SETUP_POSTGRES.md) for installation)
- **PM2** (install globally: `npm install -g pm2`)

## 🚀 Quick Start

Follow these steps to get the application running:

### Step 1: Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd personal-accounter-web

# Install root dependencies (PM2)
npm install

# Install backend and frontend dependencies
npm run install:all
```

### Step 2: Set Up PostgreSQL

Follow the instructions in [SETUP_POSTGRES.md](./SETUP_POSTGRES.md) to install and configure PostgreSQL locally.

**Quick PostgreSQL Setup:**
```bash
# Create database and user
createdb subscription_manager
createuser admin -P  # Set password when prompted

# Grant privileges
psql -d subscription_manager -c "GRANT ALL PRIVILEGES ON DATABASE subscription_manager TO admin;"
```

### Step 3: Configure Environment Variables

#### Backend Environment Variables

Copy the example file and create `backend/.env`:

```bash
cp backend/env.example backend/.env
```

Edit `backend/.env` with your configuration:

```env
# Database Configuration
DATABASE_URL=postgresql://admin:password@localhost:5432/subscription_manager

# Server Configuration
PORT=3000

# JWT Configuration
JWT_SECRET=supersecretkey-change-in-production

# Encryption Key (must be 32 characters for AES encryption)
ENCRYPTION_KEY=default-key-change-in-production-32chars!!

# Telegram Bot Configuration (Optional)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_BOT_USERNAME=your_bot_username

# Frontend URL (used for generating links in Telegram notifications)
FRONTEND_URL=http://localhost:5173

# Node Environment
NODE_ENV=development
```

#### Frontend Environment Variables

Copy the example file and create `frontend/.env`:

```bash
cp frontend/env.example frontend/.env
```

The default `frontend/.env` should work for local development:

```env
# Backend API URL
VITE_API_URL=http://localhost:3000
```

### Step 4: Initialize Database

```bash
cd backend

# Run database migrations
npx prisma migrate deploy
# or for development (creates migration files):
npx prisma migrate dev

# Seed the database with default users and departments
npx prisma db seed
```

### Step 5: Start the Application

#### Development Mode

```bash
# From project root, start both backend and frontend
npm run pm2:start:dev

# Or start individually
cd backend && npm run pm2:start:dev
cd frontend && npm run pm2:start:dev
```

#### Verify Installation

1. **Backend**: Open http://localhost:3000 - You should see "Corporate Subscription Manager API"
2. **Frontend**: Open http://localhost:5173 - You should see the login page
3. **Check PM2 Status**: Run `npm run pm2:status` to verify processes are running

## 👥 Default Users

After running the database seed (`npx prisma db seed`), the following default users are created:

| Role | Email | Password | Description |
|------|-------|----------|-------------|
| **Admin** | `admin@corp.com` | `password123` | Full system access, can manage departments and users |
| **Accountant** | `accountant@corp.com` | `password123` | Can approve/reject requests, view all requests |
| **Manager** | `manager@corp.com` | `password123` | Can create requests for assigned departments |

### Default Departments

The seed also creates two sample departments:

- **IT Department**: Budget $5,000/month
- **Marketing**: Budget $2,000/month

Both departments are initially assigned to the Manager user.

### ⚠️ Security Note

**Important**: Change these default passwords immediately in production! These credentials are for development/testing only.

## 📋 Getting Started Checklist

Use this checklist to ensure you've completed all setup steps:

- [ ] Node.js >= 18.0.0 installed
- [ ] PostgreSQL 15+ installed and running
- [ ] PM2 installed globally (`npm install -g pm2`)
- [ ] Repository cloned
- [ ] Dependencies installed (`npm install && npm run install:all`)
- [ ] PostgreSQL database created
- [ ] Backend `.env` file created and configured
- [ ] Frontend `.env` file created (optional, defaults work)
- [ ] Database migrations run (`npx prisma migrate deploy`)
- [ ] Database seeded (`npx prisma db seed`)
- [ ] PM2 processes started (`npm run pm2:start:dev`)
- [ ] Backend accessible at http://localhost:3000
- [ ] Frontend accessible at http://localhost:5173
- [ ] Can log in with default credentials

## 🔧 PM2 Process Management

This project uses PM2 for process management. PM2 provides:
- Process monitoring and auto-restart
- Log management
- Cluster mode support
- Zero-downtime reloads

### PM2 Configuration

The `ecosystem.config.js` file defines four processes:
- `backend-dev`: Backend in development mode (with hot reload via nodemon)
- `backend-prod`: Backend in production mode (compiled TypeScript)
- `frontend-dev`: Frontend Vite dev server
- `frontend-prod`: Frontend production build (served via Vite preview)

### Starting Applications

#### Development Mode

```bash
# Start both backend and frontend in development mode
npm run pm2:start:dev

# Or start individually
cd backend && npm run pm2:start:dev
cd frontend && npm run pm2:start:dev
```

#### Production Mode

```bash
# Build applications first
npm run build:all

# Start both backend and frontend in production mode
npm run pm2:start:prod
```

### Managing Processes

```bash
# View process status
npm run pm2:status

# View logs (all processes)
npm run pm2:logs

# View backend logs only
npm run pm2:logs:backend

# View frontend logs only
npm run pm2:logs:frontend

# Restart processes
npm run pm2:restart:dev    # Development
npm run pm2:restart:prod   # Production
npm run pm2:restart:all    # All processes

# Stop processes
npm run pm2:stop:dev       # Development
npm run pm2:stop:prod      # Production
npm run pm2:stop:all       # All processes

# Delete all processes
npm run pm2:delete:all

# Monitor processes (real-time)
npm run pm2:monit
```

### PM2 Persistence

To save the current PM2 process list and restore it after system restart:

```bash
# Save current process list
npm run pm2:save

# After restart, restore processes
npm run pm2:resurrect
```

Or set up PM2 to start on system boot:

```bash
pm2 startup
pm2 save
```

### Logs Location

PM2 logs are stored in the `logs/` directory:
- `logs/backend-dev.log` - Backend development logs
- `logs/backend-prod.log` - Backend production logs
- `logs/frontend-dev.log` - Frontend development logs
- `logs/frontend-prod.log` - Frontend production logs

## 💻 Development

### Backend Development

```bash
cd backend
npm run dev  # Runs with nodemon and ts-node for hot reload
```

### Frontend Development

```bash
cd frontend
npm run dev  # Runs Vite dev server
```

### Running with PM2 (Development)

```bash
# Start development processes
npm run pm2:start:dev

# Watch logs
npm run pm2:logs

# Make changes - processes will auto-restart (backend-dev uses nodemon)
```

### Building for Production

```bash
# Build backend
npm run build:backend

# Build frontend
npm run build:frontend

# Build both
npm run build:all
```

## 🚢 Production Deployment

1. **Build applications**:
   ```bash
   npm run build:all
   ```

2. **Set production environment variables** in `backend/.env`:
   ```env
   NODE_ENV=production
   # Update DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY for production
   # Use strong, unique values for JWT_SECRET and ENCRYPTION_KEY
   ```

3. **Start production processes**:
   ```bash
   npm run pm2:start:prod
   ```

4. **Save PM2 configuration**:
   ```bash
   npm run pm2:save
   ```

5. **Set up PM2 startup** (optional, for auto-start on boot):
   ```bash
   pm2 startup
   pm2 save
   ```

## 📁 Project Structure

```
personal-accounter-web/
├── backend/              # Backend API (Node.js/Express/TypeScript)
│   ├── src/             # Source code
│   │   ├── controllers/ # Request handlers
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic (Telegram bot, cron jobs)
│   │   ├── utils/       # Utilities (Prisma client, auth)
│   │   └── index.ts     # Entry point
│   ├── dist/            # Compiled JavaScript
│   ├── prisma/          # Database schema and migrations
│   │   ├── schema.prisma # Database schema
│   │   ├── migrations/  # Migration files
│   │   └── seed.ts      # Database seed script
│   └── uploads/         # Uploaded files
├── frontend/            # Frontend application (React/Vite)
│   ├── src/             # Source code
│   │   ├── pages/       # Page components
│   │   ├── components/  # Reusable components
│   │   ├── services/    # API services
│   │   └── App.tsx      # Main app component
│   └── dist/            # Built static files
├── ecosystem.config.js  # PM2 configuration
├── package.json         # Root package.json with PM2 scripts
├── SETUP_POSTGRES.md    # PostgreSQL setup guide
└── README.md            # This file
```

## 🔐 Environment Variables

### Backend

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | - | ✅ |
| `PORT` | Server port | `3000` | ❌ |
| `JWT_SECRET` | Secret key for JWT tokens | - | ✅ |
| `ENCRYPTION_KEY` | AES encryption key (32 chars) | - | ✅ |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | - | ❌ |
| `TELEGRAM_BOT_USERNAME` | Telegram bot username | - | ❌ |
| `FRONTEND_URL` | Frontend URL for notifications | `http://localhost:5173` | ❌ |
| `NODE_ENV` | Node environment | `development` | ❌ |

### Frontend

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `VITE_API_URL` | Backend API URL | `http://localhost:3000` | ❌ |

## 🐛 Troubleshooting

### PM2 Process Not Starting

- Check if ports 3000 (backend) and 5173 (frontend) are available
- Verify environment variables are set correctly
- Check PM2 logs: `npm run pm2:logs`
- Verify PM2 is installed: `pm2 --version`

### Database Connection Issues

- Ensure PostgreSQL is running locally
- Verify `DATABASE_URL` uses `localhost` for your local PostgreSQL instance
- Check PostgreSQL connection: `psql postgresql://admin:password@localhost:5432/subscription_manager`
- Verify database exists: `psql -l | grep subscription_manager`

### Build Errors

- Ensure all dependencies are installed: `npm run install:all`
- Check Node.js version: `node --version` (should be >= 18)
- Clear node_modules and reinstall if needed:
  ```bash
  rm -rf node_modules backend/node_modules frontend/node_modules
  npm run install:all
  ```

### Port Already in Use

- Check what's using the port: `lsof -i :3000` (macOS/Linux) or `netstat -ano | findstr :3000` (Windows)
- Stop conflicting processes or change ports in `.env` files

### Cannot Login with Default Users

- Ensure database seed was run: `cd backend && npx prisma db seed`
- Verify users exist in database:
  ```bash
  psql postgresql://admin:password@localhost:5432/subscription_manager -c "SELECT email, role FROM users;"
  ```

### Telegram Bot Not Working

- Verify `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME` are set in `backend/.env`
- Check backend logs for Telegram bot errors: `npm run pm2:logs:backend`
- Ensure bot token is valid and bot is started

## 📚 Additional Resources

- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [PostgreSQL Setup Guide](./SETUP_POSTGRES.md)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Telegram Bot API](https://core.telegram.org/bots/api)

## 📄 License

ISC

---

**Need Help?** If you encounter any issues, please check the [Troubleshooting](#troubleshooting) section or open an issue on GitHub.
