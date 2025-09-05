const express = require("express");
const dotenv = require("dotenv");
dotenv.config();

app = express();

app.use(express.json());

const cors = require("cors");

// CORS configuration allowing only the specified API domain
const allowedOrigins = ["*"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // Allow non-browser tools (Postman, curl)
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Referrer Policy header as requested
app.use((req, res, next) => {
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
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
