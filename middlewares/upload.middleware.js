const multer = require("multer");

// Memory storage so we can stream to ImageKit without touching disk
const storage = multer.memoryStorage();

// Accept a single file named 'photo' with up to 10MB default limit
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = {
  uploadSinglePhoto: upload.single("photo"),
};
