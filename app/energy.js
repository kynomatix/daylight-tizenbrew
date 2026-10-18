/* Plain-language explanations from verified display data; no device control. */
(function (root) {
  'use strict';
  function finite(n) { return typeof n === 'number' && isFinite(n); }
  function explain(e, now, serviceOffline) {
    e = e || {};
    var result = {headline: 'Waiting for your home', story: 'Your latest energy reading will appear here.',
      hint: 'Keep the Eveready monitor connected to see what is happening at home.', tone: 'waiting',
      gridLabel: 'Grid power', batteryText: finite(e.battery_pct) ? Math.round(e.battery_pct) + '% full' : '—',
      shareOfUse: null, canSuggestTask: false};
    if (serviceOffline) {
      result.headline = 'The display has lost its connection';
      result.story = 'Any numbers shown are from an earlier reading.';
      result.hint = 'Wait for a fresh reading before deciding when to use extra power.';
      return result;
    }
    if (!e.available) return result;
    if (!e.online) {
      result.headline = 'The energy monitor is offline';
      result.story = 'We cannot tell what your home is doing right now.';
      result.hint = 'Check the Eveready app or wait for the connection to return.';
      return result;
    }
    if (e.alarm) {
      result.headline = 'Your energy system needs attention';
      result.story = 'The monitor is reporting an alert.';
      result.hint = 'Open the Eveready app for details.';
      result.tone = 'attention';
      return result;
    }
    if (e.stale || !finite(e.received_at) || now - e.received_at > 180 || e.received_at > now + 30) {
      result.headline = 'Waiting for a fresh reading';
      result.story = 'These numbers are from an earlier reading, so the balance may have changed.';
      result.hint = 'The display will update when fresh readings arrive.';
      return result;
    }
    if (![e.solar_watts, e.home_watts, e.grid_watts].every(finite) ||
        e.solar_watts < 0 || e.home_watts < 0 || e.grid_watts < 0) {
      result.headline = 'Checking the energy reading';
      result.story = 'Some of the numbers are missing or do not look right.';
      result.hint = 'Wait for another reading before making a decision.';
      return result;
    }
    result.tone = 'balanced';
    // This compares panel output with home demand; it is not a claim about
    // the battery's contribution, solar self-consumption or money saved.
    result.shareOfUse = e.home_watts > 0 ? Math.min(100, Math.round(e.solar_watts / e.home_watts * 100)) : null;
    result.gridLabel = e.grid_direction === 'export' ? 'Back to the grid' : e.grid_direction === 'import' ? 'From the grid' : 'Grid · direction unchecked';
    if (e.grid_direction === 'export' && e.grid_watts > 100 && e.solar_watts - e.home_watts > 100) {
      result.headline = 'Power to spare';
      result.story = 'Your panels are making more power than the home is using. Extra electricity is going back to the grid.';
      result.hint = 'A useful time to consider a household task that can wait. A big appliance may still need extra grid power.';
      result.tone = 'surplus';
      result.canSuggestTask = true;
    } else if (e.grid_direction === 'import' && e.grid_watts > 0) {
      result.headline = 'Some power is coming from the grid';
      result.story = e.solar_watts > 0 ? 'The panels are helping, and electricity is also coming in from the grid.' : 'There is little solar power right now. Electricity is coming in from the grid.';
      result.hint = 'If a household task can wait, look for “Power to spare” later.';
      result.tone = 'using-grid';
    } else if (e.solar_watts <= 0) {
      result.headline = 'No solar power right now';
      result.story = 'The panels are not producing electricity in this reading.';
      result.hint = 'The battery percentage shows how full it is, not how long it will last.';
    } else if (e.grid_direction === 'export' && e.grid_watts > 100 && e.solar_watts < e.home_watts) {
      result.headline = 'Electricity is going back to the grid';
      result.story = 'The panels are not making more than the home is using, so we cannot call this spare solar power.';
      result.hint = 'Check the battery and power flows in the Eveready app for more detail.';
    } else if (e.solar_watts >= e.home_watts && e.home_watts > 0) {
      result.headline = 'Panels are making enough for the home';
      result.story = 'Solar production is matching or exceeding the home’s current power use.';
      result.hint = 'This is the balance right now. Starting an appliance can change it.';
    } else {
      result.headline = 'Solar is helping';
      result.story = 'Your panels are making some of the power your home needs right now.';
      result.hint = 'The battery and grid readings help explain the rest of the picture.';
    }
    if (e.grid_direction !== 'export' && e.grid_direction !== 'import') {
      result.hint = 'We are still checking whether grid electricity is coming in or going out. There is no appliance recommendation yet.';
    }
    return result;
  }
  var api = {explain: explain};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DaylightEnergy = api;
}(typeof window === 'object' ? window : this));
