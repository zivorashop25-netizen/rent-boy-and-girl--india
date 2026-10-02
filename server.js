const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

const REGISTRATION_FEE = 499;

const UPI_ID =
  process.env.UPI_ID || "8822627454-3@ybl";

const UPI_NAME =
  process.env.UPI_NAME || "Rent Boy & Girl India";

const JWT_SECRET =
  process.env.JWT_SECRET || "change-this-secret";

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || "";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "";

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* =========================
   DATABASE FILE
========================= */

const dataDir = path.join(__dirname, "data");
const dbFile = path.join(dataDir, "db.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function loadDB() {
  try {
    if (!fs.existsSync(dbFile)) {
      const initial = {
        users: [],
        payments: []
      };

      fs.writeFileSync(
        dbFile,
        JSON.stringify(initial, null, 2)
      );

      return initial;
    }

    const data = JSON.parse(
      fs.readFileSync(dbFile, "utf8")
    );

    data.users = Array.isArray(data.users)
      ? data.users
      : [];

    data.payments = Array.isArray(data.payments)
      ? data.payments
      : [];

    return data;

  } catch (error) {
    console.error("Database read error:", error);

    return {
      users: [],
      payments: []
    };
  }
}

function saveDB(db) {
  fs.writeFileSync(
    dbFile,
    JSON.stringify(db, null, 2)
  );
}

/* =========================
   HELPERS
========================= */

function makeId(prefix) {
  return (
    prefix +
    "_" +
    Date.now() +
    "_" +
    Math.random()
      .toString(36)
      .substring(2, 8)
  );
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}

function auth(req, res, next) {
  try {
    const token = req.cookies.auth;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Login required"
      });
    }

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    const db = loadDB();

    const user = db.users.find(
      u => u.id === decoded.id
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    req.user = user;

    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Session expired"
    });
  }
}

function adminAuth(req, res, next) {
  try {
    const token = req.cookies.admin;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Admin login required"
      });
    }

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    if (decoded.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required"
      });
    }

    req.admin = decoded;

    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Admin session expired"
    });
  }
}

/* =========================
   HOME
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Rent Boy & Girl India server is running"
  });
});

/* =========================
   PAYMENT INFO
========================= */

app.get("/api/payment-info", async (req, res) => {
  try {
    const upiLink =
      `upi://pay?pa=${encodeURIComponent(UPI_ID)}` +
      `&pn=${encodeURIComponent(UPI_NAME)}` +
      `&am=${REGISTRATION_FEE}` +
      `&cu=INR`;

    const qr = await QRCode.toDataURL(upiLink);

    res.json({
      success: true,
      amount: REGISTRATION_FEE,
      upiId: UPI_ID,
      upiName: UPI_NAME,
      qr
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
      gender
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
        message: "All fields are required"
      });
    }

    const numericAge = Number(age);

    if (numericAge < 18) {
      return res.status(400).json({
        success: false,
        message: "Only 18+ users can register"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    const db = loadDB();

    const cleanEmail =
      String(email).trim().toLowerCase();

    const cleanPhone =
      String(phone).trim();

    const existingEmail = db.users.find(
      u => u.email === cleanEmail
    );

    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: "Email already registered"
      });
    }

    const existingPhone = db.users.find(
      u => u.phone === cleanPhone
    );

    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: "Phone number already registered"
      });
    }

    const passwordHash =
      await bcrypt.hash(password, 10);

    const user = {
      id: makeId("user"),
      name: String(name).trim(),
      phone: cleanPhone,
      email: cleanEmail,
      passwordHash,
      age: numericAge,
      city: String(city).trim(),
      gender: String(gender).trim(),
      bio: "",
      photo_url: "",
      role: "user",
      verified: false,
      active: false,
      createdAt: new Date().toISOString()
    };

    db.users.push(user);

    saveDB(db);

    const token = createToken(user);

    res.cookie("auth", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      message:
        "Account created. Complete ₹499 payment and submit UTR for approval.",
      paymentRequired: true,
      amount: REGISTRATION_FEE
    });

  } catch (error) {
    console.error("Register error:", error);

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
    const {
      email,
      password
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password required"
      });
    }

    const db = loadDB();

    const user = db.users.find(
      u =>
        u.email ===
        String(email).trim().toLowerCase()
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const passwordOK =
      await bcrypt.compare(
        password,
        user.passwordHash
      );

    if (!passwordOK) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    if (!user.verified || !user.active) {
      return res.status(403).json({
        success: false,
        message:
          "Account is pending payment approval"
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
      message: "Login successful"
    });

  } catch (error) {
    console.error("Login error:", error);

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
    success: true,
    message: "Logged out"
  });
});

/* =========================
   MY ACCOUNT
========================= */

app.get("/api/me", auth, (req, res) => {
  const user = req.user;

  res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      age: user.age,
      city: user.city,
      gender: user.gender,
      bio: user.bio,
      photo_url: user.photo_url,
      verified: user.verified,
      active: user.active,
      createdAt: user.createdAt
    }
  });
});

/* =========================
   SUBMIT PAYMENT / UTR
========================= */

