import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    user: "adin",
    host: "localhost",
    database: "canteen_shop",
    port: 5432
});

export default pool;