const mysql = require("mysql2/promise");

// 항상 TiDB Cloud 사용 (로컬/배포 동일)
const pool = mysql.createPool({
  host: "gateway01.ap-northeast-1.prod.aws.tidbcloud.com",
  port: 4000,
  user: "45atdVBT8Ys1E4V.root",
  password: "ZqPTyInJSLJ9q08E",
  database: "test",
  waitForConnections: true,
  connectionLimit: 10,
  ssl: { rejectUnauthorized: true },
});

module.exports = pool;
  