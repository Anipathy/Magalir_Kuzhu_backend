const mongoose = require("mongoose");

const DB_URI = process.env.DB_URI;

if (!DB_URI) {
  console.error("Error: DB_URI is not defined in environment variables.");
  process.exit(1);
}

(async () => {
  try {
    console.log("🔄 Attempting to connect to MongoDB...");
    await mongoose.connect(DB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 10000,
    });

    console.log("🎉 ✅ MONGODB CONNECTION SUCCESSFUL! 🎉");
    console.log("=".repeat(50));
    console.log(`📊 Database Name: ${mongoose.connection.db.databaseName}`);
    console.log(
      `🌐 Connection State: ${
        mongoose.connection.readyState === 1
          ? "✅ CONNECTED"
          : "❌ NOT CONNECTED"
      }`
    );
    console.log(`🏠 Host: ${mongoose.connection.host}`);
    console.log(`🚪 Port: ${mongoose.connection.port}`);
    console.log("=".repeat(50));
  } catch (err) {
    console.log("=".repeat(50));
    console.error("❌ MONGODB CONNECTION FAILED!");
    console.error("=".repeat(50));
    console.error("🔍 Error Type:", err.name);
    console.error("📝 Error Message:", err.message);

    if (err.message.includes("IP")) {
      console.error(
        "💡 SOLUTION: Add your IP address to MongoDB Atlas whitelist:"
      );
      console.error("   1. Go to MongoDB Atlas Dashboard");
      console.error("   2. Navigate to Network Access");
      console.error("   3. Add your current IP address");
      console.error("   4. Or add 0.0.0.0/0 for development (less secure)");
    }

    console.error("=".repeat(50));
    process.exit(1);
  }
})();

// Connection event listeners for better monitoring
mongoose.connection.on("connected", () => {
  console.log("🟢 Mongoose EVENT: Connected to MongoDB");
  console.log(
    `🔗 Connected to: ${mongoose.connection.host}:${mongoose.connection.port}`
  );
});

mongoose.connection.on("error", (err) => {
  console.error("🔴 Mongoose EVENT: Connection error");
  console.error("Error:", err.message);
});

mongoose.connection.on("disconnected", () => {
  console.log("🟡 Mongoose EVENT: Disconnected from MongoDB");
});

mongoose.connection.on("reconnected", () => {
  console.log("🔄 Mongoose EVENT: Reconnected to MongoDB");
});

mongoose.connection.on("open", () => {
  console.log("📂 Mongoose EVENT: Connection opened");
});

// Handle application termination
process.on("SIGINT", async () => {
  console.log("🔄 Closing MongoDB connection...");
  await mongoose.connection.close();
  console.log("✅ MongoDB connection closed");
  process.exit(0);
});
