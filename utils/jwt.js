const JWT = require("jsonwebtoken");
const { token } = require("morgan");

const SECRET_KEY = process.env.SECRET_KEY;

const generateToken = async (payload) => {
  return new Promise((resolve, reject) => {
    JWT.sign(
      payload,
      SECRET_KEY,
      { algorithm: "HS256", expiresIn: "30d" },
      (err, token) => {
        if (err) return reject(err);
        resolve(token);
      }
    );
  });
};

const verifyToken = async (token) => {
  return new Promise((resolve, reject) => {
    JWT.verify(token, SECRET_KEY, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
};

module.exports = {
  generateToken,
  verifyToken,
};
