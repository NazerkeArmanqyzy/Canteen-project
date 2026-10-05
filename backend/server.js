import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pool from "./db.js";

const app = express();
const port = Number(process.env.PORT) || 3000;
const backendDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(backendDirectory, "../frontend");
const assetsDirectory = path.resolve(backendDirectory, "../assets");

app.use(cors());
app.use(express.json());

app.use(function (error, req, res, next) {
    if (error instanceof SyntaxError && "body" in error) {
        return res.status(400).json({
            message: "Request body must contain valid JSON."
        });
    }

    next(error);
});

app.use(express.static(frontendDirectory));
app.use("/assets", express.static(assetsDirectory));

// День 1: проверка сервера
app.get("/health", function (req, res) {
    res.json({
        message: "Server is working."
    });
});

// День 2: получение меню из базы
app.get("/products", async function (req, res) {
    try {
        const result = await pool.query(`
            SELECT id, name, price, category
            FROM products
            ORDER BY id
        `);

        const products = result.rows.map(function (product) {
            return {
                id: product.id,
                name: product.name,
                price: Number(product.price),
                category: product.category
            };
        });

        res.json(products);
    } catch (error) {
        console.error(error.message);

        res.status(500).json({
            message: "Could not load products."
        });
    }
});

// День 4: проверка заказа, расчёт total и transaction
app.post("/orders", async function (req, res) {
    let client;
    let transactionStarted = false;

    try {
        const { name, group, items } = req.body || {};

        // Проверка данных
        if (
            typeof name !== "string" ||
            !name.trim() ||
            name.trim().length > 100 ||
            typeof group !== "string" ||
            !group.trim() ||
            group.trim().length > 50 ||
            !Array.isArray(items) ||
            items.length === 0
        ) {
            return res.status(400).json({
                message: "Name, group and items are required."
            });
        }

        for (const item of items) {
            if (
                !item ||
                !Number.isInteger(item.product_id) ||
                item.product_id <= 0 ||
                item.product_id > 2147483647 ||
                !Number.isInteger(item.quantity) ||
                item.quantity <= 0 ||
                item.quantity > 100
            ) {
                return res.status(400).json({
                    message: "Invalid product_id or quantity."
                });
            }
        }

        client = await pool.connect();

        // Начинаем transaction
        await client.query("BEGIN");
        transactionStarted = true;

        let total = 0;

        // Создаём order
        const orderResult = await client.query(
            `
                INSERT INTO orders (
                    customer_name,
                    student_group
                )
                VALUES ($1, $2)
                RETURNING *
            `,
            [name.trim(), group.trim()]
        );

        const order = orderResult.rows[0];

        // Создаём order items
        for (const item of items) {
            const productResult = await client.query(
                "SELECT price FROM products WHERE id = $1",
                [item.product_id]
            );

            if (productResult.rows.length === 0) {
                const error = new Error("One or more products do not exist.");
                error.statusCode = 400;
                throw error;
            }

            const price = Number(productResult.rows[0].price);

            total += price * item.quantity;

            await client.query(
                `
                    INSERT INTO order_items (
                        order_id,
                        product_id,
                        quantity,
                        price
                    )
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

        // Всё успешно — сохраняем transaction
        await client.query("COMMIT");
        transactionStarted = false;

        res.status(201).json({
            message: "Order created.",
            order: order,
            total: total
        });

    } catch (error) {
        // Если произошла ошибка — отменяем всё
        if (transactionStarted) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Could not roll back order:", rollbackError.message);
            }
        }

        console.error(error.message);

        const status = error.statusCode || 500;

        res.status(status).json({
            message: status === 400
                ? error.message
                : "Could not save order."
        });

    } finally {
        // Возвращаем connection обратно в pool
        if (client) {
            client.release();
        }
    }
});

app.use(function (req, res) {
    res.status(404).json({
        message: "Route not found."
    });
});

app.listen(port, function () {
    console.log(`Server running at http://localhost:${port}`);
});
