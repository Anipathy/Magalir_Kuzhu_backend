const express = require("express");
const dotenv = require("dotenv");
dotenv.config();

app = express();

app.use(express.json());

const cors = require("cors");

const allowedOrigins = [
  "https://pjloan.in",
  "http://localhost:4000",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      console.log(`🌐 CORS request from origin: ${origin || "no origin"}`);

      if (!origin) return callback(null, true); // Allow non-browser tools (Postman, curl)
      if (allowedOrigins.includes(origin)) {
        console.log(`✅ CORS allowed for origin: ${origin}`);
        return callback(null, true);
      }

      console.error(`❌ CORS blocked for origin: ${origin}`);
      console.log(`📝 Allowed origins: ${allowedOrigins.join(", ")}`);
      return callback(
        new Error(`CORS policy violation: Origin ${origin} not allowed`)
      );
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
    exposedHeaders: ["Content-Length", "X-Foo", "X-Bar"],
    preflightContinue: false,
    optionsSuccessStatus: 200,
  })
);

// Additional security and CORS headers
app.use((req, res, next) => {
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Handle preflight requests explicitly
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept"
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.status(200).end();
    return;
  }

  next();
});

const morgan = require("morgan");
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.send("API is operational");
});

require("./database/database");

const router = require("./routes/router");

app.use("/api", router);

app.use((req, res, next) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  if (err.isJoi) {
    return res.status(400).json({ message: err.details[0].message });
  }
  res.status(err.status || 500).json({
    message: "Internal Server Error",
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
