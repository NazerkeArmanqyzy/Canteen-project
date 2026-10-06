import "dotenv/config";
import { readFile } from "node:fs/promises";
import pool from "./db.js";

// Запускать из Backend: node update-menu.js
const client = await pool.connect();
try {
    const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
    const menu = await readFile(new URL("./menu.sql", import.meta.url), "utf8");
    await client.query(schema);
    await client.query(menu);
    console.log("Menu updated: 21 products. Prices for new products are examples.");
} catch (error) {
    await client.query("ROLLBACK");
    console.error("Could not update menu:", error.message);
    process.exitCode = 1;
} finally {
    client.release();
    await pool.end();
}
