CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE
);
INSERT INTO users (username, email) VALUES ('alice_smith', 'alice@example.com');

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock INTEGER DEFAULT 0
);

INSERT INTO products (name, description, price, stock) VALUES
('Laptop', 'Ein leistungsstarkes Notebook zum Arbeiten', 1200.50, 15),
('Smartphone', 'Neues Handy mit cooler Kamera', 799.00, 42),
('Kaffeemaschine', 'Macht dich morgens wach', 120.90, 8);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    total_price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

INSERT INTO orders (user_id, status, total_price) VALUES
(1, 'completed', 1200.50),
(1, 'completed', 120.90);
