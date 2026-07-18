const Express = require('express');
const router = Express.Router();
const authorize = require('../middlewares/authorize-role');
const { generateBackup } = require('../config/backup-db');
const fs = require('fs');
const path = require('path');

router.get('/backup', authorize('ADMIN'), async (req, res, next) => {
  try {
    const sql = await generateBackup();
    
    // Save a copy on the server for system recovery
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.sql`;
    const filePath = path.join(backupDir, filename);
    fs.writeFileSync(filePath, sql, 'utf8');

    // Stream/Send to client browser for direct download
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(sql);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
