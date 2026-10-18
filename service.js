/* TizenBrew service: keep display pairing on the TV, never on GitHub. */
(function () {
  'use strict';
  var http = require('http'), fs = require('fs'), url = require('url');
  var ORIGIN = 'http://127.0.0.1:8081';
  var FILE = '/home/owner/share/daylight.connection.json';
  function valid(value) {
    if (!value || typeof value.url !== 'string' || typeof value.token !== 'string') return false;
    var endpoint;
    try { endpoint = url.parse(value.url); } catch (_) { return false; }
    return /^https?:$/.test(endpoint.protocol || '') && !!endpoint.hostname && !endpoint.auth &&
      !endpoint.search && !endpoint.hash && (!endpoint.pathname || endpoint.pathname === '/') &&
      value.url.length <= 512 && /^[A-Za-z0-9_-]{32,256}$/.test(value.token);
  }
  function createServer(file) {
    return http.createServer(function (req, res) {
      function reply(status, body) {
        res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': ORIGIN, 'Vary': 'Origin',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'});
        res.end(JSON.stringify(body));
      }
      if (req.headers.origin !== ORIGIN || req.url !== '/daylight/connection') return reply(403, {error: 'Forbidden'});
      if (req.method === 'OPTIONS') return reply(200, {});
      if (req.method === 'GET') {
        try {
          var saved = JSON.parse(fs.readFileSync(file, 'utf8'));
          return reply(200, {connection: valid(saved) ? {url: saved.url, token: saved.token} : null});
        } catch (error) {
          if (error.code === 'ENOENT' || error instanceof SyntaxError) return reply(200, {connection: null});
          return reply(500, {error: 'TV storage could not be read'});
        }
      }
      if (req.method === 'DELETE') {
        try { fs.unlinkSync(file); } catch (error) {
          if (error.code !== 'ENOENT') return reply(500, {error: 'TV pairing could not be removed'});
        }
        return reply(200, {saved: true});
      }
      if (req.method !== 'POST' || req.headers['content-type'] !== 'application/json') return reply(400, {error: 'Invalid request'});
      var body = '', tooLarge = false;
      req.on('error', function () {});
      req.setTimeout(5000, function () { req.destroy(); });
      req.on('data', function (chunk) { if (body.length + chunk.length > 4096) tooLarge = true; else body += chunk; });
      req.on('end', function () {
        if (tooLarge) return reply(413, {error: 'Request too large'});
        var value;
        try { value = JSON.parse(body); } catch (_) { return reply(400, {error: 'Invalid pairing'}); }
        if (!valid(value)) return reply(400, {error: 'Invalid pairing'});
        try {
          fs.writeFileSync(file + '.tmp', JSON.stringify({url: value.url, token: value.token}), {mode: 384});
          fs.renameSync(file + '.tmp', file);
          return reply(200, {saved: true});
        } catch (_) { return reply(500, {error: 'TV pairing could not be saved'}); }
      });
    });
  }
  module.exports = {createServer: createServer};
  if (typeof tizen !== 'undefined') {
    var server = createServer(FILE);
    server.on('error', function () { /* The display reports storage availability. Never log private data. */ });
    server.listen(8767, '127.0.0.1');
  }
}());
