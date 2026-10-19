/* Generic radar renderer. Geography and place names come only from the paired PC. */
(function (root) {
  'use strict';
  function layout(width,height,full,focusY) {
    var w=512,h=512,x=0,y=0;
    if (!full) {
      if (width>=height) { h=512*height/width; y=Math.max(0,Math.min(512-h,(Number(focusY)||.5)*512-h/2)); }
      else { w=512*width/height; x=(512-w)/2; }
    }
    var scale=Math.min(width/w,height/h);
    return {x:x,y:y,width:w,height:h,scale:scale,offsetX:(width-w*scale)/2,offsetY:(height-h*scale)/2};
  }
  function screenPoint(x,y,l) { return {x:l.offsetX+(x-l.x)*l.scale,y:l.offsetY+(y-l.y)*l.scale}; }
  function escape(text) { return String(text).replace(/[&<>"']/g,function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function svg(map,url,width,height,full) {
    var l=layout(width,height,full,map.focus_y), unit=1/l.scale;
    var s='<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+[l.x,l.y,l.width,l.height].join(' ')+'" role="img" aria-label="Observed BOM rain on the Daylight map">';
    s+='<rect x="'+l.x+'" y="'+l.y+'" width="'+l.width+'" height="'+l.height+'" fill="#102a35"/>';
    (map.land||[]).slice(0,100).forEach(function (path) { if (typeof path==='string' && path.length<100000 && /^[MLZ0-9., -]+$/.test(path)) s+='<path d="'+path+'" fill="#29463f" stroke="#6a9182" stroke-width="'+(.9*unit)+'" stroke-linejoin="round"/>'; });
    for(var g=64;g<512;g+=64) s+='<path d="M'+g+' 0V512M0 '+g+'H512" stroke="#abc7bc" stroke-opacity=".055" stroke-width="'+unit+'"/>';
    s+='<defs><clipPath id="radar-pixels"><rect x="0" y="16" width="512" height="496"/></clipPath></defs>';
    if (/^blob:/.test(url||'')) s+='<image href="'+escape(url)+'" x="0" y="0" width="512" height="512" preserveAspectRatio="none" clip-path="url(#radar-pixels)"/>';
    s+='<circle cx="256" cy="256" r="255" fill="none" stroke="#bad5c7" stroke-opacity=".3" stroke-dasharray="5 7" stroke-width="'+unit+'"/>';
    var occupied=[];
    (map.places||[]).slice(0,50).forEach(function (p) {
      if (typeof p.name!=='string' || !isFinite(p.x) || !isFinite(p.y)) return;
      var screen=screenPoint(p.x,p.y,l), labelWidth=Math.min(170,p.name.length*7.6), x=screen.x+8, y=screen.y-8;
      if (x+labelWidth>width-14) x=screen.x-labelWidth-8;
      var box={x:x-3,y:y-15,w:labelWidth+6,h:25};
      if (screen.x<15 || screen.x>width-15 || screen.y<27 || screen.y>height-40 || occupied.some(function (b) {return box.x<b.x+b.w && box.x+box.w>b.x && box.y<b.y+b.h && box.y+box.h>b.y;})) return;
      occupied.push(box);
      var tx=l.x+(x-l.offsetX)*unit,ty=l.y+(y-l.offsetY)*unit;
      s+='<circle cx="'+p.x+'" cy="'+p.y+'" r="'+(2.2*unit)+'" fill="#e2ece6"/>';
      s+='<text x="'+tx+'" y="'+ty+'" fill="#eff5f0" font-size="'+(14*unit)+'" font-family="Segoe UI,Arial,sans-serif" font-weight="500" stroke="#10232e" stroke-width="'+(3.5*unit)+'" stroke-linejoin="round" paint-order="stroke">'+escape(p.name)+'</text>';
    });
    var km=50,bar=km/(map.range_km||128)*256,by=l.y+l.height-20*unit,bx=l.x+22*unit;
    s+='<path d="M'+bx+' '+(by-5*unit)+'V'+by+'h'+bar+'v'+(-5*unit)+'" fill="none" stroke="#dceae2" stroke-width="'+(1.5*unit)+'"/>';
    s+='<text x="'+bx+'" y="'+(by-10*unit)+'" fill="#dceae2" font-size="'+(11*unit)+'" font-family="Arial,sans-serif">50 km</text>';
    s+='<text x="'+(l.x+l.width-23*unit)+'" y="'+(l.y+27*unit)+'" fill="#dceae2" font-size="'+(12*unit)+'" text-anchor="middle" font-family="Arial,sans-serif">N</text></svg>';
    return s;
  }
  var api={layout:layout,screenPoint:screenPoint,svg:svg};
  if (typeof module==='object' && module.exports) module.exports=api;
  else root.DaylightRadar=api;
}(typeof window==='object' ? window : this));