app.post(
  "/api/payment/submit",
  auth,
  (req, res) => {
    try {
      const {
        utr
      } = req.body;

      if (!utr) {
        return res.status(400).json({
          success: false,
          message: "UTR number is required"
        });
      }

      const cleanUTR =
        String(utr).trim();

      if (cleanUTR.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid UTR number"
        });
      }

      const db = loadDB();

      const existingUTR =
        db.payments.find(
          p => p.utr === cleanUTR
        );

      if (existingUTR) {
        return res.status(400).json({
          success: false,
          message: "This UTR has already been submitted"
        });
      }

      const existingPayment =
        db.payments.find(
          p =>
            p.userId === req.user.id &&
            p.status === "pending"
        );

      if (existingPayment) {
        return res.json({
          success: true,
          message:
            "Your payment is already pending approval"
        });
      }

      const payment = {
        id: makeId("payment"),
        userId: req.user.id,
        utr: cleanUTR,
        amount: REGISTRATION_FEE,
        status: "pending",
        createdAt: new Date().toISOString()
      };

      db.payments.push(payment);

      saveDB(db);

      res.json({
        success: true,
        message:
          "UTR submitted successfully. Wait for admin approval."
      });

    } catch (error) {
      console.error("Payment submit error:", error);

      res.status(500).json({
        success: false,
        message: "Payment submission failed"
      });
    }
  }
);

/* =========================
   MY PAYMENT STATUS
========================= */

app.get(
  "/api/payment/status",
  auth,
  (req, res) => {
    const db = loadDB();

    const payment =
      [...db.payments]
        .reverse()
        .find(
          p =>
            p.userId === req.user.id
        );

    if (!payment) {
      return res.json({
        success: true,
        payment: null
      });
    }

    res.json({
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount,
        utr: payment.utr,
        status: payment.status,
        createdAt: payment.createdAt
      }
    });
  }
);

/* =========================
   VERIFIED PROFILES
========================= */

app.get("/api/profiles", (req, res) => {
  const db = loadDB();

  const city =
    String(req.query.city || "")
      .trim()
      .toLowerCase();

  const gender =
    String(req.query.gender || "")
      .trim()
      .toLowerCase();

  let users = db.users.filter(
    u =>
      u.active === true &&
      u.verified === true
  );

  if (city) {
    users = users.filter(
      u =>
        String(u.city)
          .toLowerCase()
          .includes(city)
    );
  }

  if (gender) {
    users = users.filter(
      u =>
        String(u.gender)
          .toLowerCase() === gender
    );
  }

  const profiles = users.map(u => ({
    id: u.id,
    name: u.name,
    age: u.age,
    city: u.city,
    gender: u.gender,
    bio: u.bio,
    photo_url: u.photo_url,
    verified: u.verified
  }));

  res.json({
    success: true,
    profiles
  });
});

/* =========================
   ADMIN LOGIN
========================= */

app.post("/api/admin/login", (req, res) => {
  try {
    const {
      email,
      password
    } = req.body;

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      return res.status(500).json({
        success: false,
        message:
          "Admin credentials are not configured"
      });
    }

    if (
      String(email).trim().toLowerCase() !==
        String(ADMIN_EMAIL).trim().toLowerCase() ||
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
      {
        expiresIn: "7d"
      }
    );

    res.cookie("admin", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      message: "Admin login successful"
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Admin login failed"
    });
  }
});

/* =========================
   ADMIN LOGOUT
========================= */

app.post(
  "/api/admin/logout",
  (req, res) => {
    res.clearCookie("admin");

    res.json({
      success: true
    });
  }
);

/* =========================
   ADMIN PAYMENTS
========================= */

app.get(
  "/api/admin/payments",
  adminAuth,
  (req, res) => {
    const db = loadDB();

    const payments =
      db.payments.map(payment => {
        const user =
          db.users.find(
            u =>
              u.id === payment.userId
          );

        return {
          id: payment.id,
          userId: payment.userId,
          name: user ? user.name : "",
          email: user ? user.email : "",
          phone: user ? user.phone : "",
          amount: payment.amount,
          utr: payment.utr,
          status: payment.status,
          createdAt: payment.createdAt
        };
      });

    res.json({
      success: true,
      payments
    });
  }
);

/* =========================
   ADMIN APPROVE
========================= */

app.post(
  "/api/admin/payments/:id/approve",
  adminAuth,
  (req, res) => {
    const db = loadDB();

    const payment =
      db.payments.find(
        p => p.id === req.params.id
      );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found"
      });
    }

    payment.status = "approved";
    payment.approvedAt =
      new Date().toISOString();

    const user =
      db.users.find(
        u => u.id === payment.userId
      );

    if (user) {
      user.verified = true;
      user.active = true;
    }

    saveDB(db);

    res.json({
      success: true,
      message:
        "Payment approved and account activated"
    });
  }
);

/* =========================
   ADMIN REJECT
========================= */

app.post(
  "/api/admin/payments/:id/reject",
  adminAuth,
  (req, res) => {
    const db = loadDB();

    const payment =
      db.payments.find(
        p => p.id === req.params.id
      );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found"
      });
    }

    payment.status = "rejected";
    payment.rejectedAt =
      new Date().toISOString();

    saveDB(db);

    res.json({
      success: true,
      message: "Payment rejected"
    });
  }
);

/* =========================
   ADMIN USERS
========================= */

app.get(
  "/api/admin/users",
  adminAuth,
  (req, res) => {
    const db = loadDB();

    const users =
      db.users.map(u => ({
        id: u.id,
        name: u.name,
        phone: u.phone,
        email: u.email,
        age: u.age,
        city: u.city,
        gender: u.gender,
        verified: u.verified,
        active: u.active,
        createdAt: u.createdAt
      }));

    res.json({
      success: true,
      users
    });
  }
);

/* =========================
   STATIC WEBSITE
========================= */

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

/* =========================
   WEBSITE FALLBACK
========================= */

app.use((req, res) => {
  if (
    req.method === "GET" &&
    !req.path.startsWith("/api/")
  ) {
    return res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }

  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(
    `Rent Boy & Girl India running on port ${PORT}`
  );

  console.log(
    `UPI ID: ${UPI_ID}`
  );

  console.log(
    `Registration fee: ₹${REGISTRATION_FEE}`
  );
});
