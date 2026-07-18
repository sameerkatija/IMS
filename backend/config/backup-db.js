const fs = require('fs');
const path = require('path');
require('./env'); // Make sure environment is loaded
const prisma = require('./prisma');

// Helper to format JavaScript values into safe SQL values for insertion
function formatValue(val) {
  if (val === null || val === undefined) {
    return 'NULL';
  }
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false';
  }
  if (typeof val === 'number') {
    return val.toString();
  }
  if (val instanceof Date) {
    return `'${val.toISOString()}'`;
  }
  // Handle Prisma Decimal or similar objects that serialize to strings
  if (typeof val === 'object' && val.constructor && (val.constructor.name === 'Decimal' || val.d)) {
    return val.toString();
  }
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  }
  // String escaping
  return `'${val.toString().replace(/'/g, "''")}'`;
}

async function generateBackup() {
  console.log('Generating database backup...');
  try {
    // 1. Get all user tables in public schema (excluding Prisma migrations)
    const tables = await prisma.$queryRaw`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename != '_prisma_migrations';
    `;

    if (tables.length === 0) {
      throw new Error('No tables found in the database.');
    }

    const sqlParts = [];
    sqlParts.push('-- Sameer Distributors IMS Database Backup');
    sqlParts.push(`-- Generated at: ${new Date().toISOString()}`);
    sqlParts.push('-- Disable constraint triggers temporarily\n');
    sqlParts.push('SET session_replication_role = \'replica\';\n');

    // Truncate all tables at the start of restoring
    const tableNames = tables.map(t => `"${t.tablename}"`).join(', ');
    sqlParts.push('-- Clean existing data before inserting');
    sqlParts.push(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;\n`);

    // 2. Fetch and insert data for each table
    for (const t of tables) {
      const tableName = t.tablename;
      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "${tableName}"`);
      
      sqlParts.push(`-- ==========================================`);
      sqlParts.push(`-- Table: ${tableName}`);
      sqlParts.push(`-- ==========================================`);
      
      if (rows.length === 0) {
        sqlParts.push(`-- No data for table ${tableName}\n`);
        continue;
      }

      for (const row of rows) {
        const columns = Object.keys(row);
        const colNamesStr = columns.map(c => `"${c}"`).join(', ');
        const valuesStr = columns.map(c => formatValue(row[c])).join(', ');
        sqlParts.push(`INSERT INTO "${tableName}" (${colNamesStr}) VALUES (${valuesStr});`);
      }

      // Reset autoincrement sequence for this table to prevent duplicate key errors later
      sqlParts.push(`\n-- Reset identity sequence for ${tableName}`);
      sqlParts.push(`SELECT setval(pg_get_serial_sequence('public."${tableName}"', 'id'), COALESCE(max(id), 1)) FROM "${tableName}";\n`);
    }

    sqlParts.push('SET session_replication_role = \'origin\';');

    return sqlParts.join('\n');
  } catch (error) {
    console.error('Failed to generate backup:', error);
    throw error;
  }
}

// Support running directly from command line
if (require.main === module) {
  (async () => {
    try {
      const sql = await generateBackup();
      const backupDir = path.join(__dirname, '../backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup-${timestamp}.sql`;
      const filePath = path.join(backupDir, filename);
      
      fs.writeFileSync(filePath, sql, 'utf8');
      console.log(`Backup successfully saved to ${filePath}`);
      await prisma.$disconnect();
    } catch (err) {
      console.error('Backup CLI execution failed:', err);
      process.exit(1);
    }
  })();
}

module.exports = {
  generateBackup,
};
