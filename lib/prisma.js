const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const isDev = process.env.NODE_ENV !== 'production';

// Connection pool with optimized settings
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

const adapter = new PrismaPg(pool, { schema: 'final' });
const prisma = new PrismaClient({
    adapter,
    log: isDev
        ? [
            { level: 'query', emit: 'event' },
            { level: 'warn', emit: 'stdout' },
            { level: 'error', emit: 'stdout' },
        ]
        : [{ level: 'error', emit: 'stdout' }],
});

if (isDev) {
    prisma.$on('query', (e) => {
        if (e.duration > 100) {
            console.warn(`Slow query (${e.duration}ms):`, e.query);
        }
    });
}

module.exports = prisma;

