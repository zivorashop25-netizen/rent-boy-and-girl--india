const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");

const app = express();

const PORT = process.env.PORT || 3000;
const REGISTRATION_FEE = 499;
const UPI_ID = process.env.UPI_ID || "8822627454-3@ybl";
const UPI_NAME = process.env.UPI_NAME || "Rent Friend India";
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const publicDir = path.join(__dirname, "public");
const uploadDir = path.join(publicDir, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(express.static(publicDir));

/* =========================
   DATABASE
========================= */

const db = new Database(path.join(__dirname, "app.db"));

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  age INTEGER NOT NULL,
  city TEXT NOT NULL,
  gender TEXT NOT NULL,
  bio TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  role TEXT DEFAULT 'user',
  verified INTEGER DEFAULT 0,
  active INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  utr TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);


/* =========================
   AUTH HELPERS
========================= */

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function auth(req, res, next) {
  const token = req.cookies.auth;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Login required"
    });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Session expired"
    });
  }
}

function adminAuth(req, res, next) {
  const token = req.cookies.admin_auth;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Admin login required"
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required"
      });
    }

    req.admin = decoded;
    next();

  } catch {
    return res.status(401).json({
      success: false,
      message: "Admin session expired"
    });
  }
}


/* =========================
   HEALTH
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Rent Friend India server is running"
  });
});


/* =========================
   PAYMENT INFO
========================= */

app.get("/api/payment-info", async (req, res) => {
  try {

    const upiLink =
      "upi://pay" +
      "?pa=" + encodeURIComponent(UPI_ID) +
      "&pn=" + encodeURIComponent(UPI_NAME) +
      "&am=" + encodeURIComponent(REGISTRATION_FEE) +
      "&cu=INR";

    const qr = await QRCode.toDataURL(upiLink);

    res.json({
      success: true,
      amount: REGISTRATION_FEE,
      upi_id: UPI_ID,
      upi_name: UPI_NAME,
      qr: qr,
      upi_link: upiLink
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Payment information failed"
    });
  }
});


/* =========================
   REGISTER
   PAYMENT REQUIRED AFTER
========================= */

app.post("/api/register", async (req, res) => {

  try {

    const {
      name,
      phone,
      email,
      password,
      age,
      city,
      gender,
      bio
    } = req.body;

    if (
      !name ||
      !phone ||
      !email ||
      !password ||
      !age ||
      !city ||
      !gender
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields"
      });
    }

    if (Number(age) < 18) {
      return res.status(400).json({
        success: false,
        message: "You must be 18 or older"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    const existing = db.prepare(
      "SELECT id FROM users WHERE email = ?"
    ).get(email.toLowerCase());

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Email already registered. Please login."
      });
    }

    const passwordHash =
      await bcrypt.hash(password, 10);

    const result = db.prepare(`
      INSERT INTO users
      (name, phone, email, password_hash, age, city, gender, bio, verified, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `).run(
      name.trim(),
      phone.trim(),
      email.toLowerCase().trim(),
      passwordHash,
      Number(age),
      city.trim(),
      gender,
      bio || ""
    );

    const user = db.prepare(
      "SELECT * FROM users WHERE id = ?"
    ).get(result.lastInsertRowid);

    const token = createToken(user);

    res.cookie("auth", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      payment_required: true,
      message: "Account details saved. Please complete ₹499 payment.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        verified: false,
        active: false
      }
    });

  } catch (error) {

    console.error("REGISTER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Registration failed"
    });
  }
});


/* =========================
   LOGIN
========================= */

