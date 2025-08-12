# PostgreSQL Integration Guide

## Overview
This project is configured to use PostgreSQL as the primary database. The setup includes Docker for easy development and production deployment.

## Prerequisites
- Docker and Docker Compose installed
- Node.js 18+ and npm
- Git

## Quick Start

### 1. Environment Setup
Create a `.env` file in the project root with the following variables:

```env
# Database Configuration
DATABASE_URL="postgresql://nexus_user:nexus_password@localhost:5432/nexus_reussite?schema=public"
POSTGRES_USER=nexus_user
POSTGRES_PASSWORD=nexus_password
POSTGRES_DB=nexus_reussite
DATABASE_PASSWORD=nexus_password

# Other required environment variables...
# (See env.example for complete list)
```

### 2. Install Dependencies
```bash
npm install
npm install pg @types/pg
```

### 3. Start PostgreSQL Database
```bash
# Start PostgreSQL container
npm run docker:up

# Or manually:
docker-compose up postgres-db -d
```

### 4. Database Setup
```bash
# Generate Prisma client
npm run db:generate

# Create and apply migrations
npm run db:migrate

# Seed database (if seed file exists)
npm run db:seed
```

### 5. Test Connection
```bash
npm run db:test
```

## Available Commands

### Database Commands
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Create and apply migrations
- `npm run db:migrate:deploy` - Deploy migrations to production
- `npm run db:seed` - Seed database with initial data
- `npm run db:studio` - Open Prisma Studio (database GUI)
- `npm run db:test` - Test database connection

### Docker Commands
- `npm run docker:up` - Start all services
- `npm run docker:down` - Stop all services
- `npm run docker:logs` - View service logs

## Database Schema

The database includes the following main entities:
- **Users** - Authentication and user management
- **Students** - Student profiles and data
- **Coaches** - Coach profiles and expertise
- **Sessions** - Tutoring sessions and scheduling
- **Subscriptions** - Subscription management
- **Payments** - Payment processing
- **Messages** - Chat functionality
- **AriaConversations** - AI assistant conversations

## Development Workflow

### Making Schema Changes
1. Modify `prisma/schema.prisma`
2. Generate migration: `npm run db:migrate`
3. Test changes locally
4. Deploy to production: `npm run db:migrate:deploy`

### Database Access
- **Prisma Studio**: `npm run db:studio` (opens at http://localhost:5555)
- **Direct Connection**: Use any PostgreSQL client with the DATABASE_URL

## Production Deployment

### Environment Variables
For production, ensure these variables are set:
- `DATABASE_URL` - Production PostgreSQL connection string
- `NODE_ENV=production`
- All other required environment variables

### Database Migration
```bash
npm run db:migrate:deploy
```

### Health Checks
The application includes database health checks in the `/api/health` endpoint.

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Ensure PostgreSQL container is running: `docker-compose ps`
   - Check container logs: `npm run docker:logs`

2. **Migration Errors**
   - Reset database: `npx prisma migrate reset`
   - Check schema syntax: `npx prisma validate`

3. **Permission Issues**
   - Ensure proper database user permissions
   - Check DATABASE_URL format

### Useful Commands
```bash
# View database logs
docker-compose logs postgres-db

# Access PostgreSQL shell
docker-compose exec postgres-db psql -U nexus_user -d nexus_reussite

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Validate schema
npx prisma validate
```

## Security Considerations

1. **Environment Variables**: Never commit `.env` files
2. **Database Passwords**: Use strong, unique passwords
3. **Connection Security**: Use SSL in production
4. **Access Control**: Limit database access to application only

## Performance Optimization

1. **Connection Pooling**: Prisma handles connection pooling automatically
2. **Indexes**: Add indexes for frequently queried fields
3. **Query Optimization**: Use Prisma's query optimization features
4. **Monitoring**: Monitor database performance in production

## Backup and Recovery

### Backup
```bash
# Create database backup
docker-compose exec postgres-db pg_dump -U nexus_user nexus_reussite > backup.sql
```

### Restore
```bash
# Restore from backup
docker-compose exec -T postgres-db psql -U nexus_user nexus_reussite < backup.sql
```

## Support

For database-related issues:
1. Check the troubleshooting section above
2. Review Prisma documentation: https://www.prisma.io/docs
3. Check PostgreSQL logs: `npm run docker:logs` 