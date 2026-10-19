/* Generic display code. No household location, account, server or token belongs here. */
(function () {
  'use strict';
  var APP_VERSION = '0.4.0';
  var $ = function (id) { return document.getElementById(id); };
  if ($('build-version')) $('build-version').textContent = 'Daylight ' + APP_VERSION;
  var state = null, demo = false, poll = null, view = 'overview', connection = null, connectionNotice = '';
  var hourlyPage = 0;
  var serviceDisconnected = false;
  var smoothCharts = true;
  var skyLayer = 'clouds', skyIndex = -1, skyPlaying = false, skyWide = false, skySignature = '', skyGeneration = 0;
  var skyAssets = {}, skyReadyTime = null, skyLoading = false;
  var isTizenBrew = location.origin === 'http://127.0.0.1:8081' && /^\/module\//.test(location.pathname || '');
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
    var demoHours = [], end = Math.floor(now/3600)*3600 + 3600;
    for (var h=0; h<24; h++) { var wet = h >= 4 && h <= 9; demoHours.push({start_time: end+h*3600-3600, end_time: end+h*3600, temperature_2m: 19+Math.sin(h/5)*5, weather_code: wet ? 80 : 2, precipitation_probability: wet ? 75 : 10, precipitation: wet ? 1.2 : 0, wind_speed_10m: 14+h%5}); }
    return {hourly_forecast: {source: 'Open-Meteo', fetched_at: now, timezone: 'UTC', hours: demoHours}, generated_at: now, energy: {available: true, online: true, alarm: false, stale: false, received_at: now, solar_watts: 3800, home_watts: 1120, grid_watts: 2680, grid_direction: 'export', battery_pct: 73, history: history}, weather: {source: 'BOM', station: 'Example station', forecast_area: 'Example region', station_distance_km: 20, fetched_at: now, timezone: 'UTC', condition_label: 'Partly cloudy.', current: {time: now, temperature_2m: 23.7, apparent_temperature: 23, wind_speed_10m: 14, relative_humidity_2m: 54}, daily: [0, 1, 2, 3].map(function (d) { return {time: now + d * 86400, temperature_2m_min: 13 + d, temperature_2m_max: 24 + d, precis: ['Partly cloudy.', 'Mostly sunny.', 'Shower or two.', 'Sunny.'][d], rain_probability: ['10%', '5%', '60%', '5%'][d]}; })}, air: {us_aqi: 28, pm2_5: 5, fetched_at: now, time: now}, uv: {uv_index: 3.4, daily_max: 5.8, fetched_at: now}, errors: {}};
  }
  function chart(id, rows, marker, bounds) {
    var holder = $(id), width = 620, height = id === 'large-chart' ? 300 : 135, pad = 24;
    var prepared = window.DaylightChart.prepare(rows, smoothCharts);
    rows = prepared.rows;
    if (rows.length < 2) { holder.innerHTML = '<div class="chart-empty">History is gathering.<br>At least two distinct readings are needed.</div>'; return; }
    var first = bounds ? bounds[0] : rows[0].time, last = bounds ? bounds[1] : rows[rows.length - 1].time, span = Math.max(60, last - first);
    var max = Math.max.apply(null, rows.map(function (r) { return Math.max(r.solar_watts, r.home_watts); }).concat([1000]));
    var x = function (t) { return pad + (t - first) / span * (width - pad * 2); };
    var y = function (v) { return height - pad - v / max * (height - pad * 2); };
    var svg = '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + (smoothCharts ? 'Smoothed solar and household power trends; dotted sections are estimated' : 'Recorded solar and household power') + ' by receipt time">';
    [0, .5, 1].forEach(function (f) { var yy = y(max * f); svg += '<path d="M24 ' + yy + 'H596" stroke="#31434c" stroke-width="1"/><text x="0" y="' + (yy + 3) + '">' + value(max * f / 1000, 1) + '</text>'; });
    ['solar_watts', 'home_watts'].forEach(function (key, j) {
      var color = j ? '#91a9cf' : '#b9efd8';
      prepared.segments.forEach(function (segment) {
        window.DaylightChart.paths(segment,key,smoothCharts,x,y).forEach(function (path) {
          svg += '<path d="'+path.d+'" fill="none" stroke="'+color+'" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"'+(path.estimated ? ' stroke-dasharray="2 5" opacity=".8"' : '')+'/>';
        });
        segment.forEach(function (r,i) {
          if (segment.length === 1 || !smoothCharts && rows.length < 15 || segment === prepared.segments[prepared.segments.length-1] && i === segment.length-1)
            svg += '<circle cx="'+x(r.time)+'" cy="'+y(r[key])+'" r="2" fill="'+color+'"/>';
        });
      });
    });
    if (typeof marker === 'number' && marker >= first && marker <= last) svg += '<path d="M'+x(marker)+' 6V'+(height-pad)+'" stroke="#e4b569" stroke-width="1.5" stroke-dasharray="4 4"/>';
    svg += '<text x="24" y="' + (height - 3) + '">' + formatTime(first, {hour: '2-digit', minute: '2-digit'}) + '</text><text x="596" text-anchor="end" y="' + (height - 3) + '">' + formatTime(last, {hour: '2-digit', minute: '2-digit'}) + '</text></svg>';
    holder.innerHTML = svg;
  }
  function render(data, serviceOffline) {
    state = data;
    serviceDisconnected = !!serviceOffline;
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
    text('history-note', (e.history || []).length + ' readings · ' + (smoothCharts ? '5-minute smoothing · dotted joins estimated · gaps over 15 min remain' : 'Raw readings · gaps over 3 min remain'));
    text('large-history-note', (smoothCharts ? 'Five-minute smoothed trends. Short gaps are interpolated with dotted joins; gaps over 15 minutes remain visible.' : 'Original recorded values. Gaps over three minutes remain visible.') + ' Plotted by first receipt time; this is not a daily energy total.');
    ['chart-style','chart-style-large'].forEach(function (id) { text(id,smoothCharts ? 'View raw readings' : 'View smoothed trend'); });
    renderHourly(data, serviceOffline);
    if (view === 'sky') renderSky();
    updateClock();
  }
  function hourLabel(code) {
    if (code === 0 || code === 1) return 'Mostly clear';
    if (code === 2) return 'Partly cloudy'; if (code === 3) return 'Overcast';
    if (code === 45 || code === 48) return 'Fog';
    if ([51,53,55,56,57].indexOf(code) !== -1) return 'Drizzle';
    if ([61,63,65,66,67].indexOf(code) !== -1) return 'Rain';
    if ([71,73,75,77,85,86].indexOf(code) !== -1) return 'Snow';
    if ([80,81,82].indexOf(code) !== -1) return 'Showers';
    if ([95,96,99].indexOf(code) !== -1) return 'Thunderstorms';
    return 'Condition unavailable';
  }
  function hourTime(stamp, zone, weekday) {
    var options = {hour: 'numeric', minute: '2-digit', timeZone: zone || timezone};
    if (weekday) options.weekday = 'short';
    try { return new Intl.DateTimeFormat('en-AU', options).format(new Date(stamp * 1000)); }
    catch (_) { return new Date(stamp * 1000).toISOString().slice(11,16) + ' UTC'; }
  }
  function hourInterval(row, zone) { return hourTime(row.start_time, zone, true) + ' – ' + hourTime(row.end_time, zone, false); }
  function renderHourly(data, serviceOffline) {
    var forecast = data.hourly_forecast || {}, now = Date.now()/1000;
    var hours = (forecast.hours || []).filter(function (row) {
      return typeof row.start_time === 'number' && typeof row.end_time === 'number' &&
        row.end_time > now && row.end_time <= now + 86400 && row.end_time - row.start_time === 3600;
    }).sort(function (a,b) { return a.start_time - b.start_time; }).slice(0,24);
    var old = serviceDisconnected || serviceOffline || !forecast.fetched_at || now - forecast.fetched_at > 7200 || forecast.fetched_at > now + 60 || (data.errors || {}).hourly_forecast;
    text('hourly-source', 'Open-Meteo · ' + (demo ? 'DEMO FORECAST' : old ? 'CACHED / WAITING' : 'MODEL FORECAST'));
    var known = hours.filter(function (row) { return typeof row.precipitation_probability === 'number' && row.precipitation_probability >= 0 && row.precipitation_probability <= 100; });
    var peak = known.reduce(function (best,row) { return !best || row.precipitation_probability > best.precipitation_probability ? row : best; }, null);
    text('rain-summary', old && !demo ? 'Hourly forecast is unavailable or old. Refresh it before making plans.' : peak ?
      (known.length === hours.length ? 'Highest rain chance in this forecast: ' : 'Highest available rain chance: ') + value(peak.precipitation_probability) + '% during ' + hourInterval(peak, forecast.timezone) + '.' : 'Rain chances are not available yet.');
    hourlyPage = Math.min(hourlyPage, Math.max(0, Math.ceil(hours.length/6)-1));
    var start = hourlyPage * 6, page = hours.slice(start, start + 6), grid = $('hourly-grid');
    grid.replaceChildren();
    $('hourly-prev').disabled = hourlyPage === 0; $('hourly-next').disabled = start + 6 >= hours.length;
    text('hourly-range', hours.length ? 'Hours ' + (start+1) + '–' + (start+page.length) + ' of ' + hours.length : 'No hours available');
    if (!page.length) grid.innerHTML = '<p class="hourly-empty">Waiting for the hourly forecast from your PC service.</p>';
    page.forEach(function (row) {
      var card = document.createElement('article'); card.className = 'hour-card';
      function line(tag, name, content) { var el = document.createElement(tag); el.className = name; el.textContent = content; card.appendChild(el); return el; }
      line('h3', 'hour-time', hourInterval(row, forecast.timezone));
      line('div', 'hour-temperature', value(row.temperature_2m) + '°');
      line('p', 'hour-condition', hourLabel(row.weather_code));
      var chance = typeof row.precipitation_probability === 'number' && row.precipitation_probability >= 0 && row.precipitation_probability <= 100 ? row.precipitation_probability : null;
      line('p', 'hour-chance-label', 'Chance of rain');
      line('strong', 'hour-chance', value(chance) + (chance === null ? '' : '%'));
      var track = line('div', 'rain-track', ''); var fill = document.createElement('i'); fill.style.width = (chance || 0) + '%'; track.appendChild(fill);
      line('p', 'hour-amount', typeof row.precipitation === 'number' && row.precipitation >= 0 ? row.precipitation.toFixed(1) + ' mm expected' : 'Amount unavailable');
      line('p', 'hour-wind', typeof row.wind_speed_10m === 'number' && row.wind_speed_10m >= 0 ? 'Wind ' + value(row.wind_speed_10m) + ' km/h' : 'Wind unavailable');
      grid.appendChild(card);
    });
    text('hourly-note', 'Open-Meteo hourly model forecast · ' + (forecast.fetched_at ? 'fetched ' + age(forecast.fetched_at) : 'waiting for PC service update') +
      '. Rain chance includes rain, showers or snow. Amounts apply to the displayed hour; snow is expressed as water equivalent.');
  }
  function updateClock() { text('clock', formatTime(Date.now() / 1000, {hour: '2-digit', minute: '2-digit'})); }
  function banner(message) { var el = $('connection-banner'); el.hidden = false; el.firstChild.textContent = message + ' '; }
  function openSetup() {
    if ($('exit-dialog').hasAttribute('open')) closeExit();
    text('settings-intro', connection && connection.token ? 'This display is paired. Use the connection fields below only if you want to pair it again or change the PC service.' : 'Open Start Dashboard on your computer, then enter its service address and six-digit pairing code.');
    text('pair-message', connectionNotice || 'The TV stores only its connection token. Your battery login stays on the PC.');
    $('service-url').value = connection && connection.url || (/^https?:/.test(location.protocol) ? location.origin : '');
    $('pair-code').value = '';
    if (typeof $('setup-dialog').showModal === 'function') $('setup-dialog').showModal(); else $('setup-dialog').setAttribute('open', '');
    if (connection && connection.token) $('close-settings').focus(); else $('service-url').focus();
  }
  function closeSetup() { if (typeof $('setup-dialog').close === 'function') $('setup-dialog').close(); else $('setup-dialog').removeAttribute('open'); $('settings').focus(); }
  function openExit() {
    if ($('setup-dialog').hasAttribute('open')) closeSetup();
    var returnToMenu = isTizenBrew && window.history && window.history.length > 1;
    text('exit-message', returnToMenu ? 'Return to the TizenBrew app menu? Your saved pairing stays remembered, and collection continues on the PC.' : 'Leave this dashboard? Your pairing stays remembered, and collection continues on the PC.');
    text('exit-confirm', returnToMenu ? 'Return to TizenBrew' : isTizenBrew ? 'Exit to TV' : 'Close dashboard');
    if (typeof $('exit-dialog').showModal === 'function') $('exit-dialog').showModal(); else $('exit-dialog').setAttribute('open','');
    $('exit-cancel').focus();
  }
  function closeExit() {
    if (typeof $('exit-dialog').close === 'function') $('exit-dialog').close(); else $('exit-dialog').removeAttribute('open');
    $(view + '-tab').focus();
  }
  function leaveDashboard() {
    // TizenBrew opens app modules using location.href, so Back returns to its
    // existing menu without guessing a file URL or restarting the launcher.
    if (window.history && window.history.length > 1) { window.history.back(); return; }
    try {
      if (window.tizen && window.tizen.application) { window.tizen.application.getCurrentApplication().exit(); return; }
    } catch (_) {}
    if (!isTizenBrew) { window.close(); text('exit-message','Close this browser tab to leave the dashboard preview.'); return; }
    text('exit-message','The launcher has no previous page available. Press Home, or press and hold Back to close TizenBrew. Your pairing will stay remembered.');
  }
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
  function startDemo() { clearSkyAssets(); demo = true; text('mode', 'DEMO · SAMPLE DATA'); banner('Demo mode: all values are illustrative. Pair your private service for real readings.'); text('connection-label', 'Demo data · no location configured in this module'); $('connection-dot').classList.remove('connected'); closeSetup(); startPoll(); }
  function switchView(name) { view = name; ['overview','energy','hourly','sky'].forEach(function (id) { $(id).hidden = name !== id; }); document.querySelectorAll('[data-view]').forEach(function (b) { b.classList.toggle('selected', b.dataset.view === name); }); if (name !== 'sky') { skyPlaying = false; skyGeneration++; } if (state) chart('large-chart', state.energy && state.energy.history); if (name === 'sky') renderSky(); }
  function skyData() { return state && state.imagery && state.imagery.layers && state.imagery.layers[skyLayer] || {}; }
  function stopSky() { skyPlaying = false; text('sky-play','Play'); }
  function clearSkyAssets() { skyGeneration++; Object.keys(skyAssets).forEach(function (k) { skyAssets[k].then(function (url) { URL.revokeObjectURL(url); }).catch(function () {}); }); skyAssets = {}; skySignature = ''; stopSky(); }
  function skyAsset(key) {
    if (!connection || !/^[a-f0-9]{64}$/.test(key || '')) return Promise.reject(new Error('Image unavailable'));
    if (!skyAssets[key]) {
      var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); },12000);
      skyAssets[key] = fetch(connection.url+'/api/imagery/'+key,{headers:{Authorization:'Bearer '+connection.token},signal:controller.signal,cache:'no-store'}).then(function (r) {
        if (!r.ok) throw new Error('Image unavailable'); return r.blob();
      }).then(function (blob) { return URL.createObjectURL(blob); }).catch(function (error) { delete skyAssets[key]; throw error; }).finally(function () { clearTimeout(timer); });
    }
    return skyAssets[key];
  }
  function renderSky() {
    if (view !== 'sky') return;
    var data = skyData(), frames = data.frames || [], signature = skyLayer+frames.map(function (f) { return f.asset; }).join('');
    if (signature !== skySignature) {
      // Old object URLs must not grow without bound as the PC rotates frames.
      clearSkyAssets(); skySignature = signature; skyIndex = frames.length-1; skyReadyTime = null;
    }
    ['clouds','rain'].forEach(function (id) { $('sky-'+id).classList.toggle('selected',skyLayer === id); });
    var latest = frames.length ? frames[frames.length-1].time : 0;
    var failed = state && state.imagery && state.imagery.errors && state.imagery.errors[skyLayer];
    var stale = !latest || Date.now()/1000-latest > (skyLayer === 'rain' ? 1200 : 2700) || latest > Date.now()/1000+60 || serviceDisconnected || failed;
    text('sky-status',demo ? 'DEMO · NO LIVE IMAGERY' : !latest ? 'WAITING FOR BOM' : stale ? 'OLDER / CACHED IMAGES' : 'BOM · OBSERVED');
    text('sky-description',skyLayer === 'rain' ? 'Radar shows rain, hail or snow echoes, not all cloud. It can miss light rain or show echoes that never reach the ground.' : 'Satellite imagery shows cloud patterns over a broader area. The regional view is approximate, not a measurement of sunlight at your roof.');
    text('sky-note',(failed ? failed+' ' : '')+'Observed movement only · no predicted path. '+(skyLayer === 'rain' ? 'Colours show radar echo intensity; the scale runs from light to intense.' : 'Visible cloud detail is less useful at night.'));
    $('sky-extent').hidden = skyLayer !== 'clouds'; text('sky-extent',skyWide ? 'Regional view' : 'Wider view');
    $('sky-prev').disabled = frames.length < 2 || skyIndex <= 0; $('sky-next').disabled = frames.length < 2 || skyIndex >= frames.length-1;
    $('sky-play').disabled = frames.length < 2 || !!stale; if (stale) stopSky(); text('sky-play',skyPlaying ? 'Pause' : 'Play');
    if (!frames.length || demo) {
      $('sky-images').hidden = true; $('sky-legend').hidden = true; $('sky-legend-box').hidden = true; $('sky-empty').hidden = false;
      text('sky-empty',demo ? 'Demo preview · connect your home service for real cloud and radar images.' : 'BOM images are gathering on your computer. They appear here when ready.');
      text('sky-time','No image available'); text('sky-solar','—'); text('sky-solar-time','Waiting for matching history');
      chart('sky-chart',[]); return;
    }
    skyIndex = Math.max(0,Math.min(frames.length-1,skyIndex));
    var frame = frames[skyIndex], generation = ++skyGeneration; skyLoading = true;
    if (skyReadyTime !== frame.time) { $('sky-empty').hidden = false; text('sky-empty','Loading observed image…'); }
    var keys = [frame.asset,data.background,data.locations,data.legend];
    Promise.all(keys.map(function (key) { return key ? skyAsset(key) : Promise.resolve(null); })).then(function (urls) {
      if (generation !== skyGeneration || view !== 'sky') return;
      ['sky-frame','sky-background','sky-locations','sky-legend'].forEach(function (id,i) { $(id).hidden = !urls[i]; if (urls[i]) $(id).src = urls[i]; });
      $('sky-legend-box').hidden = !urls[3];
      $('sky-frame').alt = skyLayer === 'rain' ? 'Observed BOM rain radar' : 'Observed BOM satellite cloud image';
      var viewport = data.viewport || {}, zoom = skyLayer === 'clouds' && !skyWide ? Math.max(1,Math.min(5,Number(viewport.zoom)||1)) : 1;
      var xx = Math.max(0,Math.min(1,Number(viewport.x)||0)), yy = Math.max(0,Math.min(1,Number(viewport.y)||0));
      $('sky-images').style.transformOrigin = '50% 50%'; $('sky-images').style.transform = zoom > 1 ? 'translate('+((.5-xx)*zoom*100)+'%,'+((.5-yy)*zoom*100)+'%) scale('+zoom+')' : 'none';
      $('sky-map').setAttribute('data-layer',skyLayer); $('sky-images').hidden = false; $('sky-empty').hidden = true; skyReadyTime = frame.time;
      text('sky-time',formatTime(frame.time,{hour:'2-digit',minute:'2-digit'})+' · '+(skyIndex+1)+' / '+frames.length+' · '+age(frame.time)+(stale ? ' · OLD / CACHED' : ' · observed'));
      var first = frames[0].time, last = Math.max(first+60,latest), rows = state.energy && state.energy.history || [];
      rows = rows.filter(function (r) { return r.time >= first && r.time <= last; });
      var nearest = rows.reduce(function (best,r) { return !best || Math.abs(r.time-frame.time)<Math.abs(best.time-frame.time) ? r : best; },null);
      var matched = nearest && Math.abs(nearest.time-frame.time) <= 180;
      text('sky-solar',matched ? value(nearest.solar_watts/1000,2)+' kW' : '—');
      text('sky-solar-time',matched ? 'Recorded '+formatTime(nearest.time,{hour:'2-digit',minute:'2-digit'})+' · within 3 minutes of image' : 'No recorded solar reading within 3 minutes of this image');
      chart('sky-chart',rows,frame.time,[first,last]);
    }).catch(function () { if (generation !== skyGeneration) return; stopSky(); $('sky-images').hidden = true; $('sky-legend').hidden = true; $('sky-legend-box').hidden = true; $('sky-empty').hidden = false; text('sky-empty','Image unavailable. Try Refresh or check the PC service.'); text('sky-time','Image unavailable'); text('sky-solar','—'); text('sky-solar-time','Image unavailable'); skyReadyTime = null; }).finally(function () { if (generation === skyGeneration) skyLoading = false; });
  }
  $('sky-tab').onclick = function () { switchView('sky'); };
  ['clouds','rain'].forEach(function (layer) { $('sky-'+layer).onclick = function () { stopSky(); skyLayer = layer; skySignature = ''; renderSky(); }; });
  $('sky-prev').onclick = function () { stopSky(); skyIndex--; renderSky(); }; $('sky-next').onclick = function () { stopSky(); skyIndex++; renderSky(); };
  $('sky-play').onclick = function () { skyPlaying = !skyPlaying; text('sky-play',skyPlaying ? 'Pause' : 'Play'); };
  $('sky-extent').onclick = function () { skyWide = !skyWide; renderSky(); };
  $('sky-hourly').onclick = function () { switchView('hourly'); $('hourly-tab').focus(); };
  setInterval(function () { if (view === 'sky' && skyPlaying && !skyLoading && !document.hidden && !$('setup-dialog').hasAttribute('open') && !$('exit-dialog').hasAttribute('open')) { var frames = skyData().frames || []; if (frames.length > 1) { skyIndex = (skyIndex+1)%frames.length; renderSky(); } } },1400);
  $('settings').onclick = openSetup; $('setup-shortcut').onclick = openSetup; $('close-settings').onclick = closeSetup;
  $('settings-exit').onclick = openExit; $('exit-cancel').onclick = closeExit; $('exit-confirm').onclick = leaveDashboard;
  $('setup-dialog').addEventListener('cancel',function (event) { event.preventDefault(); closeSetup(); });
  $('exit-dialog').addEventListener('cancel',function (event) { event.preventDefault(); closeExit(); });
  $('refresh').onclick = refresh; $('demo-button').onclick = startDemo; $('demo-shortcut').onclick = startDemo;
  $('overview-tab').onclick = function () { switchView('overview'); }; $('energy-tab').onclick = function () { switchView('energy'); };
  $('hourly-tab').onclick = function () { switchView('hourly'); };
  $('hourly-open').onclick = function () { hourlyPage = 0; if (state) renderHourly(state); switchView('hourly'); $('hourly-tab').focus(); };
  $('hourly-prev').onclick = function () { hourlyPage = Math.max(0,hourlyPage-1); if (state) renderHourly(state); if ($('hourly-prev').disabled) $('hourly-next').focus(); };
  $('hourly-next').onclick = function () { hourlyPage++; if (state) renderHourly(state); if ($('hourly-next').disabled) $('hourly-prev').focus(); };
  $('energy-explain').onclick = function () { switchView('energy'); $('energy-tab').focus(); };
  function toggleChartStyle() { smoothCharts = !smoothCharts; if (state) render(state,serviceDisconnected); }
  $('chart-style').onclick = toggleChartStyle; $('chart-style-large').onclick = toggleChartStyle;
  $('disconnect').onclick = function () {
    $('disconnect').disabled = true;
    connectionStore.forget().then(function () {
      clearSkyAssets(); connection = null; connectionNotice = ''; demo = false; state = null; render({}); text('mode', 'NOT CONNECTED');
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
    if (code === 10009 || event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation();
      if ($('exit-dialog').hasAttribute('open')) closeExit();
      else if ($('setup-dialog').hasAttribute('open')) closeSetup();
      else if (view !== 'overview') { switchView('overview'); $('overview-tab').focus(); }
      else openExit();
      return;
    }
    if (code === 403) { refresh(); return; } if (code === 406) { openSetup(); return; }
    if ([37,38,39,40].indexOf(code) === -1 || /INPUT/.test(document.activeElement.tagName) && (code === 37 || code === 39)) return;
    event.preventDefault();
    var parent = $('exit-dialog').hasAttribute('open') ? $('exit-dialog') : $('setup-dialog').hasAttribute('open') ? $('setup-dialog') : document;
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
