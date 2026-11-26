export default `CREATE TABLE IF NOT EXISTS users (
 id BIGSERIAL PRIMARY KEY, username VARCHAR(80) UNIQUE NOT NULL, email VARCHAR(254) UNIQUE, password_hash TEXT NOT NULL,
 role VARCHAR(20) NOT NULL DEFAULT 'admin', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(254);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(LOWER(email)) WHERE email IS NOT NULL;
CREATE TABLE IF NOT EXISTS categories (
 id BIGSERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL, image_url TEXT, sort_order INT NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS products (
 id BIGSERIAL PRIMARY KEY, category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
 name VARCHAR(200) NOT NULL, description TEXT NOT NULL DEFAULT '', price NUMERIC(12,2) NOT NULL CHECK(price >= 0),
 old_price NUMERIC(12,2), featured BOOLEAN NOT NULL DEFAULT FALSE, active BOOLEAN NOT NULL DEFAULT TRUE,
 stock INT NOT NULL DEFAULT 0 CHECK(stock >= 0), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS product_images (
 id BIGSERIAL PRIMARY KEY, product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 image_url TEXT NOT NULL, sort_order INT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS product_variants (
 id BIGSERIAL PRIMARY KEY, product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 size VARCHAR(40), color VARCHAR(60), stock INT NOT NULL DEFAULT 0 CHECK(stock >= 0), active BOOLEAN NOT NULL DEFAULT TRUE,
 UNIQUE(product_id, size, color)
);
CREATE TABLE IF NOT EXISTS customers (
 id BIGSERIAL PRIMARY KEY, name VARCHAR(160) NOT NULL, phone VARCHAR(40) NOT NULL,
 governorate VARCHAR(100), city VARCHAR(100), address TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS orders (
 id BIGSERIAL PRIMARY KEY, order_code VARCHAR(40) UNIQUE NOT NULL, customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'new', subtotal NUMERIC(12,2) NOT NULL, delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
 total NUMERIC(12,2) NOT NULL, whatsapp_sent BOOLEAN NOT NULL DEFAULT FALSE,
 inventory_deducted BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS order_items (
 id BIGSERIAL PRIMARY KEY, order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 product_id BIGINT REFERENCES products(id) ON DELETE SET NULL, product_name VARCHAR(200) NOT NULL, product_description TEXT NOT NULL DEFAULT '',
 unit_price NUMERIC(12,2) NOT NULL, quantity INT NOT NULL CHECK(quantity > 0), size VARCHAR(40), color VARCHAR(60),
 variant_id BIGINT REFERENCES product_variants(id) ON DELETE SET NULL, line_total NUMERIC(12,2) NOT NULL
);
CREATE TABLE IF NOT EXISTS inventory (
 id BIGSERIAL PRIMARY KEY,
 product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
 variant_id BIGINT REFERENCES product_variants(id) ON DELETE SET NULL,
 order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
 product_name VARCHAR(200) NOT NULL,
 size VARCHAR(40), color VARCHAR(60),
 quantity_change INT NOT NULL,
 reason VARCHAR(40) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS settings (key VARCHAR(100) PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS login_attempts (
 username VARCHAR(80) PRIMARY KEY, failed_count INT NOT NULL DEFAULT 0,
 blocked_until TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_deducted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id BIGINT REFERENCES product_variants(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_description TEXT NOT NULL DEFAULT '';
INSERT INTO settings(key,value) VALUES ('store_name','هاي بي ستور'),('whatsapp_number','967781240044'),('currency','ر.ي'),('delivery_fee','0') ON CONFLICT(key) DO NOTHING;
CREATE INDEX IF NOT EXISTS idx_products_active_created ON products(active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_active ON product_variants(product_id, active);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id, order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_created ON inventory(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS uploads (
 name VARCHAR(120) PRIMARY KEY, mime VARCHAR(60) NOT NULL, data BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;
