const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 1. ตั้งค่าการเชื่อมต่อ Database (รองรับทั้ง Render และ Localhost)
const db = mysql.createConnection(process.env.MYSQL_URL ? {
    uri: process.env.MYSQL_URL,
    ssl: { rejectUnauthorized: false } // สำคัญมากสำหรับ TiDB Cloud
} : {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'travel_db'
});

// เช็คการเชื่อมต่อ
db.connect(err => {
    if (err) {
        console.error('❌ Database Connection Error:', err.message);
    } else {
        console.log('✅ Connected to Database successfully');
    }
});

// --- AUTH SYSTEM ---
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    db.query("INSERT INTO users (username, password) VALUES (?, ?)", [username, password], (err) => {
        if (err) {
            console.error(err);
            return res.json({ success: false, message: 'ชื่อผู้ใช้ซ้ำหรือระบบขัดข้อง' });
        }
        res.json({ success: true });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.query("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, results) => {
        // แก้ไข: เพิ่มการเช็ค Error เพื่อไม่ให้ Server ดับ
        if (err) {
            console.error(err);
            return res.json({ success: false, message: 'Database Error' });
        }
        
        if (results.length > 0) {
            res.json({ success: true, user: results[0] });
        } else {
            res.json({ success: false, message: 'ชื่อหรือรหัสผ่านไม่ถูกต้อง' });
        }
    });
});

// --- WALLET & BOOKING ---
app.post('/api/topup', (req, res) => {
    const { userId, amount } = req.body;
    db.query("UPDATE users SET balance = balance + ? WHERE id = ?", [amount, userId], (err) => {
        if (err) return res.json({ success: false, message: 'เติมเงินไม่สำเร็จ' });

        db.query("SELECT balance FROM users WHERE id = ?", [userId], (err, rows) => {
            if (err) return res.json({ success: false });
            res.json({ success: true, newBalance: rows[0].balance });
        });
    });
});

app.post('/api/book', (req, res) => {
    const { userId, tourId, price } = req.body;
    
    // 1. เช็คเงินก่อน
    db.query("SELECT balance FROM users WHERE id = ?", [userId], (err, rows) => {
        if (err) return res.json({ success: false, message: 'เช็คยอดเงินล้มเหลว' });
        if (rows.length === 0) return res.json({ success: false, message: 'ไม่พบผู้ใช้' });
        
        if (rows[0].balance < price) {
            return res.json({ success: false, message: 'เงินไม่พอ!' });
        }
        
        // 2. ตัดเงิน
        db.query("UPDATE users SET balance = balance - ? WHERE id = ?", [price, userId], (err) => {
            if (err) return res.json({ success: false, message: 'ตัดเงินไม่สำเร็จ' });

            // 3. บันทึกการจอง
            db.query("INSERT INTO bookings (user_id, tour_id, amount) VALUES (?, ?, ?)", [userId, tourId, price], (err) => {
                if (err) return res.json({ success: false, message: 'บันทึกการจองไม่สำเร็จ' });
                
                res.json({ success: true, newBalance: rows[0].balance - price });
            });
        });
    });
});

app.get('/api/history/:userId', (req, res) => {
    const sql = `SELECT b.*, t.name as tour_name FROM bookings b 
                 JOIN tours t ON b.tour_id = t.id 
                 WHERE b.user_id = ? ORDER BY b.booking_date DESC`;
    db.query(sql, [req.params.userId], (err, results) => {
        if (err) {
            console.error(err);
            return res.json([]);
        }
        res.json(results);
    });
});

// --- TOURS ---
app.get('/api/tours', (req, res) => {
    db.query("SELECT * FROM tours ORDER BY id DESC", (err, results) => {
        if (err) {
            console.error(err);
            return res.json([]); // ส่งอาเรย์ว่างกลับไปแทน Error
        }
        res.json(results);
    });
});

app.post('/api/tours', (req, res) => {
    const { name, location, price, image_url, description } = req.body;
    db.query("INSERT INTO tours (name, location, price, image_url, description) VALUES (?,?,?,?,?)", 
    [name, location, price, image_url, description], (err) => {
        if (err) return res.json({ success: false, message: 'เพิ่มทัวร์ไม่สำเร็จ' });
        res.json({ success: true });
    });
});

// 2. แก้ไข Port ให้รองรับ Render.com
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server is running on port ${PORT}`);
});