import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pool from "./db.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

const backendDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(backendDirectory, "../Frontend");
const assetsDirectory = path.resolve(backendDirectory, "../assets");

app.use(cors());
app.use(express.json());

app.use(express.static(frontendDirectory));
app.use("/assets", express.static(assetsDirectory));

// Проверка сервера
app.get("/health", function (req, res) {
    res.json({
        message: "Server is working."
    });
});

// Получить товары
app.get("/products", async function (req, res) {
    try {
        const result = await pool.query(`
            SELECT id, name, price, category
            FROM products
            WHERE is_active = TRUE
            ORDER BY id
        `);

        res.json(result.rows);
    } catch (error) {
        console.error(error.message);

        res.status(500).json({
            message: "Could not load products."
        });
    }
});

// Создать заказ
app.post("/orders", async function (req, res) {
    const { name, group, items } = req.body;

    if (!name || !group || !items || items.length === 0) {
        return res.status(400).json({
            message: "Name, group and items are required."
        });
    }

    const client = await pool.connect();

    try {
        // Начинаем transaction
        await client.query("BEGIN");

        // Создаём заказ
        const orderResult = await client.query(
            `
            INSERT INTO orders (customer_name, student_group)
            VALUES ($1, $2)
            RETURNING *
            `,
            [name, group]
        );

        const order = orderResult.rows[0];

        let total = 0;

        // Добавляем товары заказа
        for (const item of items) {
            const productResult = await client.query(
                `
                SELECT price
                FROM products
                WHERE id = $1 AND is_active = TRUE
                `,
                [item.product_id]
            );

            if (productResult.rows.length === 0) {
                throw new Error("Product not found.");
            }

            const price = Number(productResult.rows[0].price);

            total += price * item.quantity;

            await client.query(
                `
                INSERT INTO order_items
                (order_id, product_id, quantity, price)
                VALUES ($1, $2, $3, $4)
                `,
                [
                    order.id,
                    item.product_id,
                    item.quantity,
                    price
                ]
            );
        }

        // Сохраняем transaction
        await client.query("COMMIT");

        res.status(201).json({
            message: "Order created.",
            order: order,
            total: total
        });

    } catch (error) {
        // Отменяем transaction при ошибке
        await client.query("ROLLBACK");

        console.error(error.message);

        res.status(500).json({
            message: "Could not save order."
        });

    } finally {
        client.release();
    }
});

// Если такого route нет
app.use(function (req, res) {
    res.status(404).json({
        message: "Route not found."
    });
});

app.listen(port, function () {
    console.log(`Server running at http://localhost:${port}`);
});