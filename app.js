const express = require('express'),
      router = express.Router(),
      cookieParser = require('cookie-parser'),
      bodyParser = require('body-parser'),
      cors = require('cors'),
      bcrypt = require('bcryptjs'),
      settings = require('./config/api').settings,
      { verifyToken, createToken } = require('./middleware/auth'),
      User = require('./model/user'),
      Level = require('./model/level');

require('dotenv').config();
require('./config/database.js').connect();

var app = express();

app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors({
  origin: (origin, callback) => {
    if (settings.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: 'Content-Type, Set-Cookie'
}));

app.post('/register', async function (req, res) {
  try {
    // Get user input
    const { username, password } = req.body;

    // Validate user input
    if (!(username && password)) {
      return res.status(400).json({ msg: 'Username and password is required' });
    }

    // Check if user already exist
    // Validate if user exist in our database
    const oldUser = await User.findOne({ username: username });

    if (oldUser) {
      return res.status(409).json({ msg: 'User already exists' });
    }

    //Encrypt user password
    const encryptedPassword = await bcrypt.hash(password, 10);

    // Create user in our database
    const newUser = await User.create({
      username: username,
      password: encryptedPassword,
    });

    // Create token
    createToken(newUser, settings.expire);

    // Return new user
    res.setHeader('Set-Cookie', `${settings.tokenCookie}=${newUser.token}; SameSite=None; Secure; expires=${newUser.tokenExpiration}; path=/; Domain=${req.get('Origin')};`);
    delete newUser.password;
    res.status(201).json(newUser);
  } catch (err) {
    console.error(err);
  }
});

app.post('/login', async function (req, res) {
  try {
    // Get user input
    const { username, password } = req.body;

    // Validate user input
    if (!(username && password)) {
      return res.status(400).json({ msg: 'Username and password is required' });
    }
    // Validate if user exist in our database
    const user = await User.findOne({ username: username });
    if (!user) return res.status(404).json({ msg: 'User not found' });
    const compareResult = await bcrypt.compare(password, user.password);
    if (compareResult) {
      // Create token
      createToken(user, settings.expire);
      res.setHeader('Set-Cookie', `${settings.tokenCookie}=${user.token}; SameSite=None; Secure; expires=${user.tokenExpiration}; path=/; Domain=${req.get('Origin')};`);
      delete user.password;
      return res.status(200).json(user);
    }
    res.status(401).json({ msg: 'Password is incorrect' });
  } catch (err) {
    console.error(err);
  }
});

router.use(verifyToken);

router.get('/user', async function (req, res) {
  const user = await User.findOne({ username: req.user.username }, { password: 0 });
  if (!user) return res.status(404).json({ msg: 'User not found' });
  return res.status(200).json(user);
});

router.post('/level', async function (req, res) {
  try {
    // Get user input
    const { id, json, thumbnail } = req.body;

    const user = await User.findOne({ username: req.user.username });
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (id) {
      const level = await Level.findOne({ _id: id });
      if (level) {
        if (json) level.json = json;
        if (thumbnail) level.thumbnail = thumbnail;
        level.version = level.version++;
        level.lastModified = new Date().toUTCString();
        await level.save();
        return res.status(200).json(level);
      }
    }

    if (!json) return res.status(400).json({ msg: 'Json must not be empty for level creation' });

    const creationDate = new Date().toUTCString();
    const newLevel = await Level.create({
      json: json,
      creator: user.username,
      thumbnail: thumbnail || null,
      version: 0,
      createdAt: creationDate,
      lastModified: creationDate
    });

    user.createdLevels = user.createdLevels || [];
    user.createdLevels.push(newLevel._id);
    user.save();

    return res.status(200).json(newLevel);
  } catch (err) {
    console.error(err);
  }
});

app.use(settings.path, router);

module.exports = app;