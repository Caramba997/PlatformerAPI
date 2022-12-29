const jwt = require("jsonwebtoken");

const config = process.env;

const verifyToken = (req, res, next) => {
  const token = req.body.token || req.query.token || req.headers["platformer-token"] || req.cookies['platformer-token'];

  if (!token) {
    return res.status(403).send("A token is required for authentication");
  }
  try {
    const decoded = jwt.verify(token, config.DB_TOKEN);
    req.user = decoded;
  } catch (err) {
    return res.status(401).send("Invalid Token");
  }
  return next();
};

const createToken = (user, expire) => {
  // Save expiration date
  const expiration = new Date(Date.now() + (1000 * 60 * 60 * 24 * expire));
  // Create token
  const token = jwt.sign(
    { username: user.username, id: user._id },
    process.env.DB_TOKEN,
    {
      expiresIn: `${expire}d`,
    }
  );
  user.token = token;
  user.tokenExpiration = expiration.toUTCString();
};

module.exports = { verifyToken, createToken };