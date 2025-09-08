const ImageKit = require("imagekit");

const { IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT } =
  process.env;

let imagekit;

function getClient() {
  if (!imagekit) {
    if (
      !IMAGEKIT_PUBLIC_KEY ||
      !IMAGEKIT_PRIVATE_KEY ||
      !IMAGEKIT_URL_ENDPOINT
    ) {
      throw new Error(
        "ImageKit credentials are missing. Please set IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and IMAGEKIT_URL_ENDPOINT in your environment."
      );
    }
    imagekit = new ImageKit({
      publicKey: IMAGEKIT_PUBLIC_KEY,
      privateKey: IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: IMAGEKIT_URL_ENDPOINT,
    });
  }
  return imagekit;
}

async function uploadToImageKit(fileBuffer, fileName, opts = {}) {
  const client = getClient();
  const options = {
    file: fileBuffer,
    fileName: fileName || `upload_${Date.now()}`,
    useUniqueFileName: true,
    folder: "members",
    ...opts,
  };
  return client.upload(options);
}

async function deleteFromImageKit(fileId) {
  if (!fileId) return;
  const client = getClient();
  try {
    await client.deleteFile(fileId);
  } catch (err) {
    // Swallow deletion errors to avoid blocking flows
    console.warn("ImageKit delete failed:", err?.message || err);
  }
}

module.exports = {
  uploadToImageKit,
  deleteFromImageKit,
};
