import http from "http";
import pool from "./db.js";

const server = http.createServer(async (req, res) => {

    // GET products
    if (req.method === "GET" && req.url === "/product") {

        const result = await pool.query("SELECT * FROM products");

        res.writeHead(200, {
            "Content-Type": "application/json"
        });

        res.end(JSON.stringify(result.rows));
    }


    // POST order
    if (req.method === "POST" && req.url === "/orders") {

        let body = "";

        req.on("data", chunk => {
            body += chunk;
        });

        req.on("end", async () => {

            try {

                const data = JSON.parse(body);

                const userId = data.user_id;
                const items = data.items;

                const orderResult = await pool.query(
                    "INSERT INTO orders (user_id) VALUES ($1) RETURNING *",
                    [userId]
                );

                const order = orderResult.rows[0];

                for (const item of items) {

                    const productResult = await pool.query(
                        "SELECT price FROM products WHERE id = $1",
                        [item.product_id]
                    );

                    const price = productResult.rows[0].price;

                    await pool.query(
                        `INSERT INTO order_items
                        (order_id, product_id, quantity, price)
                        VALUES ($1, $2, $3, $4)`,
                        [
                            order.id,
                            item.product_id,
                            item.quantity,
                            price
                        ]
                    );
                }

                res.writeHead(201, {
                    "Content-Type": "application/json"
                });

                res.end(JSON.stringify({
                    message: "Order created",
                    order: order
                }));

            } catch (error) {

                console.log(error);

                res.writeHead(500, {
                    "Content-Type": "application/json"
                });

                res.end(JSON.stringify({
                    message: "Something went wrong",
                    error: error.message
                }));
            }

        });
    }

});

server.listen(3000, () => {
    console.log("Server running on port 3000");
});