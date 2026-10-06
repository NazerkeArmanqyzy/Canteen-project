-- Учебные цены: замените числа на реальные цены столовой.
-- Старые товары сохраняются для существующих заказов, но скрываются из меню.
BEGIN;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
CREATE TEMP TABLE new_menu (name VARCHAR(100), price NUMERIC(10,2), category VARCHAR(30)) ON COMMIT DROP;
INSERT INTO new_menu (name, price, category) VALUES
    ('Bruni', 300, 'chocolate'),
    ('Snickers', 400, 'chocolate'),
    ('Mars', 400, 'chocolate'),
    ('Bounty', 400, 'chocolate'),
    ('Albeni', 350, 'chocolate'),
    ('Twix', 400, 'chocolate'),
    ('KitKat', 400, 'chocolate'),
    ('Ozera', 450, 'chocolate'),
    ('Chicken Sandwich', 850, 'sandwiches'),
    ('Sausage Sandwich', 750, 'sandwiches'),
    ('Chicken Samsa', 500, 'sandwiches'),
    ('Toast', 400, 'sandwiches'),
    ('Egg Toast', 600, 'sandwiches'),
    ('Pepsi', 400, 'juices'),
    ('Maxi Tea', 400, 'juices'),
    ('Apple Juice', 350, 'juices'),
    ('Mojito', 450, 'juices'),
    ('Still Water', 200, 'juices'),
    ('Chips', 500, 'snacks'),
    ('Kirieshki', 250, 'snacks'),
    ('Khrum', 250, 'snacks');
UPDATE products SET is_active = FALSE;
UPDATE products AS p SET category = m.category, is_active = TRUE
FROM new_menu AS m WHERE p.name = m.name;
INSERT INTO products (name, price, category, is_active)
SELECT m.name, m.price, m.category, TRUE FROM new_menu AS m
WHERE NOT EXISTS (SELECT 1 FROM products AS p WHERE p.name = m.name);
COMMIT;
