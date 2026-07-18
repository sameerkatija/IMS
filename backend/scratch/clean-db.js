require('../config/env');
const prisma = require('../config/prisma');

async function cleanDatabase() {
  console.log('Connecting to database...');
  try {
    // 1. Get all table names in public schema
    const tables = await prisma.$queryRaw`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename != '_prisma_migrations';
    `;

    if (tables.length === 0) {
      console.log('No tables found to clean.');
      return;
    }

    console.log(`Found ${tables.length} tables to clean.`);

    // 2. Truncate all tables
    // We construct the query string safely since table names are retrieved from pg_tables catalog.
    const tableNames = tables.map(t => `"${t.tablename}"`).join(', ');
    const truncateQuery = `TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`;
    
    console.log('Truncating tables...');
    await prisma.$executeRawUnsafe(truncateQuery);
    console.log('All tables successfully truncated.');

    console.log('--------------------------------------------------');
    console.log('Database successfully cleaned and completely emptied!');
    console.log('--------------------------------------------------');
  } catch (error) {
    console.error('Error cleaning database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDatabase();
