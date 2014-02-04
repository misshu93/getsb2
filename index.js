var fs = require('fs');
var http = require('http');
var url = require('url');
var querystring = require('querystring');
var request = require('request');
var archiver = require('archiver');

http.createServer(function(req, res) {

  var u = url.parse(req.url);

  var match = /\d+/.exec(u.pathname);
  if (!match) {
    res.writeHead(404);
    return res.end();
  }

  var id = +match[0];
  var q = querystring.parse(u.query);

  var zip = q.zip != null;

  request('http://scratch.mit.edu/internalapi/project/' + id + '/get/', function(err, r, body) {
    if (err) {
      res.writeHead(500);
      return res.end();
    }
    if (r.statusCode !== 200) {
      res.writeHead(404);
      return res.end();
    }

    res.writeHead(200, {
      'Content-Type': zip ? 'application/zip' : 'application/octet-stream',
      'Content-Disposition': 'attachment;filename=' + id + '.' + (zip ? 'zip' : 'sb2')
    });

    var project = JSON.parse(body);
    var nextID = 0;

    function parse(thing) {
      if (thing.costumes) thing.costumes.forEach(function(costume) {
        addResource(costume, 'baseLayerID', costume.baseLayerMD5);
        addResource(costume, 'textLayerID', costume.textLayerMD5);
      });
      if (thing.sounds) thing.sounds.forEach(function(sound) {
        addResource(sound, 'soundID', sound.md5);
      });
      if (thing.children) thing.children.forEach(parse);
    }

    function addResource(thing, id, md5) {
      if (!md5) return;
      thing[id] = ++nextID;
      archive.append(request('http://scratch.mit.edu/internalapi/asset/' + md5 + '/get/'), { name: nextID + '.' + md5.split('.').pop() });
    }

    var archive = archiver('zip');
    archive.pipe(res);

    parse(project);

    archive.append(JSON.stringify(project), { name: 'project.json' });
    archive.finalize();
  });

  return;

}).listen(process.env.PORT || 8080, process.env.HOST);
