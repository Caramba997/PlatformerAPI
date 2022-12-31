const express = require('express'),
      router = express.Router(),
      mongoose = require('mongoose'),
      cookieParser = require('cookie-parser'),
      bodyParser = require('body-parser'),
      cors = require('cors'),
      bcrypt = require('bcryptjs'),
      settings = require('./config/api').settings,
      tools = require('./config/tools'),
      { verifyToken, createToken } = require('./middleware/auth'),
      User = require('./model/user'),
      Level = require('./model/level'),
      Highscore = require('./model/highscore');

require('dotenv').config();
require('./config/database.js').connect();

var app = express();

app.use(bodyParser.json({
  limit: '10mb'
}));
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
      role: 'user',
      progress: '{}'
    });

    // Create token
    createToken(newUser, settings.expire);

    // Return new user
    res.setHeader('Set-Cookie', `${settings.tokenCookie}=${newUser.token}; SameSite=None; Secure; expires=${newUser.tokenExpiration}; path=/;`);
    res.status(201).json(tools.getSecureObject(newUser));
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
      res.setHeader('Set-Cookie', `${settings.tokenCookie}=${user.token}; SameSite=None; Secure; expires=${user.tokenExpiration}; path=/;`);
      return res.status(200).json(tools.getSecureObject(user));
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

router.post('/user/highscore', async function (req, res) {
  const { id, points, time } = req.body;
  if (!(id && points && time)) return res.status(400).json({ msg: 'Parameter is missing' });

  const user = await User.findOne({ username: req.user.username }, { password: 0 });
  if (!user) return res.status(404).json({ msg: 'User not found' });

  if (!id.includes('level')) {
    const level = await Level.findOne({ _id: id }, { json: 0 });
    if (!level) return res.status(404).json({ msg: 'Level not found' });
  }
  
  const progress = JSON.parse(user.progress),
        levelProgress = progress[id],
        newLevelProgress = {};
  if (levelProgress) {
    newLevelProgress.points = levelProgress.points;
    newLevelProgress.time = levelProgress.time;
    if (levelProgress.points < points) newLevelProgress.points = points;
    if (levelProgress.time > time) newLevelProgress.time = time;
  }
  else {
    newLevelProgress.points = points;
    newLevelProgress.time = time;
  }
  progress[id] = newLevelProgress;

  user.progress = JSON.stringify(progress);

  const highscore = await Highscore.findOne({ level: id });
  if (highscore) {
    // Time highscores
    let isHighscore = false;
    for (let i = 0; i < highscore.time.length; i++) {
      const current = highscore.time[i];
      if (current.score < time) {
        highscore.time.splice(i, 0, {
          user: user.username,
          score: time
        });
        isHighscore = true;
        break;
      }
    }
    if (highscore.time.length > 20) {
      highscore.time.splice(20, highscore.time.length - 20);
    }
    else if (!isHighscore) {
      highscore.time.push({
        user: user.username,
        score: time
      });
    }
    // Points highscores
    isHighscore = false;
    for (let i = 0; i < highscore.points.length; i++) {
      const current = highscore.points[i];
      if (current.score < points) {
        highscore.points.splice(i, 0, {
          user: user.username,
          score: points
        });
        isHighscore = true;
        break;
      }
    }
    if (highscore.points.length > 20) {
      highscore.points.splice(20, highscore.points.length - 20);
    }
    else if (!isHighscore)  {
      highscore.points.push({
        user: user.username,
        score: points
      });
    }
    highscore.save();
  }
  else {
    await Highscore.create({
      level: id,
      time: [
        {
          user: user.username,
          score: time
        }
      ],
      points: [
        {
          user: user.username,
          score: points
        }
      ],
    });
  }

  user.save();

  return res.status(200).json(user);
});

router.get('/user/createdlevels', async function (req, res) {
  const user = await User.findOne({ username: req.user.username });
  if (!user) return res.status(404).json({ msg: 'User not found' });
  
  const queryArray = [];
  user.createdLevels.forEach((level) => {
    queryArray.push(mongoose.Types.ObjectId(level));
  });
  const levels = await Level.find({
    '_id': { $in: queryArray }
  }, {
    json: 0
  });
  return res.status(200).json(levels);
});

router.get('/user/alllevels', async function (req, res) {
  const user = await User.findOne({ username: req.user.username });
  if (!user) return res.status(404).json({ msg: 'User not found' });
  
  let queryArray = [];
  user.createdLevels.forEach((level) => {
    queryArray.push(mongoose.Types.ObjectId(level));
  });
  const createdLevels = await Level.find({
    '_id': { $in: queryArray }
  }, {
    json: 0
  });

  queryArray = [];
  user.savedLevels.forEach((level) => {
    queryArray.push(mongoose.Types.ObjectId(level));
  });
  const savedLevels = await Level.find({
    '_id': { $in: queryArray }
  }, {
    json: 0
  });

  return res.status(200).json({ createdLevels: createdLevels, savedLevels: savedLevels });
});

