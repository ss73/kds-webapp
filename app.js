var express = require('express');
var app = express();
var path = require('path');
var formidable = require('formidable');
var fs = require('fs');
var util = require('util');
var handlebars  = require('express-handlebars');
var request = require('request-json');
var httprequest = require('request');

// Configuration parameters
var indexsvc_env = {
    host : process.env.INDEXSVC_PORT_32600_TCP_ADDR || "localhost", 
    port : process.env.INDEXSVC_PORT_32600_TCP_PORT || 32600 };
var blobsvc_env = {
    host : process.env.BLOBSVC_PORT_32500_TCP_ADDR || "localhost", 
    port : process.env.BLOBSVC_PORT_32500_TCP_PORT || 32500 };

app.engine('.hbs', handlebars());

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'views/index.html'));
});

app.get('/handlebars', function(req, res) {
    var json = {"records":[{"id":"1234-1234-1234-1234","title":"A sample title","text":"Full text content goes here..."},{"id":"117794381898481","title":"Nuts and bolts","text":"This text is about nuts and bolts"}]};
    res.render(path.join(__dirname, 'views/test.hbs'), json);
});

app.get('/search', function (req, res) {
    console.log(req.query.searchstring);
    var client = request.createClient('http://' + indexsvc_env.host + ':' + indexsvc_env.port + '/');
    client.get('find/' + req.query.searchstring , function(err, svcres, body) {
        console.log(body);
        var json = {"records" : body};
        res.render(path.join(__dirname, 'views/searchresult.hbs'), json);
    });
});

app.get('/show/:id', function(req, res) {
    var bloburl = 'http://' + blobsvc_env.host + ':' + blobsvc_env.port + '/retrieve/' + req.params.id;
    httprequest
        .get(bloburl)
        .pipe(res);
});

app.get('/upload', function (req, res) {
    res.sendFile(path.join(__dirname, 'views/upload.html'));
});

app.get('/service/uploads', function (req, res) {
    var uploadDir = path.join(__dirname, '/uploads');
    var uploadslist;
    fs.readdir(uploadDir, function (err, items) {
        if(err) {
            console.log(err);
            return res.send();
        }
        var result = [];
        for (var i in items) {
            var stats = fs.statSync(path.join(__dirname, 'uploads', items[i]));
            var ctime = new Date(util.inspect(stats.ctime));
            result.push({ name: items[i], created: ctime });
        }
        res.contentType('application/json');
        res.send(JSON.stringify(result));
    });
});

app.get('/service/uploads/:name', function (req, res, next) {
    var options = {
        root: path.join(__dirname, '/uploads'),
        dotfiles: 'deny',
        headers: {
            'x-timestamp': Date.now(),
            'x-sent': true
        }
    };
    var fileName = req.params.name;
    res.sendFile(fileName, options, function (err) {
        if (err) {
            console.log(err);
            res.status(err.status).end();
        }
        else {
            console.log('Sent:', fileName);
        }
    });
});

app.get('/service/cleanup/:timestamp', function (req, res) {
    var uploadDir = path.join(__dirname, '/uploads');
    var beforetime = new Date(req.params.timestamp);
    console.log("Deleting files older than: " + beforetime);
    fs.readdir(uploadDir, function (err, items) {
        if(err) {
            console.log(err);
            res.send();
        }
        for (var i in items) {
            var stats = fs.statSync(path.join(__dirname, 'uploads', items[i]));
            var ctime = new Date(util.inspect(stats.ctime));
            if (ctime < beforetime) {
                fs.unlinkSync(path.join(__dirname, 'uploads', items[i]));
                res.write("Deleted: " + items[i] + '\n');
            }
        }
        res.end();
    });
});

app.post('/upload', function (req, res) {

    //console.log(req);
    // create an incoming form object
    var form = new formidable.IncomingForm();

    // specify that we want to allow the user to upload multiple files in a single request
    form.multiples = true;

    // store all uploads in the /uploads directory
    form.uploadDir = path.join(__dirname, '/uploads');

    // every time a file has been uploaded successfully,
    // rename it to it's orignal name
    form.on('file', function (field, file) {
        console.log('Got file: ' + file.name);
        var outfile = path.join(form.uploadDir, file.name);
        fs.rename(file.path, outfile);
    });

    // log any errors that occur
    form.on('error', function (err) {
        console.log('An error has occured: \n' + err);
    });

    // once all the files have been uploaded, send a response to the client
    form.on('end', function () {
        res.end('success');
    });

    // parse the incoming request containing the form data
    form.parse(req);

});

var server = app.listen(32000, function () {
    console.log('Server listening on port 32000');
});
