const multer = require("multer");

// Memory storage so we can stream to ImageKit without touching disk
const storage = multer.memoryStorage();

// Configurable max size (MB), default 20MB for mobile photos
const MAX_MB = parseInt(process.env.UPLOAD_MAX_MB || "20", 10);

const upload = multer({
  storage,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
});

module.exports = {
  uploadSinglePhoto: upload.single("photo"),
};
