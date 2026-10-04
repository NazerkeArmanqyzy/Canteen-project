import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool();

pool.on("error", function (error) {
    console.error("Database error:", error.message);
});

export default pool;