app.post("/api/login", async (req, res) => {

  try {

    const { email, password } = req.body;

    const user = db.prepare(
      "SELECT * FROM users WHERE email = ?"
    ).get(
      String(email || "").toLowerCase().trim()
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const valid =
      await bcrypt.compare(
        password,
        user.password_hash
      );

    if (!valid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const token = createToken(user);

    res.cookie("auth", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        verified: !!user.verified,
        active: !!user.active
      }
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
});


/* =========================
   LOGOUT
========================= */

app.post("/api/logout", (req, res) => {

  res.clearCookie("auth");

  res.json({
    success: true
  });
});


/* =========================
   CURRENT USER
========================= */

app.get("/api/me", auth, (req, res) => {

  const user = db.prepare(`
    SELECT
      id,
      name,
      phone,
      email,
      age,
      city,
      gender,
      bio,
      photo_url,
      role,
      verified,
      active,
      created_at
    FROM users
    WHERE id = ?
  `).get(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  }

  res.json({
    success: true,
    user: {
      ...user,
      verified: !!user.verified,
      active: !!user.active
    }
  });
});


/* =========================
   PAYMENT SUBMIT
========================= */

app.post("/api/payment/submit", auth, (req, res) => {

  try {

    const utr = String(
      req.body.utr || ""
    ).trim();

    if (!utr || utr.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid UTR / Transaction ID"
      });
    }

    const user = db.prepare(
      "SELECT id FROM users WHERE id = ?"
    ).get(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const existing = db.prepare(`
      SELECT id
      FROM payments
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(req.user.id);

    if (existing) {

      db.prepare(`
        UPDATE payments
        SET utr = ?, amount = ?, status = 'pending', approved_at = NULL
        WHERE id = ?
      `).run(
        utr,
        REGISTRATION_FEE,
        existing.id
      );

    } else {

      db.prepare(`
        INSERT INTO payments
        (user_id, amount, utr, status)
        VALUES (?, ?, ?, 'pending')
      `).run(
        req.user.id,
        REGISTRATION_FEE,
        utr
      );
    }

    res.json({
      success: true,
      message: "Payment submitted. Waiting for admin approval."
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Payment submission failed"
    });
  }
});


/* =========================
   PAYMENT STATUS
========================= */

app.get("/api/payment/status", auth, (req, res) => {

  const payment = db.prepare(`
    SELECT *
    FROM payments
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(req.user.id);

  res.json({
    success: true,
    payment: payment || null
  });
});


/* =========================
   VERIFIED PROFILES ONLY
========================= */

app.get("/api/profiles", (req, res) => {

  const city = String(
    req.query.city || ""
  ).trim();

  let profiles;

  if (city) {

    profiles = db.prepare(`
      SELECT
        id,
        name,
        age,
        city,
        gender,
        bio,
        photo_url
      FROM users
      WHERE active = 1
      AND verified = 1
      AND city LIKE ?
      ORDER BY id DESC
    `).all(`%${city}%`);

  } else {

    profiles = db.prepare(`
      SELECT
        id,
        name,
        age,
        city,
        gender,
        bio,
        photo_url
      FROM users
      WHERE active = 1
      AND verified = 1
      ORDER BY id DESC
    `).all();
  }

  res.json({
    success: true,
    profiles
  });
});


/* =========================
   ADMIN LOGIN
========================= */

app.post("/api/admin/login", (req, res) => {

  const {
    email,
    password
  } = req.body;

  if (
    !ADMIN_EMAIL ||
    !ADMIN_PASSWORD
  ) {
    return res.status(500).json({
      success: false,
      message: "Admin credentials are not configured"
    });
  }

  if (
    email !== ADMIN_EMAIL ||
    password !== ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid admin credentials"
    });
  }

  const token = jwt.sign(
    {
      role: "admin",
      email: ADMIN_EMAIL
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.cookie("admin_auth", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.json({
    success: true,
    message: "Admin login successful"
  });
});


/* =========================
   ADMIN LOGOUT
========================= */

app.post("/api/admin/logout", (req, res) => {

  res.clearCookie("admin_auth");

  res.json({
    success: true
  });
});


/* =========================
   ADMIN PAYMENTS
========================= */

app.get("/api/admin/payments", adminAuth, (req, res) => {

  const payments = db.prepare(`
    SELECT
      payments.id,
      payments.user_id,
      payments.amount,
      payments.utr,
      payments.status,
      payments.created_at,
      payments.approved_at,
      users.name,
      users.email,
      users.phone,
      users.city
    FROM payments
    JOIN users
      ON users.id = payments.user_id
    ORDER BY payments.id DESC
  `).all();

  res.json({
    success: true,
    payments
  });
});


/* =========================
   ADMIN APPROVE PAYMENT
========================= */

app.post(
  "/api/admin/payments/:id/approve",
  adminAuth,
  (req, res) => {

    const paymentId =
      Number(req.params.id);

    const payment = db.prepare(`
      SELECT *
      FROM payments
      WHERE id = ?
    `).get(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found"
      });
    }

    db.prepare(`
      UPDATE payments
      SET status = 'approved',
          approved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(paymentId);

    db.prepare(`
      UPDATE users
      SET verified = 1,
          active = 1
      WHERE id = ?
    `).run(payment.user_id);

    res.json({
      success: true,
      message: "Payment approved. Account is now active."
    });
  }
);


/* =========================
   ADMIN REJECT PAYMENT
========================= */

app.post(
  "/api/admin/payments/:id/reject",
  adminAuth,
  (req, res) => {

    const paymentId =
      Number(req.params.id);

    const payment = db.prepare(`
      SELECT *
      FROM payments
      WHERE id = ?
    `).get(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found"
      });
    }

    db.prepare(`
      UPDATE payments
      SET status = 'rejected',
          approved_at = NULL
      WHERE id = ?
    `).run(paymentId);

    db.prepare(`
      UPDATE users
      SET verified = 0,
          active = 0
      WHERE id = ?
    `).run(payment.user_id);

    res.json({
      success: true,
      message: "Payment rejected."
    });
  }
);


/* =========================
   ADMIN USERS
========================= */

app.get("/api/admin/users", adminAuth, (req, res) => {

  const users = db.prepare(`
    SELECT
      id,
      name,
      phone,
      email,
      age,
      city,
      gender,
      verified,
      active,
      created_at
    FROM users
    ORDER BY id DESC
  `).all();

  res.json({
    success: true,
    users
  });
});


/* =========================
   WEBSITE FALLBACK
========================= */

app.use((req, res, next) => {

  if (
    req.method === "GET" &&
    !req.path.startsWith("/api/")
  ) {
    return res.sendFile(
      path.join(publicDir, "index.html")
    );
  }

  next();
});


/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {

  console.log(
    `Rent Friend India running on port ${PORT}`
  );

});
