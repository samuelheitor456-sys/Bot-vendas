const db = require('../database/db');

async function isAdmin(member) {
  return new Promise((resolve) => {
    db.get(`SELECT value FROM config WHERE key = 'admin_role_id'`, (err, row) => {
      if (err || !row || !row.value) {
        resolve(false);
      } else {
        const adminRoleId = row.value;
        resolve(member.roles.cache.has(adminRoleId));
      }
    });
  });
}

module.exports = { isAdmin };
