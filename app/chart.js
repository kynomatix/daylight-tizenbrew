/* Display-only smoothing; recorded samples and live power values stay unchanged. */
(function (root) {
  'use strict';
  var KEYS = ['solar_watts', 'home_watts'];
  function finite(value) { return typeof value === 'number' && isFinite(value); }
  function prepare(rows, smooth) {
    var clean = (rows || []).filter(function (row) {
      return row && finite(row.time) && KEYS.every(function (key) { return finite(row[key]) && row[key] >= 0; });
    }).slice().sort(function (a,b) { return a.time - b.time; });
    var unique = [];
    clean.forEach(function (row) {
      var copy = {time:row.time, solar_watts:row.solar_watts, home_watts:row.home_watts};
      if (unique.length && unique[unique.length-1].time === row.time) unique[unique.length-1] = copy;
      else unique.push(copy);
    });
    var segments = [], segment = [], maxGap = smooth ? 900 : 180;
    unique.forEach(function (row) {
      if (segment.length && row.time - segment[segment.length-1].time > maxGap) { segments.push(segment); segment = []; }
      segment.push(row);
    });
    if (segment.length) segments.push(segment);
    if (smooth) segments = segments.map(function (points) {
      var left = 0, right = 0;
      return points.map(function (point) {
        // A centred, triangular five-minute window, confined to this segment.
        while (points[left].time < point.time - 150) left++;
        while (right < points.length && points[right].time <= point.time + 150) right++;
        var result = {time:point.time};
        KEYS.forEach(function (key) {
          var total = 0, weight = 0;
          for (var j=left;j<right;j++) { var w = 1 - Math.abs(points[j].time-point.time)/150; total += points[j][key]*w; weight += w; }
          result[key] = total/weight;
        });
        return result;
      });
    });
    return {rows:unique, segments:segments};
  }
  function edges(points, key, smooth) {
    if (points.length < 2) return [];
    var h = [], slope = [], tangent = [];
    for (var i=0;i<points.length-1;i++) {
      h.push(points[i+1].time-points[i].time);
      slope.push((points[i+1][key]-points[i][key])/h[i]);
    }
    tangent[0] = slope[0]; tangent[points.length-1] = slope[slope.length-1];
    for (var j=1;j<points.length-1;j++) {
      var a = slope[j-1], b = slope[j], w1 = 2*h[j]+h[j-1], w2 = h[j]+2*h[j-1];
      tangent[j] = a*b <= 0 ? 0 : (w1+w2)/(w1/a+w2/b);
    }
    // Monotone cubic controls stay within neighbouring plotted values: no
    // invented peaks or negative power from a generic spline's overshoot.
    for (var k=0;k<slope.length;k++) {
      if (slope[k] === 0) { tangent[k] = 0; tangent[k+1] = 0; continue; }
      var alpha = tangent[k]/slope[k], beta = tangent[k+1]/slope[k];
      var radius = alpha*alpha+beta*beta;
      if (radius > 9) { var scale = 3/Math.sqrt(radius); tangent[k] = scale*alpha*slope[k]; tangent[k+1] = scale*beta*slope[k]; }
    }
    return points.slice(1).map(function (point,index) {
      var before = points[index], dt = point.time-before.time;
      return {from:before, to:point, estimated:smooth && dt > 180,
        c1:{time:before.time+dt/3, value:before[key]+tangent[index]*dt/3},
        c2:{time:point.time-dt/3, value:point[key]-tangent[index+1]*dt/3}};
    });
  }
  function paths(points, key, smooth, x, y) {
    var result = [];
    function coordinate(time, watts) { return x(time).toFixed(2)+' '+y(watts).toFixed(2); }
    edges(points,key,smooth).forEach(function (edge) {
      var last = result[result.length-1];
      if (!last || last.estimated !== edge.estimated) {
        last = {estimated:edge.estimated, d:'M'+coordinate(edge.from.time,edge.from[key])}; result.push(last);
      }
      last.d += smooth ? ' C'+coordinate(edge.c1.time,edge.c1.value)+' '+coordinate(edge.c2.time,edge.c2.value)+' '+coordinate(edge.to.time,edge.to[key]) : ' L'+coordinate(edge.to.time,edge.to[key]);
    });
    return result;
  }
  var api = {prepare:prepare, edges:edges, paths:paths};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DaylightChart = api;
}(typeof window !== 'undefined' ? window : this));
