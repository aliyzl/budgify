# PostgreSQL Local Setup Guide

This guide will help you set up PostgreSQL locally for the Personal Accounter Web application.

## Prerequisites

- macOS, Linux, or Windows operating system
- Administrator/sudo access

## Installation

### macOS

Using Homebrew (recommended):
```bash
brew install postgresql@15
brew services start postgresql@15
```

Or download from [PostgreSQL official website](https://www.postgresql.org/download/macosx/).

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Linux (CentOS/RHEL)

```bash
sudo yum install postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Windows

Download and install from [PostgreSQL official website](https://www.postgresql.org/download/windows/).

During installation, remember the password you set for the `postgres` user.

## Database Setup

### 1. Access PostgreSQL

**macOS/Linux:**
```bash
psql postgres
```

**Windows:**
Use pgAdmin or psql from the command line (usually available in the Start menu after installation).

### 2. Create Database and User

Once connected to PostgreSQL, run the following SQL commands:

```sql
-- Create a new user (optional, or use existing postgres user)
CREATE USER admin WITH PASSWORD 'password';

-- Create the database
CREATE DATABASE subscription_manager;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE subscription_manager TO admin;

-- Connect to the new database
\c subscription_manager

-- Grant schema privileges (if needed)
GRANT ALL ON SCHEMA public TO admin;
```

**Note:** Replace `admin` and `password` with your preferred credentials, and update the `DATABASE_URL` in your `.env` file accordingly.

### 3. Exit PostgreSQL

```sql
\q
```

## Running Prisma Migrations

After setting up the database, you need to run Prisma migrations to create the schema:

```bash
cd backend
npx prisma migrate deploy
# or for development:
npx prisma migrate dev
```

## Optional: Seed the Database

If you have seed data:

```bash
cd backend
npx prisma db seed
```

## Verify Connection

Test the connection using the connection string format:
```
postgresql://admin:password@localhost:5432/subscription_manager
```

You can test it with:
```bash
psql postgresql://admin:password@localhost:5432/subscription_manager
```

## Troubleshooting

### Connection Refused

- Ensure PostgreSQL is running:
  - macOS: `brew services list` (check if postgresql@15 is started)
  - Linux: `sudo systemctl status postgresql`
  - Windows: Check Services panel

### Authentication Failed

- Verify the username and password in your `.env` file match the PostgreSQL user credentials
- Check PostgreSQL's `pg_hba.conf` file if authentication issues persist

### Port Already in Use

- Default PostgreSQL port is 5432
- Check if another service is using it: `lsof -i :5432` (macOS/Linux)
- Change the port in PostgreSQL config or use a different port in your `DATABASE_URL`

### Database Does Not Exist

- Make sure you've created the database using the SQL commands above
- Verify the database name in `DATABASE_URL` matches the created database

## Backup and Restore

### Create Backup

```bash
pg_dump -U admin -d subscription_manager > backup.sql
```

### Restore Backup

```bash
psql -U admin -d subscription_manager < backup.sql
```

## Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Prisma Documentation](https://www.prisma.io/docs)

