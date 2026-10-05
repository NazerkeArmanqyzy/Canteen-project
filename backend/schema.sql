CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    category VARCHAR(30) NOT NULL
);

-- Миграция для уже существующей таблицы products из ранней версии.
-- CREATE TABLE IF NOT EXISTS не добавляет новые столбцы в созданную ранее таблицу.
ALTER TABLE products
ADD COLUMN IF NOT EXISTS category VARCHAR(30);

UPDATE products
SET category = 'chocolate'
WHERE category IS NULL;

ALTER TABLE products
ALTER COLUMN category SET NOT NULL;

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    student_group VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Миграция для ранней версии orders, где были только user_id и status.
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(100);

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS student_group VARCHAR(50);

UPDATE orders
SET
    customer_name = COALESCE(NULLIF(customer_name, ''), 'Unknown'),
    student_group = COALESCE(NULLIF(student_group, ''), 'Unknown')
WHERE customer_name IS NULL
   OR customer_name = ''
   OR student_group IS NULL
   OR student_group = '';

ALTER TABLE orders
ALTER COLUMN customer_name SET NOT NULL;

ALTER TABLE orders
ALTER COLUMN student_group SET NOT NULL;

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price NUMERIC(10, 2) NOT NULL
);

INSERT INTO products (name, price, category)
SELECT name, price, category
FROM (
    VALUES
        ('Milk Chocolate', 450, 'chocolate'),
        ('Apple Juice', 350, 'juices'),
        ('Chicken Sandwich', 850, 'sandwiches'),
        ('Popcorn', 400, 'snacks'),
        ('Cheese Toast', 600, 'sandwiches'),
        ('Orange Juice', 350, 'juices'),
        ('Dark Chocolate', 500, 'chocolate'),
        ('Salted Pretzels', 300, 'snacks'),
        ('Cheese Sandwich', 700, 'sandwiches')
) AS menu(name, price, category)
WHERE NOT EXISTS (SELECT 1 FROM products);
