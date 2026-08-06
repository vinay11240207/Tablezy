-- Generated from CAROLINA Lounge.xlsx
BEGIN;

CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mobile_number TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    total_points INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price NUMERIC(12,2) NOT NULL,
    image_url TEXT NOT NULL DEFAULT '',
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS rewards (
    id TEXT PRIMARY KEY,
    reward_name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    points_required INTEGER NOT NULL,
    reward_type TEXT NOT NULL,
    menu_item_id TEXT,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    table_number TEXT NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL,
    tax_amount NUMERIC(12,2) NOT NULL,
    discount_amount NUMERIC(12,2) NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL,
    order_status TEXT NOT NULL,
    points_earned INTEGER NOT NULL DEFAULT 0,
    points_redeemed INTEGER NOT NULL DEFAULT 0,
    reward_id TEXT,
    reward_name TEXT,
    items JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    order_id TEXT,
    transaction_type TEXT NOT NULL,
    points INTEGER NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS redemptions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    reward_id TEXT NOT NULL,
    reward_name TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

TRUNCATE TABLE redemptions, loyalty_transactions, orders, rewards, menu_items, categories, customers, admins RESTART IDENTITY;

INSERT INTO categories (id, name, is_active, created_at) VALUES
('99800cd0-2c64-4be5-989d-268468d4bc5c', 'soups', TRUE, NOW()),
('8cbd8066-30f2-4471-b5c9-afdfbfc32210', 'salads', TRUE, NOW()),
('4e0d4497-b827-4bea-8848-d25509cacc3e', 'appetizers veg', TRUE, NOW()),
('b85ec4a2-e9db-4320-b1d9-f12426c358ef', 'Carolina Platter', TRUE, NOW()),
('7f64dd35-ad9d-4e9d-8d1d-0920ecb4d31f', 'Burgers', TRUE, NOW()),
('338704c7-c868-4d9f-927c-f641e6ae2e11', 'Carolina Sandwich', TRUE, NOW()),
('e6a8c1a5-539a-44b4-8a1f-fa08f596d6ce', 'Pizza', TRUE, NOW()),
('439614e7-8440-4eea-b792-57c8513a68f4', 'Pasta', TRUE, NOW()),
('a9171841-08f6-40d5-931f-0608fddfe286', 'Garden Green Mains', TRUE, NOW()),
('b0acb10c-9b13-4bce-8dc2-c7abbef6ffda', 'Rice', TRUE, NOW()),
('56c1c7e3-186d-43e9-a044-c78e4d592277', 'Raita & Curd', TRUE, NOW()),
('9f4184be-6aba-4d0a-a43a-a65435dbcdda', 'Pancakes & Waffles', TRUE, NOW()),
('6ebf8df2-372b-4dfd-8f35-7384cf57149b', 'Dessert', TRUE, NOW());

INSERT INTO menu_items (id, category_id, name, description, price, image_url, is_available, created_at, updated_at) VALUES
('2c0a5693-8ab1-4dd6-a30e-1e9de17362d4', '99800cd0-2c64-4be5-989d-268468d4bc5c', 'manchow soup', '', 245.00, '', TRUE, NOW(), NOW()),
('e6bdc9c5-88e5-460e-b9de-b5b69594c2d4', '8cbd8066-30f2-4471-b5c9-afdfbfc32210', 'spinach and chickpea feta salad', '', 325.00, '', TRUE, NOW(), NOW()),
('deca4cf5-c75f-43ec-a10f-316925c828fa', '4e0d4497-b827-4bea-8848-d25509cacc3e', 'Falafel Pita Pocket', '', 395.00, '', TRUE, NOW(), NOW()),
('ed1d5214-5bc0-45ed-9b19-5fc3fdb5febc', 'b85ec4a2-e9db-4320-b1d9-f12426c358ef', 'Mezze Platter Veg', '', 795.00, '', TRUE, NOW(), NOW()),
('aceb2319-1be6-410d-b45f-050ad4245081', '7f64dd35-ad9d-4e9d-8d1d-0920ecb4d31f', 'Potato And Peas Burger', '', 195.00, '', TRUE, NOW(), NOW()),
('409ab1c5-1713-40c2-a52d-ddec4290a878', '338704c7-c868-4d9f-927c-f641e6ae2e11', 'Tomato & Cheese Sandwich', '', 175.00, '', TRUE, NOW(), NOW()),
('7b676ccc-749b-479f-a3c5-a973eafa91cc', 'e6a8c1a5-539a-44b4-8a1f-fa08f596d6ce', 'Classic Margherita', '', 535.00, '', TRUE, NOW(), NOW()),
('197bf324-99fa-4a89-8c52-3c3b8902c809', '439614e7-8440-4eea-b792-57c8513a68f4', 'Spaghetti Arrabiata', '', 495.00, '', TRUE, NOW(), NOW()),
('aa2d1b9b-da4d-43e4-af38-ef84d2268e69', 'a9171841-08f6-40d5-931f-0608fddfe286', 'Roasted Veg Pot Pie', '', 475.00, '', TRUE, NOW(), NOW()),
('22ad7851-8a29-449c-bbaa-32df30fda779', 'b0acb10c-9b13-4bce-8dc2-c7abbef6ffda', 'Steamed Rice', '', 195.00, '', TRUE, NOW(), NOW()),
('1e162c11-1b49-431c-b85d-949967f7d1c7', '56c1c7e3-186d-43e9-a044-c78e4d592277', 'Butter Milk', '', 95.00, '', TRUE, NOW(), NOW()),
('f4f99a47-2e4f-47f2-823d-df0c48103c7e', '9f4184be-6aba-4d0a-a43a-a65435dbcdda', 'Classic with Maple & Cream', '', 225.00, '', TRUE, NOW(), NOW()),
('6d079e70-472e-4d59-b900-ca8656fc6a76', '6ebf8df2-372b-4dfd-8f35-7384cf57149b', 'Gulab Jamun', '', 195.00, '', TRUE, NOW(), NOW());

INSERT INTO admins (id, name, email, password_hash, role, created_at, updated_at) VALUES
('0f4b2c31-b4c8-4f95-9098-4fd48868f8f8', 'Cafe Owner', 'admin@carolinalounge.com', '$2b$12$HK6UwnIL.4De3EmyicdW2uFVc9cDTAMTWTiYnZs4BOoCKet8jhTJy', 'admin', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

COMMIT;