router.post('/user/subscribe', async function (req, res) {
  const { _id } = req.body;
  if (!_id) return res.status(400).json({ msg: 'ID is missing' });

  const user = await User.findOne({ username: req.user.username });
  if (!user) return res.status(404).json({ msg: 'User not found' });

  const level = await Level.findOne({ _id: _id });
  if (level) {
    user.savedLevels.push(_id);
    user.save();
    return res.status(200).json(user);
  }

  return res.status(400).json({ msg: 'Level not found' });
});

router.post('/user/unsubscribe', async function (req, res) {
  const { _id } = req.body;
  if (!_id) return res.status(400).json({ msg: 'ID is missing' });

  const user = await User.findOne({ username: req.user.username });
  if (!user) return res.status(404).json({ msg: 'User not found' });

  if (!user.savedLevels.includes(_id)) return res.status(400).json({ msg: 'Level is not subscribed' });

  const index = user.savedLevels.indexOf(_id);
  user.savedLevels.splice(index, 1);
  user.save();
  return res.status(200).json(user);
});

router.post('/level/save', async function (req, res) {
  try {
    // Get user input
    const { _id, json, name } = req.body;
    if (!json) return res.status(400).json({ msg: 'Json must not be empty for level creation' });

    const user = await User.findOne({ username: req.user.username });
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (_id) {
      if (!user.createdLevels.includes(_id)) return res.status(400).json({ msg: 'Users can only modify their own levels' });
      const level = await Level.findOne({ _id: _id });
      if (level) {
        level.name = (name) ? name : 'Level';
        level.json = json;
        level.version = level.version + 1;
        level.lastModified = new Date().toUTCString();
        level.save();
        return res.status(200).json(level);
      }
    }

    const creationDate = new Date().toUTCString();
    const newLevel = await Level.create({
      json: json,
      name: (name) ? name : 'Level',
      creator: user.username,
      thumbnail: null,
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

router.post('/level/thumbnail', async function (req, res) {
  try {
    const { _id, thumbnail } = req.body;
    if (!_id) return res.status(400).json({ msg: 'ID is missing' });
    if (!thumbnail) return res.status(400).json({ msg: 'Thumbnail data is missing' });

    const user = await User.findOne({ username: req.user.username });
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const level = await Level.findOne({ _id: _id });
    if (!level) return res.status(404).json({ msg: 'No level found for given ID' });
    
    level.thumbnail = thumbnail;
    level.lastModified = new Date().toUTCString();
    level.save();
    return res.status(200).json(level);
  } catch (err) {
    console.error(err);
  }
});

router.post('/level/get', async function (req, res) {
  try {
    // Get user input
    const { _id } = req.body;

    if (_id) {
      const level = await Level.findOne({ _id: _id });
      if (level) return res.status(200).json(level);
    }

    return res.status(404).json({ msg: 'No level found for given ID' });
  } catch (err) {
    console.error(err);
  }
});

router.get('/level/getall', async function (req, res) {
  try {
    const levels = await Level.find({}, { json: 0 });
    if (levels) return res.status(200).json(levels);

    return res.status(404).json({ msg: 'Failed finding levels' });
  } catch (err) {
    console.error(err);
  }
});

router.post('/level/delete', async function (req, res) {
  try {
    const { _id } = req.body;
    if (!_id) return res.status(400).json({ msg: 'ID is missing' });

    const user = await User.findOne({ username: req.user.username });
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (!user.createdLevels.includes(_id)) return res.status(400).json({ msg: 'Users can only delete their own levels' });

    Level.deleteOne({ _id: _id }).then(() => {
      const index = user.createdLevels.indexOf(_id);
      user.createdLevels.splice(index, 1);
      user.save();
      res.status(200).json(user);
    }).catch(() => {
      return res.status(400).json({ msg: 'Level can not be deleted. There may be not level for given ID' });
    });
  } catch (err) {
    console.error(err);
  }
});

router.post('/highscore/get', async function (req, res) {
  try {
    const { _id } = req.body;
    if (!_id) return res.status(400).json({ msg: 'ID is missing' });

    const highscore = await Highscore.findOne({ _id: _id });
    if (highscore) return res.status(200).json(highscore);

    return res.status(404).json({ msg: 'Failed finding highscore' });
  } catch (err) {
    console.error(err);
  }
});

router.get('/highscore/getall', async function (req, res) {
  try {
    const highscores = await Highscore.find({});
    if (highscores) return res.status(200).json(highscores);

    return res.status(404).json({ msg: 'Failed finding highscores' });
  } catch (err) {
    console.error(err);
  }
});

app.use(settings.path, router);

module.exports = app;