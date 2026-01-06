const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const db = mysql.createConnection(process.env.MYSQL_URL || {
    host: 'localhost',
    user: 'root',
    password: '', 
    database: 'travel_db'
});

// เพิ่มโค้ดดัก Error ไม่ให้ Server ดับ
db.connect(err => {
    if (err) {
        console.error('❌ Database Connection Error:', err.message);
    } else {
        console.log('✅ Connected to Database');
    }
});
// --- AUTH SYSTEM ---
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    db.query("INSERT INTO users (username, password) VALUES (?, ?)", [username, password], (err) => {
        if (err) return res.json({ success: false, message: 'ชื่อผู้ใช้ซ้ำหรือข้อมูลผิดพลาด' });
        res.json({ success: true });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.query("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, results) => {
        if (results.length > 0) res.json({ success: true, user: results[0] });
        else res.json({ success: false, message: 'ชื่อหรือรหัสผ่านไม่ถูกต้อง' });
    });
});

// --- WALLET & BOOKING ---
app.post('/api/topup', (req, res) => {
    const { userId, amount } = req.body;
    db.query("UPDATE users SET balance = balance + ? WHERE id = ?", [amount, userId], () => {
        db.query("SELECT balance FROM users WHERE id = ?", [userId], (err, rows) => {
            res.json({ success: true, newBalance: rows[0].balance });
        });
    });
});

app.post('/api/book', (req, res) => {
    const { userId, tourId, price } = req.body;
    db.query("SELECT balance FROM users WHERE id = ?", [userId], (err, rows) => {
        if (rows[0].balance < price) return res.json({ success: false, message: 'เงินไม่พอ!' });
        
        db.query("UPDATE users SET balance = balance - ? WHERE id = ?", [price, userId], () => {
            db.query("INSERT INTO bookings (user_id, tour_id, amount) VALUES (?, ?, ?)", [userId, tourId, price], () => {
                res.json({ success: true, newBalance: rows[0].balance - price });
            });
        });
    });
});

app.get('/api/history/:userId', (req, res) => {
    const sql = `SELECT b.*, t.name as tour_name FROM bookings b 
                 JOIN tours t ON b.tour_id = t.id 
                 WHERE b.user_id = ? ORDER BY b.booking_date DESC`;
    db.query(sql, [req.params.userId], (err, results) => res.json(results));
});

// --- TOURS ---
app.get('/api/tours', (req, res) => {
    db.query("SELECT * FROM tours ORDER BY id DESC", (err, results) => res.json(results));
});

app.post('/api/tours', (req, res) => {
    const { name, location, price, image_url, description } = req.body;
    db.query("INSERT INTO tours (name, location, price, image_url, description) VALUES (?,?,?,?,?)", 
    [name, location, price, image_url, description], () => res.json({ success: true }));
});

app.listen(3000, () => console.log('✅ Server: http://localhost:3000'));