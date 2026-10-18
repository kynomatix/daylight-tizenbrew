/* Generic display code. No household location, account, server or token belongs here. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var state = null, demo = false, poll = null, view = 'overview', connection = null, connectionNotice = '';
  var browserStorage = null;
  try { browserStorage = window.localStorage; } catch (_) {}
  var connectionStore = window.DaylightConnectionStorage.create({storage: browserStorage, location: location,
    fetch: function (url, options) { return fetch(url, options); },
    delay: function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }});
  var timezone = 'UTC';
  function value(n, digits) { return typeof n === 'number' && isFinite(n) ? n.toFixed(digits || 0) : '—'; }
  function text(id, str) { $(id).textContent = str; }
  function age(stamp) { if (!stamp) return 'unknown'; var s = Math.max(0, Math.round(Date.now() / 1000 - stamp)); return s < 60 ? s + 's ago' : Math.floor(s / 60) + 'm ago'; }
  function formatTime(stamp, options) { try { return new Intl.DateTimeFormat('en-AU', Object.assign({timeZone: timezone}, options)).format(new Date(stamp * 1000)); } catch (_) { return new Date(stamp * 1000).toISOString().slice(11, 16) + ' UTC'; } }
  function weatherIcon(label) {
    var rainy = /rain|shower|storm/i.test(label || ''), cloudy = /cloud|overcast|fog/i.test(label || '');
    return '<svg viewBox="0 0 160 130" fill="none" aria-hidden="true"><circle cx="100" cy="44" r="24" fill="#e4b569"/><g stroke="#c59959" stroke-width="2.5"><path d="M100 8V1M100 87v-7M64 44h-8M144 44h-8M74 18l-6-6M127 71l6 6M126 18l6-6"/></g>' +
      ((cloudy || rainy) ? '<path d="M40 96a25 25 0 0 1 0-50 33 33 0 0 1 62-5 28 28 0 1 1 10 55Z" fill="#c9d9d5" stroke="#597d83" stroke-width="2.5"/>' : '<path d="M35 100h90M49 112h62" stroke="#9bb6b3" stroke-width="2"/>') +
      (rainy ? '<path d="m47 108-5 11m34-11-5 11m34-11-5 11" stroke="#597d83" stroke-width="3" stroke-linecap="round"/>' : '') + '</svg>';
  }
  function demoState() {
    var now = Date.now() / 1000, history = [];
    for (var i = 0; i < 90; i++) { var t = now - (90 - i) * 60; history.push({time: t, solar_watts: Math.max(0, 1800 + Math.sin(i / 15) * 1000 + i * 14), home_watts: 850 + Math.sin(i / 5) * 190}); }
    return {generated_at: now, energy: {available: true, online: true, alarm: false, stale: false, received_at: now, solar_watts: 3800, home_watts: 1120, grid_watts: 2680, grid_direction: 'export', battery_pct: 73, history: history}, weather: {source: 'BOM', station: 'Example station', forecast_area: 'Example region', station_distance_km: 20, fetched_at: now, timezone: 'UTC', condition_label: 'Partly cloudy.', current: {time: now, temperature_2m: 23.7, apparent_temperature: 23, wind_speed_10m: 14, relative_humidity_2m: 54}, daily: [0, 1, 2, 3].map(function (d) { return {time: now + d * 86400, temperature_2m_min: 13 + d, temperature_2m_max: 24 + d, precis: ['Partly cloudy.', 'Mostly sunny.', 'Shower or two.', 'Sunny.'][d], rain_probability: ['10%', '5%', '60%', '5%'][d]}; })}, air: {us_aqi: 28, pm2_5: 5, fetched_at: now, time: now}, uv: {uv_index: 3.4, daily_max: 5.8, fetched_at: now}, errors: {}};
  }
  function chart(id, rows) {
    var holder = $(id), width = 620, height = id === 'large-chart' ? 300 : 135, pad = 24;
    rows = (rows || []).filter(function (r) { return typeof r.time === 'number' && typeof r.solar_watts === 'number' && typeof r.home_watts === 'number'; });
    if (rows.length < 2) { holder.innerHTML = '<div class="chart-empty">History is gathering.<br>At least two distinct readings are needed.</div>'; return; }
    var first = rows[0].time, last = rows[rows.length - 1].time, span = Math.max(60, last - first);
    var max = Math.max.apply(null, rows.map(function (r) { return Math.max(r.solar_watts, r.home_watts); }).concat([1000]));
    var x = function (t) { return pad + (t - first) / span * (width - pad * 2); };
    var y = function (v) { return height - pad - v / max * (height - pad * 2); };
    var svg = '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Solar and household power by receipt time">';
    [0, .5, 1].forEach(function (f) { var yy = y(max * f); svg += '<path d="M24 ' + yy + 'H596" stroke="#31434c" stroke-width="1"/><text x="0" y="' + (yy + 3) + '">' + value(max * f / 1000, 1) + '</text>'; });
    ['solar_watts', 'home_watts'].forEach(function (key, j) {
      var path = '';
      rows.forEach(function (r, i) { path += (i === 0 || r.time - rows[i - 1].time > 180 ? 'M' : 'L') + x(r.time).toFixed(1) + ' ' + y(r[key]).toFixed(1) + ' '; });
      svg += '<path d="' + path + '" fill="none" stroke="' + (j ? '#91a9cf' : '#b9efd8') + '" stroke-width="2.5" stroke-linejoin="round"/>';
      rows.forEach(function (r, i) { if (rows.length < 15 || i === rows.length - 1) svg += '<circle cx="' + x(r.time) + '" cy="' + y(r[key]) + '" r="2" fill="' + (j ? '#91a9cf' : '#b9efd8') + '"/>'; });
    });
    svg += '<text x="24" y="' + (height - 3) + '">' + formatTime(first, {hour: '2-digit', minute: '2-digit'}) + '</text><text x="596" text-anchor="end" y="' + (height - 3) + '">' + formatTime(last, {hour: '2-digit', minute: '2-digit'}) + '</text></svg>';
    holder.innerHTML = svg;
  }
  function render(data, serviceOffline) {
    state = data;
    var w = data.weather || {}, c = w.current || {}, air = data.air || {}, uv = data.uv || {}, e = data.energy || {}, errors = data.errors || {};
    timezone = w.timezone && w.timezone !== 'auto' ? w.timezone : 'UTC';
    text('temperature', value(c.temperature_2m)); text('condition', w.condition_label || 'Waiting for BOM weather');
    $('weather-art').innerHTML = weatherIcon(w.condition_label);
    text('feels', value(c.apparent_temperature) + '°'); text('wind', value(c.wind_speed_10m) + ' km/h'); text('humidity', value(c.relative_humidity_2m) + '%');
    var weatherOld = !w.fetched_at || Date.now() / 1000 - w.fetched_at > 7200 || c.time && Date.now() / 1000 - c.time > 7200;
    text('weather-source', 'BOM' + (weatherOld || errors.weather ? ' · CACHED / WAITING' : ' · OBSERVED'));
    text('weather-note', w.station ? w.station + ' observations · ' + value(w.station_distance_km) + ' km away · ' + w.forecast_area + ' regional forecast · observation ' + age(c.time) : (errors.weather || 'Waiting for the private weather service.'));
    $('forecast').replaceChildren();
    (w.daily || []).slice(0, 4).forEach(function (d, i) {
      var div = document.createElement('div'); div.className = 'forecast-item';
      var label = document.createElement('span'); label.textContent = i === 0 ? 'Today' : formatTime(d.time, {weekday: 'short'});
      var temp = document.createElement('b'); temp.textContent = value(d.temperature_2m_max) + '° / ' + value(d.temperature_2m_min) + '°';
      var description = document.createElement('small'); description.textContent = d.precis || 'Unavailable';
      div.appendChild(label); div.appendChild(temp); div.appendChild(description); $('forecast').appendChild(div);
    });
    text('aqi', value(air.us_aqi));
    var aqi = air.us_aqi, aqiLabel = typeof aqi !== 'number' ? 'Waiting' : aqi <= 50 ? 'Good' : aqi <= 100 ? 'Moderate' : aqi <= 150 ? 'Unhealthy for sensitive groups' : aqi <= 200 ? 'Unhealthy' : aqi <= 300 ? 'Very unhealthy' : 'Hazardous';
    text('aqi-label', aqiLabel); $('aqi-marker').style.left = Math.max(0, Math.min(100, (aqi || 0) / 500 * 100)) + '%';
    text('air-note', 'US AQI · CAMS model · ' + (air.time ? 'valid ' + age(air.time) : (errors.air || 'Waiting')) + (air.fetched_at && Date.now()/1000-air.fetched_at > 7200 || errors.air ? ' · CACHED / OLD' : ''));
    text('uv', value(uv.uv_index, 1)); var u = uv.uv_index;
    text('uv-label', typeof u !== 'number' ? 'Waiting' : u < 3 ? 'Low' : u < 6 ? 'Moderate' : u < 8 ? 'High' : u < 11 ? 'Very high' : 'Extreme');
    text('uv-peak', value(uv.daily_max, 1) + (uv.fetched_at && Date.now()/1000-uv.fetched_at > 7200 || errors.uv ? ' · cached' : ''));
    text('solar-power', e.available ? value(e.solar_watts / 1000, 2) : '—');
    text('home-power', e.available ? value(e.home_watts / 1000, 2) : '—');
    var meaning = window.DaylightEnergy.explain(e, Date.now() / 1000, serviceOffline);
    text('battery', meaning.batteryText); text('grid-power', e.available ? value(e.grid_watts / 1000, 2) : '—');
    text('grid-label', meaning.gridLabel);
    text('energy-headline', meaning.headline); text('energy-story', meaning.story); text('energy-hint', meaning.hint);
    $('energy-headline').closest('.solar-card').setAttribute('data-energy-tone', meaning.tone);
    var batteryKnown = typeof e.battery_pct === 'number' && isFinite(e.battery_pct) && e.battery_pct >= 0 && e.battery_pct <= 100;
    $('battery-fill').style.width = (batteryKnown ? e.battery_pct : 0) + '%';
    if (batteryKnown) $('battery-meter').setAttribute('aria-valuenow', e.battery_pct); else $('battery-meter').removeAttribute('aria-valuenow');
    $('battery-meter').setAttribute('aria-valuetext', batteryKnown ? meaning.batteryText : 'Battery level unavailable');
    var old = e.stale || e.received_at && Date.now() / 1000 - e.received_at > 180;
    text('solar-status', demo ? 'DEMO READING' : serviceOffline ? 'NOT CONNECTED' : !e.available ? 'NO READING' : !e.online ? 'OFFLINE' : e.alarm ? 'CHECK APP' : old ? 'OLDER READING' : 'JUST UPDATED');
    text('solar-note', e.available ? 'Last reading received ' + age(e.received_at) : 'Waiting for a reading from Eveready.');
    chart('mini-chart', e.history); chart('large-chart', e.history);
    text('history-note', (e.history || []).length + ' readings collected · gaps remain visible');
    updateClock();
  }
  function updateClock() { text('clock', formatTime(Date.now() / 1000, {hour: '2-digit', minute: '2-digit'})); }
  function banner(message) { var el = $('connection-banner'); el.hidden = false; el.firstChild.textContent = message + ' '; }
  function openSetup() {
    text('pair-message', connectionNotice || 'The TV stores only its connection token. Your battery login stays on the PC.');
    $('service-url').value = connection && connection.url || (/^https?:/.test(location.protocol) ? location.origin : '');
    $('pair-code').value = '';
    if (typeof $('setup-dialog').showModal === 'function') $('setup-dialog').showModal(); else $('setup-dialog').setAttribute('open', '');
    $('service-url').focus();
  }
  function closeSetup() { if (typeof $('setup-dialog').close === 'function') $('setup-dialog').close(); else $('setup-dialog').removeAttribute('open'); $('settings').focus(); }
  function request(url, options) {
    var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 12000);
    options = Object.assign({}, options || {}, {signal: controller.signal, cache: 'no-store'});
    return fetch(url, options).then(function (response) { return response.json().then(function (body) { if (!response.ok) throw new Error(body.error || 'The service could not be reached'); return body; }); }).finally(function () { clearTimeout(timer); });
  }
  function refresh() {
    if (demo) { render(demoState()); return; }
    if (!connection || !connection.url || !connection.token) { banner('Connect to your private service, or explore the demo.'); return; }
    request(connection.url + '/api/state', {headers: {Authorization: 'Bearer ' + connection.token}}).then(function (data) {
      render(data); text('mode', 'PAIRED DISPLAY');
      if (connectionNotice) banner(connectionNotice); else $('connection-banner').hidden = true;
      $('connection-dot').classList.add('connected'); text('connection-label', 'Private service · updated ' + age(data.generated_at));
    }).catch(function (error) {
      text('mode', 'SERVICE OFFLINE'); $('connection-dot').classList.remove('connected');
      banner(error.message === 'Failed to fetch' ? 'Service unavailable. Check that the PC service is open and both devices share the home network.' : error.message);
      text('connection-label', state ? 'Last service response ' + age(state.generated_at) : 'Waiting for your private service');
      if (state) render(state, true);
    });
  }
  function startPoll() { if (poll) clearInterval(poll); refresh(); poll = setInterval(refresh, 30000); }
  function startDemo() { demo = true; text('mode', 'DEMO · SAMPLE DATA'); banner('Demo mode: all values are illustrative. Pair your private service for real readings.'); text('connection-label', 'Demo data · no location configured in this module'); $('connection-dot').classList.remove('connected'); closeSetup(); startPoll(); }
  function switchView(name) { view = name; $('overview').hidden = name !== 'overview'; $('energy').hidden = name !== 'energy'; document.querySelectorAll('[data-view]').forEach(function (b) { b.classList.toggle('selected', b.dataset.view === name); }); if (state) chart('large-chart', state.energy && state.energy.history); }
  $('settings').onclick = openSetup; $('setup-shortcut').onclick = openSetup; $('close-settings').onclick = closeSetup;
  $('refresh').onclick = refresh; $('demo-button').onclick = startDemo; $('demo-shortcut').onclick = startDemo;
  $('overview-tab').onclick = function () { switchView('overview'); }; $('energy-tab').onclick = function () { switchView('energy'); };
  $('energy-explain').onclick = function () { switchView('energy'); $('energy-tab').focus(); };
  $('disconnect').onclick = function () {
    $('disconnect').disabled = true;
    connectionStore.forget().then(function () {
      connection = null; connectionNotice = ''; demo = false; state = null; render({}); text('mode', 'NOT CONNECTED');
      $('connection-dot').classList.remove('connected'); text('connection-label', 'Waiting for your private service');
      text('pair-message', 'This display has forgotten its connection.'); banner('Display disconnected. Pair again when ready.');
    }).catch(function () { text('pair-message', 'Could not remove the saved TV pairing. Restart TizenBrew and try Forget display again.');
    }).finally(function () { $('disconnect').disabled = false; });
  };
  $('pair-form').onsubmit = function (event) {
    event.preventDefault();
    var endpoint;
    try { endpoint = new URL($('service-url').value.trim()); if (!/^https?:$/.test(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/') throw new Error(); } catch (_) { text('pair-message', 'Enter only the service address shown on the PC, without a path or password.'); return; }
    var code = $('pair-code').value.trim(); if (!/^\d{6}$/.test(code)) { text('pair-message', 'Enter the six-digit pairing code.'); return; }
    $('pair-button').disabled = true; text('pair-message', 'Pairing with your private service…');
    request(endpoint.origin + '/api/pair', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code: code})}).then(function (data) {
      connection = {url: endpoint.origin, token: data.token}; demo = false;
      return connectionStore.save(connection).then(function (remembered) {
        connectionNotice = remembered ? '' : 'Connected for this visit. Pairing could not be saved. Restart TizenBrew to enable remembered pairing.';
        closeSetup(); startPoll();
      });
    }).catch(function (error) { text('pair-message', error.message === 'Failed to fetch' ? 'Could not reach the service. Check its address and your home network.' : error.message); }).finally(function () { $('pair-button').disabled = false; });
  };
  document.addEventListener('keydown', function (event) {
    var code = event.keyCode;
    if (code === 10009 || event.key === 'Escape') { event.preventDefault(); if ($('setup-dialog').hasAttribute('open')) closeSetup(); else if (view !== 'overview') { switchView('overview'); $('overview-tab').focus(); } else openSetup(); return; }
    if (code === 403) { refresh(); return; } if (code === 406) { openSetup(); return; }
    if ([37,38,39,40].indexOf(code) === -1 || /INPUT/.test(document.activeElement.tagName) && (code === 37 || code === 39)) return;
    event.preventDefault();
    var parent = $('setup-dialog').hasAttribute('open') ? $('setup-dialog') : document;
    var controls = Array.prototype.slice.call(parent.querySelectorAll('button:not([disabled]),input:not([disabled])')).filter(function (el) { return el.getClientRects().length > 0; });
    if (!controls.length) return;
    var index = controls.indexOf(document.activeElement), direction = code === 37 || code === 38 ? -1 : 1;
    controls[index < 0 ? (direction > 0 ? 0 : controls.length - 1) : (index + direction + controls.length) % controls.length].focus();
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
  setInterval(updateClock, 30000); render({});
  if (new URLSearchParams(location.search).get('demo') === '1') startDemo(); else {
    $('pair-button').disabled = true;
    banner('Restoring your saved connection…');
    connectionStore.load().then(function (saved) { connection = saved; startPoll();
    }).finally(function () { $('pair-button').disabled = false; });
  }
  $('overview-tab').focus();
}());
