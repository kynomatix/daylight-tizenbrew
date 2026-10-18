/* Restore pairing independently of the TV web view's storage lifetime. */
(function (root) {
  'use strict';
  function create(options) {
    var key = 'daylight.connection', endpoint = 'http://127.0.0.1:8767/daylight/connection';
    var tv = options.location.origin === 'http://127.0.0.1:8081' &&
      /^\/module\/gh\/kynomatix\/daylight-tizenbrew(?:@[^/]+)?\/app\//.test(decodeURIComponent(options.location.pathname));
    function valid(value) { return value && typeof value.url === 'string' && typeof value.token === 'string' && value.token.length >= 32; }
    function readLocal() { try { var value = JSON.parse(options.storage.getItem(key)); return valid(value) ? value : null; } catch (_) { return null; } }
    function writeLocal(value) { try { var text = JSON.stringify(value); options.storage.setItem(key, text); return options.storage.getItem(key) === text; } catch (_) { return false; } }
    function bridge(method, value, attempts) {
      var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 1000);
      return options.fetch(endpoint, {method: method, cache: 'no-store', signal: controller.signal,
        headers: method === 'POST' ? {'Content-Type': 'application/json'} : {},
        body: method === 'POST' ? JSON.stringify(value) : undefined}).then(function (response) {
          if (!response.ok) throw new Error('TV storage unavailable');
          return response.json();
        }).finally(function () { clearTimeout(timer); }).catch(function (error) {
          if (attempts <= 1) throw error;
          return options.delay(400).then(function () { return bridge(method, value, attempts - 1); });
        });
    }
    return {
      load: function () {
        var local = readLocal();
        if (!tv) return Promise.resolve(local);
        return bridge('GET', null, 10).then(function (result) {
          if (valid(result.connection)) { writeLocal(result.connection); return result.connection; }
          if (local) return bridge('POST', local, 2).then(function () { return local; });
          return null;
        }).catch(function () { return local; });
      },
      save: function (value) {
        var localSaved = writeLocal(value);
        if (!tv) return Promise.resolve(localSaved);
        return bridge('POST', value, 10).then(function (result) { return result.saved === true; }).catch(function () { return false; });
      },
      forget: function () {
        // Remove the durable copy first, so a failed removal cannot silently restore it.
        var remove = tv ? bridge('DELETE', null, 3) : Promise.resolve();
        return remove.then(function () {
          if (!options.storage) return;
          options.storage.removeItem(key);
          if (options.storage.getItem(key) !== null) throw new Error('Browser pairing could not be removed');
        });
      }
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {create: create};
  else root.DaylightConnectionStorage = {create: create};
}(typeof window !== 'undefined' ? window : this));
