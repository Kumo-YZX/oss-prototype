/*
    Andoromeda OSS Hub
    July 2019
*/

const express = require('express');
const OSS = require('ali-oss');
const config = require('./config.json');
const md5 = require('crypto-js/md5');
const multer = require('multer');
const path = require('path');
const moment = require('moment');
const rateLimit = require('express-rate-limit');
const redisStore = require('rate-limit-redis');
const redis = require('ioredis');

const redisClient = new redis(config.redis_port, config.redis_server);
const app = express();
const upload = multer({ dest: 'uploads/' });

const limiter = rateLimit({
    store: new redisStore({
        client: redisClient,
    }),
    windowMs: config.ratelimit_time,
    max: config.ratelimit_amount,
    message: { code: 429, msg: 'Too many requests...' },
});

const ossClient = OSS({
    region: config.oss_region,
    accessKeyId: config.oss_key,
    accessKeySecret: config.oss_secret,
    bucket: config.oss_bucket
})

app.use(express.static(path.join(__dirname, 'upload')));
app.use(limiter);

// allow custom header and CORS
// 遇到OPTIONS继续..
app.all('*', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    // res.header('Access-Control-Allow-Headers', 'Content-Type, Content-Length, Authorization, Accept, X-Requested-With , yourHeaderFeild');
    res.header('Access-Control-Allow-Methods', 'PUT, POST, GET, DELETE, OPTIONS');
    if (req.method == 'OPTIONS') {
        res.sendStatus(200);
    }
    else {
        next();
    }
});

app.get('/', function(req, res, next) {
    res.json({ code: 200, msg: '...' })
})

app.post('/upload', upload.single('upload'), function(req ,res, next) {
    const filepath = req.file.path;
    const filetype = req.file.mimetype.split('/')[1];
    const filename = moment().format('YYYY/MM/DD/') + md5(req.file.filename).toString() + '.' + filetype;
    ossClient.put('pics/' + filename, filepath).then(function(r1) {
        console.log(`Upload Success: ${filename}`);
        res.json({ code: 200, hash: filename });
    }).catch(function(err) {
        console.log(err);
        res.json({ code: 999 });
    });
})

app.get('/upload2/:filename',  function (req, res) {
    const filename = req.params.filename;
    ossClient.put('pics/'+filename, './'+filename).then(function(r1) {
        console.log('Put success: %j', r1);
        res.json({ code: 0 });
    }).catch(function(err) {
        console.log(err);
        res.json({ code: 999 });
    });
})

app.get('/catch/:filename', function (req, res) {
    const filename = req.params.filename;
    ossClient.get('pics/'+filename).then(function(r2) {
        // res.writeHead(200, {'Content-type':'image/jpg'});
        res.writeHead(200);
        res.write(r2.content);
        res.end();
    }).catch(function(err) {
        console.log(err);
        res.send(0);
    });
})

app.listen(config.node_port, function() {
    console.log(`Application is listening on http://localhost:${config.node_port} ...`);
})
