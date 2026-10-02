import "dotenv/config";
import express from "express";
import cors from "cors";
import pool from "./db.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

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

// День 3: сохранение тестового заказа
app.post("/orders", async function (req, res) {
    try {
        const { name, group, items } = req.body;

        const orderResult = await pool.query(
            `
                INSERT INTO orders (
                    customer_name,
                    student_group
                )
                VALUES ($1, $2)
                RETURNING *
            `,
            [name, group]
        );

        const order = orderResult.rows[0];

        for (const item of items) {
            const productResult = await pool.query(
                "SELECT price FROM products WHERE id = $1",
                [item.product_id]
            );

            const price = productResult.rows[0].price;

            await pool.query(
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

        res.status(201).json({
            message: "Order created.",
            order: order
        });
    } catch (error) {
        console.error(error.message);

        res.status(500).json({
            message: "Could not save order."
        });
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
