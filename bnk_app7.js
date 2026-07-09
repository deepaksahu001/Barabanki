// Barabanki District Health Map - App Logic (Varanasi style)
// Sheet ID pre-filled: 1vkak-mpwXZxGPErL_k2AGTDkr32eDwZyBkf-5vGNyac

var BNAMES=['Bani Kodar','Banki','Dariyabad','Dewa','Fatehpur','Haidargarh','Harakh','Masauli','Nindaura','Puredalai','Ramnagar','Siddhaur','Sirauli Gauspur','Suratganj','Trivediganj'];
var DC={'Bani Kodar':'#4e79a7','Banki':'#f28e2b','Dariyabad':'#e15759','Dewa':'#76b7b2','Fatehpur':'#59a14f','Haidargarh':'#edc948','Harakh':'#b07aa1','Masauli':'#ff9da7','Nindaura':'#9c755f','Puredalai':'#bab0ac','Ramnagar':'#d4a6c8','Siddhaur':'#85c1e9','Sirauli Gauspur':'#82e0aa','Suratganj':'#f9e79f','Trivediganj':'#aeb6bf'};
var BCOLORS=JSON.parse(JSON.stringify(DC));
var TC={DH:'#2e7d32',CHC:'#e53935',ACHC:'#e53935',PHC:'#1976d2',SC:'#f57c00'};
var TI={DH:'🏥',CHC:'🏨',ACHC:'🏨',PHC:'🏥',SC:'🔸'};
var TLBL={DH:'DH',CHC:'C',ACHC:'C',PHC:'P'};
var LIVE={};
var FAC_RAW=[],FAC_TYPES={};
var map,blockLyr,mkrLyr=null,extFacLyr=null;
var blblMks=[],mkrMap={DH:[],CHC:[],ACHC:[],PHC:[]};
var mkrVis={DH:true,CHC:true,ACHC:true,PHC:true};
var CURBLK=null,fillOn=true,fillOp=0.15,CM='default',PL='landscape';
var blockOn={};BNAMES.forEach(function(b){blockOn[b]=true;});
var curTile=null,tileLyrs={};
var SHAPE_OPTIONS=[
  {v:'circle',label:'&#9679; Circle'},{v:'square',label:'&#9632; Square'},
  {v:'diamond',label:'&#9670; Diamond'},{v:'triangle',label:'&#9650; Triangle'},
  {v:'plus',label:'&#10010; Plus'},{v:'star',label:'&#9733; Star'},
  {v:'pin',label:'&#128205; Pin'},{v:'ring',label:'&#9711; Ring'},
  {v:'e_hospital',label:'&#127973; Hospital'},{v:'e_cross',label:'&#10010; Red Cross'},
  {v:'e_pill',label:'&#128138; Pill'}
];
var EMAP={e_hospital:'🏥',e_cross:'➕',e_pill:'💊'};

function el(id){return document.getElementById(id);}

window.onload=function(){
  el('lstep').textContent='Loading map...';
  tileLyrs={
    osm:L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OSM',maxZoom:19}),
    sat:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'&copy; Esri',maxZoom:18}),
    topo:L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenTopoMap',maxZoom:17}),
    carto:L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{attribution:'&copy; CartoDB',maxZoom:19}),
    dark:L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{attribution:'&copy; CartoDB',maxZoom:19})
  };
  map=L.map('lmap',{zoomControl:false}).setView([26.93,81.37],10);
  L.control.zoom({position:'bottomleft'}).addTo(map);
  curTile=tileLyrs.carto;curTile.addTo(map);
  map.on('zoomend moveend',function(){
    if(el('SB').classList.contains('on'))updSB();
    autoOpacity();
  });
  map.on('click',function(){
    if(CURBLK){
      CURBLK=null;
      applyBS();
      showPH();
      renderExtFac();  // restore all facilities
    }
  });
  el('lstep').textContent='Building blocks...';
  blockLyr=L.geoJSON(BGEO,{
    style:function(f){return bStyle(f.properties.tehs_name);},
    onEachFeature:function(f,lyr){
      var nm=f.properties.tehs_name;
      lyr.on({
        click:function(e){L.DomEvent.stopPropagation(e);selBlock(nm,lyr);},
        mouseover:function(e){
          if(CURBLK!==nm)lyr.setStyle({fillOpacity:Math.min(fillOp+0.25,1)});
          var facs=FAC_BY_BLOCK[nm]||[];
          var sc=facs.filter(function(x){return x.type==='SC';}).length;
          var ns=facs.length-sc;
          showTip('<b>'+nm+' Block</b><br><small>'+ns+' facilities &middot; '+sc+' SC</small>',e.originalEvent);
        },
        mouseout:function(){if(CURBLK!==nm)blockLyr.resetStyle(lyr);hideTip();}
      });
    }
  }).addTo(map);
  el('lstep').textContent='Adding labels...';
  buildBlbl();buildBTogList();buildBClrList();buildLegend();
  try{var b=blockLyr.getBounds();if(b.isValid())map.fitBounds(b,{padding:[8,8]});}catch(e){}
  setTimeout(function(){
    map.invalidateSize();
    el('loadmask').classList.add('done');
    // Show HFR markers immediately on load
    renderExtFac();
    // Then auto-load the Google Sheet (overrides HFR markers when loaded)
    loadFac();
  },400);
  // Sidebar auto open on desktop (flex layout) - mobile starts closed
};

function toggleSidebar(){
  var sb=el('sb');
  if(sb.classList.contains('open'))closeSidebar();else openSidebar();
}
function openSidebar(){
  el('sb').classList.add('open');
  var ov=el('sb-overlay');if(ov)ov.classList.add('show');
}
function closeSidebar(){
  el('sb').classList.remove('open');
  var ov=el('sb-overlay');if(ov)ov.classList.remove('show');
}
function goTab(id,e2){
  document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('act');});
  document.querySelectorAll('.tc').forEach(function(t){t.classList.remove('act');});
  el('tc-'+id).classList.add('act');
  var tabs=['layers','fac','info','more'];
  var btns=document.querySelectorAll('.tab');
  tabs.forEach(function(n,i){if(n===id&&btns[i])btns[i].classList.add('act');});
}

// Block style
function bStyle(nm){
  if(!blockOn[nm])return{weight:0,fillOpacity:0};
  if(CURBLK&&CURBLK!==nm){
    // Dimmed: other blocks fade out
    return{fillColor:getBC(nm),weight:0.8,opacity:0.35,color:'#1a3c5e',fillOpacity:fillOn?Math.min(fillOp,0.04):0,stroke:true};
  }
  if(CURBLK===nm){
    // Selected block: highlight but also follows zoom opacity
    var selOp=fillOn?Math.min(Math.max(fillOp,0.08),0.45):0;
    return{fillColor:getBC(nm),weight:3,opacity:1,color:'#1a3c5e',fillOpacity:selOp,stroke:true};
  }
  return{fillColor:getBC(nm),weight:1.5,opacity:1,color:'#1a3c5e',fillOpacity:fillOn?fillOp:0,stroke:true};
}
function getBC(nm){
  if(CM==='manual'||CM==='default')return BCOLORS[nm]||'#ccc';
  if(CM==='chc'){var n=(FAC_BY_BLOCK[nm]||[]).filter(function(f){return f.type==='CHC'||f.type==='ACHC';}).length;return n>=3?'#1565c0':n>=2?'#1976d2':n>=1?'#90caf9':'#e3f2fd';}
  if(CM==='phc'){var n=(FAC_BY_BLOCK[nm]||[]).filter(function(f){return f.type==='PHC';}).length;return n>=5?'#1565c0':n>=3?'#1976d2':n>=1?'#90caf9':'#e3f2fd';}
  if(CM==='sc'){var n=(FAC_BY_BLOCK[nm]||[]).filter(function(f){return f.type==='SC';}).length;return n>=37?'#1565c0':n>=32?'#1976d2':n>=28?'#42a5f5':'#90caf9';}

  return BCOLORS[nm]||'#ccc';
}
function applyBS(){blockLyr.setStyle(function(f){return bStyle(f.properties.tehs_name);});}
function resetBStyle(){CURBLK=null;applyBS();}
function togFill(){fillOn=!fillOn;el('fill-btn').textContent=fillOn?'🎨 Disable Fill Colors':'⬜ Enable Fill Colors';applyBS();}
function setOp(v){fillOp=v/100;el('sl-val').textContent=v+'%';if(fillOn)applyBS();}
function setCM(m){CM=m;var mcs=el('mc-sec');if(mcs)mcs.style.display=(m==='manual')?'block':'none';applyBS();updChoLeg(m);}
function changeBC(nm,col){BCOLORS[nm]=col;applyBS();buildLegend();var d=el('bdot-'+nm.replace(/\s/g,'_'));if(d)d.style.background=col;}
function resetBClrs(){BCOLORS=JSON.parse(JSON.stringify(DC));buildBClrList();applyBS();buildLegend();}

function updChoLeg(m){
  var lg=el('cho-leg');if(!lg)return;
  if(m==='default'||m==='manual'){lg.classList.remove('show');return;}
  lg.classList.add('show');
  var ti=el('cho-title'),it=el('cho-items');
  if(m==='chc'){ti.textContent='CHC Count';it.innerHTML='<div class="cho-row"><div class="cho-sw" style="background:#1565c0"></div>3 or more</div><div class="cho-row"><div class="cho-sw" style="background:#1976d2"></div>2</div><div class="cho-row"><div class="cho-sw" style="background:#90caf9"></div>1</div><div class="cho-row"><div class="cho-sw" style="background:#e3f2fd"></div>0</div>';}
  else if(m==='phc'){ti.textContent='PHC Count';it.innerHTML='<div class="cho-row"><div class="cho-sw" style="background:#1565c0"></div>5+</div><div class="cho-row"><div class="cho-sw" style="background:#1976d2"></div>3-4</div><div class="cho-row"><div class="cho-sw" style="background:#90caf9"></div>1-2</div><div class="cho-row"><div class="cho-sw" style="background:#e3f2fd"></div>0</div>';}
  else if(m==='sc'){ti.textContent='SC Count';it.innerHTML='<div class="cho-row"><div class="cho-sw" style="background:#1565c0"></div>37+</div><div class="cho-row"><div class="cho-sw" style="background:#1976d2"></div>32-36</div><div class="cho-row"><div class="cho-sw" style="background:#42a5f5"></div>28-31</div><div class="cho-row"><div class="cho-sw" style="background:#90caf9"></div>&lt;28</div>';}

}

// Block selection
function selBlock(nm,lyr){
  CURBLK=nm;
  applyBS();  // dims all others, highlights selected
  // Fly to selected block bounds
  if(lyr){
    try{
      var b=lyr.getBounds();
      if(b.isValid())map.flyToBounds(b,{padding:[40,40],maxZoom:13,duration:0.8});
    }catch(e){}
  }
  goTab('info',null);showBInfo(nm);
  if(window.innerWidth<=768){openSidebar();}
  setTimeout(function(){var sb=el('sb');if(sb)sb.scrollTop=el('tc-info').offsetTop||0;},120);
  // Re-render facilities to show only this block's facilities
  renderExtFac();
}
function showBInfo(nm){
  var facs=FAC_BY_BLOCK[nm]||[];
  var cnt={DH:0,CHC:0,ACHC:0,PHC:0,SC:0};
  facs.forEach(function(f){if(cnt[f.type]!==undefined)cnt[f.type]++;});
  el('iname').textContent=nm+' Block';
  var sg=el('istats');sg.innerHTML='';
  [{k:'DH',c:'#2e7d32'},{k:'CHC',c:'#e53935'},{k:'PHC',c:'#1976d2'},{k:'SC',c:'#f57c00'}].forEach(function(t){
    if(cnt[t.k]===0&&t.k!=='SC')return;
    var d=document.createElement('div');d.className='sbox';
    var v=(t.k==='CHC')?(cnt.CHC+cnt.ACHC):cnt[t.k];
    var lbl=(t.k==='CHC'&&cnt.ACHC>0)?'CHC ('+cnt.ACHC+' Addl.)':t.k;
    d.innerHTML='<div class="sv" style="color:'+t.c+'">'+v+'</div><div class="sl2">'+lbl+'</div>';
    sg.appendChild(d);
  });
  // Facility list
  var mf=facs.filter(function(f){return f.type!=='SC';});
  mf.sort(function(a,b){var o=['DH','CHC','ACHC','PHC'];return o.indexOf(a.type)-o.indexOf(b.type);});
  var ifl=el('ifacs');ifl.innerHTML='';
  mf.forEach(function(f){
    var col=TC[f.type]||'#888';
    var ina=(f.status!=='Active'&&f.status!=='active')?' <span style="color:#bbb;font-size:9px">(Inactive)</span>':'';
    var div=document.createElement('div');div.className='fi';
    div.innerHTML='<div class="fd" style="background:'+col+'"></div><div class="fn">'+f.name+ina+'</div><div class="ft2">'+f.type+'</div><span style="color:var(--pl);font-size:10px;">&#8982;</span>';
    if(f.lat&&f.lon)(function(la,lo){div.addEventListener('click',function(){map.flyTo([la,lo],15,{duration:1.2});});})(f.lat,f.lon);
    ifl.appendChild(div);
  });
  // SC section
  var sf=facs.filter(function(f){return f.type==='SC';});
  var ss=el('isc-sec');
  if(sf.length>0){
    ss.style.display='block';el('isc-title').textContent='Sub Centres ('+sf.length+')';
    el('isc-body').classList.remove('open');el('isc-arr').innerHTML='&#9660;';
    var sb2=el('isc-body');sb2.innerHTML='';
    sf.forEach(function(f){
      var ina=(f.status!=='Active'&&f.status!=='active')?' <span style="color:#bbb;font-size:9px">(Inactive)</span>':'';
      var div=document.createElement('div');div.className='fi';
      div.innerHTML='<div class="fd" style="background:#f57c00"></div><div class="fn">'+f.name+ina+'</div><div class="ft2">SC</div><span style="color:var(--pl);font-size:10px;">&#8982;</span>';
      if(f.lat&&f.lon)(function(la,lo){div.addEventListener('click',function(){map.flyTo([la,lo],15,{duration:1.2});});})(f.lat,f.lon);
      sb2.appendChild(div);
    });
  } else {ss.style.display='none';}
  // Live data
  var ld=LIVE[nm],ls=el('i-live')||null;
  if(ld&&ls){
    ls.style.display='block';
    var lst=el('i-live-stats');if(lst){
      lst.innerHTML='';
      [{k:'pregnant',l:'Pregnant',c:'#e91e63'},{k:'newborn',l:'Newborns',c:'#0288d1'},{k:'anc',l:'ANC Visits',c:'#7b1fa2'},{k:'highRisk',l:'High Risk',c:'#e53935'}].forEach(function(t){
        var d=document.createElement('div');d.className='sbox';
        d.innerHTML='<div class="sv" style="color:'+t.c+'">'+(ld[t.k]||0)+'</div><div class="sl2">'+t.l+'</div>';
        lst.appendChild(d);
      });
    }
  } else if(ls){ls.style.display='none';}
  el('info-ph').style.display='none';el('info-det').style.display='block';
}
function togSCList(){var b=el('isc-body'),a=el('isc-arr');var o=b.classList.toggle('open');a.innerHTML=o?'&#9650;':'&#9660;';}
function showPH(){el('info-ph').style.display='block';el('info-det').style.display='none';}

// Markers (HFR data from bnk_fac.js)
function buildMkrs(){
  if(!mkrLyr)return;mkrLyr.clearLayers();mkrMap={DH:[],CHC:[],ACHC:[],PHC:[]};
  MKRS.forEach(function(m){
    if(!blockOn[m.block])return;
    var col=TC[m.type]||'#888',lb=TLBL[m.type]||m.type;
    var icon=L.divIcon({className:'',html:'<div style="width:22px;height:22px;border-radius:4px;background:'+col+';display:flex;align-items:center;justify-content:center;color:white;font-size:9px;font-weight:700;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);">'+lb+'</div>',iconSize:[22,22],iconAnchor:[11,11]});
    var mk=L.marker([m.lat,m.lon],{icon:icon});
    mk.bindTooltip('<b>'+m.name+'</b><br>'+m.type+' &middot; '+m.status+'<br>'+m.block,{direction:'top',offset:[0,-12]});
    if(mkrVis[m.type]!==false)mk.addTo(mkrLyr);
    if(mkrMap[m.type])mkrMap[m.type].push(mk);
  });
}
function togFLyr(type,on){
  // HFR inbuilt markers removed — use Facilities tab Google Sheet instead
}


// Labels
function centroid(coords){var rings=[];(function w(a){if(a.length&&typeof a[0][0]==='number'){rings.push(a);return;}a.forEach(w);})(coords);var best=null,bestA=-1;rings.forEach(function(ring){var ar=0,cx=0,cy=0;for(var i=0;i<ring.length-1;i++){var x0=ring[i][0],y0=ring[i][1],x1=ring[i+1][0],y1=ring[i+1][1];var cr=x0*y1-x1*y0;ar+=cr;cx+=(x0+x1)*cr;cy+=(y0+y1)*cr;}ar*=0.5;var aa=Math.abs(ar);if(aa>1e-12&&aa>bestA){bestA=aa;best=[cy/(6*ar),cx/(6*ar)];}});if(best)return best;var pts=[];(function c(a){if(typeof a[0][0]==='number')a.forEach(function(p){pts.push(p);});else a.forEach(c);})(coords);return[pts.reduce(function(s,p){return s+p[1];},0)/pts.length,pts.reduce(function(s,p){return s+p[0];},0)/pts.length];}
function buildBlbl(){blblMks.forEach(function(m){map.hasLayer(m)&&map.removeLayer(m);});blblMks=[];BGEO.features.forEach(function(f){var nm=f.properties.tehs_name;if(blockOn[nm]===false)return;var c=centroid(f.geometry.coordinates);var ic=L.divIcon({className:'',html:'<div style="font-size:10px;font-weight:700;color:#1a237e;text-shadow:1px 1px 0 #fff,-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff;white-space:nowrap;pointer-events:none;">'+nm+'</div>',iconSize:null,iconAnchor:null});var m=L.marker(c,{icon:ic,interactive:false,zIndexOffset:-100});m.addTo(map);blblMks.push(m);});}
function togBlbl(on){blblMks.forEach(function(m){if(on){if(!map.hasLayer(m))m.addTo(map);}else{if(map.hasLayer(m))map.removeLayer(m);}});}

// Block toggle list (Varanasi style with GP count)
function buildBTogList(){
  var cont=el('block-filter-list');cont.innerHTML='';
  BNAMES.forEach(function(nm){
    var facs=FAC_BY_BLOCK[nm]||[];
    var ns=facs.filter(function(f){return f.type!=='SC';}).length;
    var sc=facs.filter(function(f){return f.type==='SC';}).length;
    var div=document.createElement('div');div.className='brow on';div.id='brow-'+nm.replace(/\s/g,'_');
    div.innerHTML='<div class="bdot" id="bdot-'+nm.replace(/\s/g,'_')+'" style="background:'+BCOLORS[nm]+'"></div>'+
      '<div class="bnm">'+nm+'</div>'+
      '<div class="bgpc">'+ns+' fac / '+sc+' SC</div>'+
      '<label class="sw" onclick="event.stopPropagation()"><input type="checkbox" checked data-nm="'+nm+'" onchange="togBlock(this)"/><span class="sl"></span></label>';
    cont.appendChild(div);
  });
}
function togBlock(chk){
  var nm=chk.getAttribute('data-nm'),on=chk.checked;blockOn[nm]=on;
  var row=el('brow-'+nm.replace(/\s/g,'_'));if(row)row.classList.toggle('on',on);
  if(!on&&CURBLK===nm){CURBLK=null;showPH();}
  applyBS();buildBlbl();buildLegend();
}
function allBlocks(on){
  BNAMES.forEach(function(nm){blockOn[nm]=on;var chk=document.querySelector('#brow-'+nm.replace(/\s/g,'_')+' input');if(chk)chk.checked=on;var row=el('brow-'+nm.replace(/\s/g,'_'));if(row)row.classList.toggle('on',on);});
  if(!on){CURBLK=null;showPH();}applyBS();buildBlbl();buildLegend();
}

// Block color pickers (Varanasi style)
function buildBClrList(){
  var c=el('bclr-list');
  if(!c)return;
  c.innerHTML='';
  BNAMES.forEach(function(nm){
    var col=BCOLORS[nm];
    var r=document.createElement('div');
    r.style.cssText='display:flex;align-items:center;margin-bottom:5px;gap:6px;';
    var dot=document.createElement('div');
    dot.id='bdot-'+nm.replace(/\s/g,'_');
    dot.style.cssText='width:9px;height:9px;border-radius:50%;background:'+col+';flex-shrink:0;';
    var lbl=document.createElement('span');
    lbl.style.cssText='font-size:11px;font-weight:600;color:var(--t);flex:1;';
    lbl.textContent=nm;
    var ci=document.createElement('input');
    ci.type='color';ci.value=col;ci.className='cpick';
    ci.setAttribute('data-nm',nm);
    ci.addEventListener('input',function(){changeBC(this.getAttribute('data-nm'),this.value);});
    r.appendChild(dot);r.appendChild(lbl);r.appendChild(ci);
    c.appendChild(r);
  });
}

// Legend (Varanasi style)
function buildLegend(){
  var bl=el('leg-blocks');
  if(!bl)return;
  bl.innerHTML='<div class="ltitle" style="margin-bottom:5px;">Blocks</div>';
  BNAMES.forEach(function(nm){
    if(!blockOn[nm])return;
    var d=document.createElement('div');d.className='litem';
    var col=fillOn?BCOLORS[nm]:'#ccc';
    d.innerHTML='<div class="lsw" style="background:'+col+';"></div><span>'+nm+'</span>';
    bl.appendChild(d);
  });
  buildFacLegend();
}
function buildFacLegend(){
  var fl=el('leg-fac');if(!fl)return;
  var active=Object.keys(FAC_TYPES).filter(function(t){return FAC_TYPES[t].enabled;});
  if(!active.length){
    // Show HFR facility types in legend
    var h='<div style="height:1px;background:#eee;margin:6px 0;"></div><div class="ltitle" style="margin-bottom:5px;">Facilities</div>';
    [{k:'DH',l:'District Hospital'},{k:'CHC',l:'CHC'},{k:'ACHC',l:'Addl. CHC'},{k:'PHC',l:'PHC'}].forEach(function(t){
      h+='<div class="litem"><div class="ldot2" style="background:'+TC[t.k]+';"></div><span>'+t.l+'</span></div>';
    });
    fl.innerHTML=h;
    return;
  }
  var h='<div style="height:1px;background:#eee;margin:6px 0;"></div><div class="ltitle" style="margin-bottom:5px;">Facilities</div>';
  active.forEach(function(t){
    var shown=FAC_TYPES[t].shownCount||FAC_TYPES[t].count||0;
    h+='<div class="litem"><div class="ldot2" style="background:'+FAC_TYPES[t].color+';"></div><span>'+t+' ('+shown+')</span></div>';
  });
  fl.innerHTML=h;
}
function togLegend(on){el('leg').classList.toggle('hide',!on);}
function togLeg(on){togLegend(on);}
function togBg(on){if(on)curTile.addTo(map);else map.removeLayer(curTile);}
function togBlockLayer(on){
  if(blockLyr){if(on)blockLyr.addTo(map);else map.removeLayer(blockLyr);}
  togBlbl(on);
}
function changeBg(v){map.removeLayer(curTile);curTile=tileLyrs[v]||tileLyrs.osm;curTile.addTo(map);if(blockLyr)blockLyr.bringToFront();if(mkrLyr)mkrLyr.bringToFront();}
function togNA(on){el('NA').classList.toggle('on',on);}
function togSBar(on){el('SB').classList.toggle('on',on);if(on)updSB();}
function updSB(){if(!map)return;var ctr=map.getCenter(),p1=map.latLngToContainerPoint(ctr),p2=L.point(p1.x+110,p1.y);var ll2=map.containerPointToLatLng(p2);var dist=Math.round(ctr.distanceTo(ll2)/1000);var nice=[1,2,5,10,20,50,100];var best=nice.reduce(function(a,b){return Math.abs(b-dist)<Math.abs(a-dist)?b:a;});el('sclbl').textContent=best+' km';el('scmid').textContent=Math.round(best/2)+' km';el('scmax').textContent=best+' km';}
function autoOpacity(){
  if(!map||!fillOn)return;
  var z=map.getZoom();
  // Zoom 9=0.18, 11=0.10, 13=0.05, 15+=0.02
  var op;
  if(z<=9)op=0.18;
  else if(z<=11)op=0.18-(z-9)*(0.08/2);
  else if(z<=13)op=0.10-(z-11)*(0.05/2);
  else op=Math.max(0.02,0.05-(z-13)*0.015);
  op=Math.round(op*100)/100;
  fillOp=op;
  // Update slider UI
  var sl=el('sl-opacity');if(sl)sl.value=Math.round(op*100);
  var sv=el('sl-val');if(sv)sv.textContent=Math.round(op*100)+'%';
  applyBS();
}
function showTip(html,e){var t=el('tp');t.innerHTML=html;t.style.display='block';var r=el('ma').getBoundingClientRect();t.style.left=(e.clientX-r.left+12)+'px';t.style.top=(e.clientY-r.top-52)+'px';}
function hideTip(){el('tp').style.display='none';}

// Search
function doSearch(q){
  q=q.trim().toLowerCase();var r=el('sres');if(!q){r.style.display='none';return;}
  var found=[];
  BNAMES.forEach(function(nm){if(nm.toLowerCase().indexOf(q)>=0)found.push({type:'Block',name:nm,sub:'Barabanki District',lat:null,lon:null});});
  MKRS.forEach(function(m){if(m.name.toLowerCase().indexOf(q)>=0)found.push({type:m.type,name:m.name,sub:m.block,lat:m.lat,lon:m.lon});});
  if(extFacLyr){FAC_RAW.forEach(function(f){if(f.name.toLowerCase().indexOf(q)>=0)found.push({type:f.type,name:f.name,sub:f.block,lat:f.lat,lon:f.lng});});}
  if(!found.length){r.innerHTML='<div class="sr">No results found</div>';r.style.display='block';return;}
  r.innerHTML='';
  found.slice(0,8).forEach(function(x){
    var div=document.createElement('div');div.className='sr';
    div.innerHTML='<div>'+x.type+' &mdash; '+x.name+'</div><div class="ss">'+x.sub+'</div>';
    div.addEventListener('click',function(){goRes(x.name,x.lat,x.lon);});r.appendChild(div);
  });r.style.display='block';
}
function showSRes(){if(el('sinp').value.trim())el('sres').style.display='block';}
function goRes(nm,lat,lon){el('sres').style.display='none';el('sinp').value=nm;if(lat&&lon){map.flyTo([lat,lon],15,{duration:1.2});}else{BGEO.features.forEach(function(f){if(f.properties.tehs_name===nm){var c=centroid(f.geometry.coordinates);map.flyTo(c,12,{duration:1});CURBLK=nm;showBInfo(nm);goTab('info',null);}});}}
document.addEventListener('click',function(e){if(!e.target.closest('#srch'))el('sres').style.display='none';});

// ============================================================
// FACILITIES — Google Sheet (exact Varanasi style)
// Sheet: 1vkak-mpwXZxGPErL_k2AGTDkr32eDwZyBkf-5vGNyac
// ============================================================
var _ft=null,_faAR=null;
function loadFac(){
  var sid=(el('fac-sid').value||'').trim();
  if(!sid){fAlert('Enter Sheet ID','warn');return;}
  fAlert('Loading facilities...','info');
  var old=document.getElementById('gviz-fac');if(old)old.parentNode.removeChild(old);
  window.gvizFacCB=function(resp){
    if(_ft){clearTimeout(_ft);_ft=null;}
    try{
      if(!resp||!resp.table){fAlert('No table found. Check sheet sharing.','err');return;}
      parseGviz(resp);
      fAlert('Loaded '+FAC_RAW.length+' facilities, '+Object.keys(FAC_TYPES).length+' types.','ok');
      el('updt').textContent='Facilities: '+new Date().toLocaleTimeString('en-IN');
      var sbar=el('sbar');
      if(sbar){
        var total=FAC_RAW.length;
        sbar.innerHTML='&#128205; Barabanki District &nbsp;|&nbsp; 15 Blocks &nbsp;|&nbsp; &#127973; '+total+' facilities shown';
      }
    }catch(err){fAlert('Parse error: '+err.message,'err');}
  };
  var s=document.createElement('script');s.id='gviz-fac';
  s.src='https://docs.google.com/spreadsheets/d/'+sid+'/gviz/tq?tqx=responseHandler:gvizFacCB&headers=1';
  s.onerror=function(){fAlert('Could not load. Check Sheet ID and sharing (Anyone with link = Viewer).','err');};
  document.body.appendChild(s);
  _ft=setTimeout(function(){fAlert('Timeout. Check Sheet ID / sharing.','err');},15000);
}
function setFacAR(on){if(_faAR)clearInterval(_faAR);if(on)_faAR=setInterval(loadFac,120000);}

function gvC(row,i){var x=row.c[i];return(x&&x.v!=null)?x.v:'';}

function parseGviz(resp){
  // Auto-detect columns from headers
  var cols=resp.table.cols||[];
  var IDX={block:-1,name:-1,type:-1,cls:-1,lat:-1,lng:-1,status:-1,village:-1,fcode:-1};
  var hmap={block:['block','block name'],name:['facility name','name','facility_n'],
    type:['facility type','type','facility_t'],cls:['classification','classifica','class'],
    lat:['latitude','lattitude','lat'],lng:['longitude','lng','lon'],
    status:['status','facility_s'],village:['village'],fcode:['facility code','fcode']};
  cols.forEach(function(col,i){
    var lbl=(col.label||'').toLowerCase().trim();
    Object.keys(hmap).forEach(function(k){
      if(IDX[k]===-1&&hmap[k].some(function(h){return lbl.indexOf(h)>=0;}))IDX[k]=i;
    });
  });
  // Force HFR positions (more reliable than auto-detect for block col)
  IDX.block=8;  // Always col 8 = 'Block' in HFR sheetif(IDX.name===-1)IDX.name=13;
  if(IDX.type===-1)IDX.type=14;if(IDX.cls===-1)IDX.cls=15;
  if(IDX.lat===-1)IDX.lat=17;if(IDX.lng===-1)IDX.lng=18;
  if(IDX.status===-1)IDX.status=19;

  var prev={};Object.keys(FAC_TYPES).forEach(function(t){prev[t]={en:FAC_TYPES[t].enabled,col:FAC_TYPES[t].color,sz:FAC_TYPES[t].size,sh:FAC_TYPES[t].shape,cls:{}};Object.keys(FAC_TYPES[t].classes).forEach(function(c){prev[t].cls[c]=FAC_TYPES[t].classes[c].enabled;});});
  FAC_RAW=[];FAC_TYPES={};
  (resp.table.rows||[]).forEach(function(row){
    if(!row||!row.c)return;
    var lat=parseFloat(gvC(row,IDX.lat)),lng=parseFloat(gvC(row,IDX.lng));
    if(isNaN(lat)||isNaN(lng)||lat<26||lat>28||lng<80||lng>82)return;
    var type=(''+gvC(row,IDX.type)).trim(),cls=(''+gvC(row,IDX.cls)).trim()||'(Unspecified)';
    if(!type)return;
    var status=(''+gvC(row,IDX.status)).trim();
    var hideInactive=(el('chk-active')&&el('chk-active').checked);
    if(hideInactive&&status.toLowerCase()==='inactive')return;
    var rawBlock=(''+gvC(row,IDX.block)).trim();
    // Normalize: Barabanki Urban -> Banki
    if(rawBlock.toLowerCase().indexOf('urban')>=0||rawBlock.toLowerCase().indexOf('barabanki')>=0)rawBlock='Banki';
    var obj={name:(''+gvC(row,IDX.name)).trim(),type:type,cls:cls,block:rawBlock,lat:lat,lng:lng,status:status};
    FAC_RAW.push(obj);
    var p=prev[type]||{};
    var DSIZES={DH:21,CHC:18,ACHC:18,PHC:15,SC:9};
    var defSz=DSIZES[type]||12;
    if(!FAC_TYPES[type])FAC_TYPES[type]={color:(p.col||TC[type]||'#555'),icon:TI[type]||'📍',size:(p.sz||defSz),shape:(p.sh||'circle'),enabled:(p.en!==undefined?p.en:true),classes:{},count:0,shownCount:0};
    FAC_TYPES[type].count++;
    if(!FAC_TYPES[type].classes[cls]){var pe=p.cls&&p.cls[cls];FAC_TYPES[type].classes[cls]={enabled:(pe!==undefined?pe:true),count:0};}
    FAC_TYPES[type].classes[cls].count++;
  });
  buildFacTree();buildFacStyleUI();renderExtFac();buildLegend();
}

function buildFacTree(){
  var cont=el('fac-tree');var types=Object.keys(FAC_TYPES).sort();
  if(!types.length){cont.innerHTML='<div style="font-size:10px;color:var(--t3);text-align:center;padding:14px;">No facilities found</div>';return;}
  cont.innerHTML='';
  types.forEach(function(t){
    var T=FAC_TYPES[t];var box=document.createElement('div');box.className='ftype'+(T.enabled?' on':'');box.id='ftype-'+t;
    var clsHtml='';
    Object.keys(T.classes).sort().forEach(function(cl){
      var C=T.classes[cl];var safe=cl.replace(/[^a-zA-Z0-9]/g,'_');var cid='fc-'+t.replace(/[^a-zA-Z0-9]/g,'_')+'-'+safe;
      clsHtml+='<div class="fclass"><span class="fclass-nm"><span class="fclass-ct">'+C.count+'</span>'+cl+'</span>'+
        '<label class="mini-sw"><input type="checkbox" id="'+cid+'" '+(C.enabled?'checked':'')+' data-t="'+t+'" data-cl="'+cl+'" onchange="togFC(this)"/><span class="mini-sl"></span></label></div>';
    });
    box.innerHTML='<div class="ftype-hd" onclick="expType(\''+t+'\',event)">'+
      '<div class="ftype-dot" style="background:'+T.color+'"></div>'+
      '<span class="ftype-nm">'+(T.icon||'')+'&nbsp;'+t+'</span>'+
      '<span class="ftype-ct">'+T.count+'</span>'+
      '<label class="sw" onclick="event.stopPropagation()"><input type="checkbox" '+(T.enabled?'checked':'')+' data-t="'+t+'" onchange="togFT(this)"/><span class="sl"></span></label>'+
      '<span class="ftype-exp">&#9654;</span></div>'+
      '<div class="fclass-list">'+clsHtml+'</div>';
    cont.appendChild(box);
  });
}
function expType(t,e){if(e&&e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='SPAN'&&e.target.className.indexOf('sl')>=0))return;el('ftype-'+t).classList.toggle('expanded');}
function togFT(chk){var t=chk.getAttribute('data-t');FAC_TYPES[t].enabled=chk.checked;el('ftype-'+t).classList.toggle('on',chk.checked);renderExtFac();buildLegend();}
function togFC(chk){var t=chk.getAttribute('data-t'),cl=chk.getAttribute('data-cl');FAC_TYPES[t].classes[cl].enabled=chk.checked;renderExtFac();}
function allFac(on){Object.keys(FAC_TYPES).forEach(function(t){FAC_TYPES[t].enabled=on;el('ftype-'+t).classList.toggle('on',on);var mc=document.querySelector('#ftype-'+t+' .sw input');if(mc)mc.checked=on;Object.keys(FAC_TYPES[t].classes).forEach(function(cl){FAC_TYPES[t].classes[cl].enabled=on;var safe=cl.replace(/[^a-zA-Z0-9]/g,'_');var ci=el('fc-'+t.replace(/[^a-zA-Z0-9]/g,'_')+'-'+safe);if(ci)ci.checked=on;});});renderExtFac();buildLegend();}

// Marker icon builder — exact Varanasi style with all shapes
function mkFacIcon(t,big){
  var T=FAC_TYPES[t];var col=T.color,sz=T.size||12,sh=T.shape||'circle';
  if(big){sz=Math.max(Math.round(sz*2.3),28);}
  var html,anchor=[sz/2,sz/2];
  if(sh.indexOf('e_')===0){html='<div style="font-size:'+sz+'px;line-height:'+sz+'px;">'+(EMAP[sh]||'📍')+'</div>';}
  else if(sh==='circle'){html='<div style="width:'+sz+'px;height:'+sz+'px;background:'+col+';border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,.3);"></div>';}
  else if(sh==='square'){html='<div style="width:'+sz+'px;height:'+sz+'px;background:'+col+';border:2px solid #fff;border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,.3);"></div>';}
  else if(sh==='diamond'){html='<div style="width:'+sz+'px;height:'+sz+'px;background:'+col+';border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3);transform:rotate(45deg);"></div>';}
  else if(sh==='ring'){html='<div style="width:'+sz+'px;height:'+sz+'px;background:transparent;border:3px solid '+col+';border-radius:50%;box-shadow:0 0 0 1px #fff;"></div>';}
  else if(sh==='triangle'){html='<div style="width:0;height:0;border-left:'+(sz/2)+'px solid transparent;border-right:'+(sz/2)+'px solid transparent;border-bottom:'+sz+'px solid '+col+';filter:drop-shadow(0 0 1px #fff);"></div>';anchor=[sz/2,sz];}
  else if(sh==='plus'){html='<div style="position:relative;width:'+sz+'px;height:'+sz+'px;"><div style="position:absolute;left:'+(sz*0.35)+'px;top:0;width:'+(sz*0.3)+'px;height:'+sz+'px;background:'+col+';border:1px solid #fff;"></div><div style="position:absolute;top:'+(sz*0.35)+'px;left:0;height:'+(sz*0.3)+'px;width:'+sz+'px;background:'+col+';border:1px solid #fff;"></div></div>';}
  else if(sh==='star'){html='<div style="font-size:'+sz+'px;line-height:'+sz+'px;color:'+col+';text-shadow:0 0 2px #fff;">&#9733;</div>';}
  else if(sh==='pin'){html='<div style="width:'+sz+'px;height:'+sz+'px;background:'+col+';border:2px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 0 0 1px rgba(0,0,0,.3);"></div>';anchor=[sz/2,sz];}
  else{html='<div style="width:'+sz+'px;height:'+sz+'px;background:'+col+';border:2px solid #fff;border-radius:50%;"></div>';}
  if(big){var pad=7,tot=sz+pad*2;html='<div class="fac-pulse" style="width:'+tot+'px;height:'+tot+'px;display:flex;align-items:center;justify-content:center;">'+html+'</div>';return L.divIcon({html:html,className:'fac-divicon',iconSize:[tot,tot],iconAnchor:[tot/2,tot/2]});}
  return L.divIcon({html:html,className:'fac-divicon',iconSize:[sz,sz],iconAnchor:anchor});
}

function buildFacStyleUI(){
  var cont=el('fac-style');var types=Object.keys(FAC_TYPES).sort();
  if(!types.length){cont.innerHTML='<div style="font-size:10px;color:var(--t3);text-align:center;padding:10px;">Load facilities first</div>';return;}
  cont.innerHTML='';
  types.forEach(function(t){
    var T=FAC_TYPES[t];
    var row=document.createElement('div');row.style.cssText='border:1px solid #f0f0f0;border-radius:8px;padding:8px;margin-bottom:7px;background:#fafafa;';
    var hd=document.createElement('div');hd.style.cssText='display:flex;align-items:center;gap:6px;margin-bottom:6px;';
    var pv=document.createElement('div');pv.style.cssText='width:20px;height:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0;';pv.id='fpv-'+t.replace(/[^a-zA-Z0-9]/g,'_');
    var nm=document.createElement('span');nm.style.cssText='font-size:11px;font-weight:700;color:var(--t);flex:1;';nm.textContent=(T.icon||'')+' '+t;
    var ci=document.createElement('input');ci.type='color';ci.value=T.color;ci.title='Color';
    ci.style.cssText='width:24px;height:24px;border:1.5px solid #ddd;border-radius:5px;padding:1px;cursor:pointer;flex-shrink:0;';
    ci.setAttribute('data-t',t);ci.addEventListener('input',function(){setFC(this.getAttribute('data-t'),this.value);});
    hd.appendChild(pv);hd.appendChild(nm);hd.appendChild(ci);
    var sel=document.createElement('select');sel.style.cssText='font-size:10px;padding:3px 4px;border:1px solid var(--bd);border-radius:5px;background:#fff;cursor:pointer;outline:none;flex:1;';
    sel.setAttribute('data-t',t);
    SHAPE_OPTIONS.forEach(function(s){var opt=document.createElement('option');opt.value=s.v;opt.selected=(T.shape===s.v);opt.innerHTML=s.label;sel.appendChild(opt);});
    sel.addEventListener('change',function(){setFSh(this.getAttribute('data-t'),this.value);});
    var szRow=document.createElement('div');szRow.style.cssText='display:flex;align-items:center;gap:8px;margin-top:6px;';
    var szL=document.createElement('span');szL.style.cssText='font-size:10px;color:var(--t3);min-width:30px;';szL.textContent='Size';
    var szI=document.createElement('input');szI.type='range';szI.className='slider';szI.min=8;szI.max=32;szI.value=T.size||12;szI.setAttribute('data-t',t);
    var szV=document.createElement('span');szV.style.cssText='font-size:10px;color:var(--p);font-weight:700;min-width:30px;text-align:right;';szV.textContent=(T.size||12)+'px';szV.id='fsz-'+t.replace(/[^a-zA-Z0-9]/g,'_');
    szI.addEventListener('input',function(){setFS(this.getAttribute('data-t'),this.value);});
    szRow.appendChild(szL);szRow.appendChild(szI);szRow.appendChild(szV);
    row.appendChild(hd);row.appendChild(sel);row.appendChild(szRow);cont.appendChild(row);
    updFPrev(t);
  });
}
function updFPrev(t){var safe=t.replace(/[^a-zA-Z0-9]/g,'_');var pv=el('fpv-'+safe);if(!pv)return;var ic=mkFacIcon(t);pv.innerHTML='<div style="transform:scale('+Math.min(1,16/(FAC_TYPES[t].size||12))+')">'+ic.options.html+'</div>';}
function setFC(t,v){FAC_TYPES[t].color=v;updFPrev(t);renderExtFac();buildLegend();var dot=document.querySelector('#ftype-'+t+' .ftype-dot');if(dot)dot.style.background=v;}
function setFS(t,v){FAC_TYPES[t].size=parseInt(v);var safe=t.replace(/[^a-zA-Z0-9]/g,'_');var lbl=el('fsz-'+safe);if(lbl)lbl.textContent=v+'px';updFPrev(t);renderExtFac();}
function setFSh(t,v){FAC_TYPES[t].shape=v;updFPrev(t);renderExtFac();}

function renderExtFac(){
  var hideInactive=(el('chk-active')&&el('chk-active').checked);
  if(!extFacLyr){extFacLyr=L.layerGroup().addTo(map);}else{extFacLyr.clearLayers();}
  Object.keys(FAC_TYPES).forEach(function(t){FAC_TYPES[t].shownCount=0;});
  var total=0;

  if(FAC_RAW.length>0){
    // === Google Sheet facilities ===
    FAC_RAW.forEach(function(f){
      var T=FAC_TYPES[f.type];if(!T||!T.enabled)return;
      var cls=T.classes[f.cls];if(!cls||!cls.enabled)return;
      if(hideInactive&&f.status.toLowerCase()==='inactive')return;
      // Block filter
      if(CURBLK){
        var fb=(f.block||'').trim().toLowerCase();
        var cb=CURBLK.trim().toLowerCase();
        if(fb!==cb&&fb.indexOf(cb)<0&&cb.indexOf(fb)<0)return;
      }
      var ic=mkFacIcon(f.type,false);
      var mk=L.marker([f.lat,f.lng],{icon:ic});
      mk.bindTooltip('<b>'+f.name+'</b><br>'+f.type+(f.cls?(' &middot; '+f.cls):'')+'<br><span style="color:#aaa;">'+f.block+'</span>',{direction:'top',offset:[0,-10]});
      mk.on('click',function(){map.flyTo([f.lat,f.lng],16,{duration:1});});
      mk.addTo(extFacLyr);
      T.shownCount=(T.shownCount||0)+1;
      total++;
    });
  } else if(MKRS&&MKRS.length>0){
    // === Fallback: HFR MKRS data (when sheet not loaded) ===
    var TC_COLORS={DH:'#2e7d32',CHC:'#e53935',ACHC:'#e53935',PHC:'#1976d2'};
    var TC_LBL={DH:'DH',CHC:'C',ACHC:'C',PHC:'P'};
    var TC_SZ={DH:21,CHC:18,ACHC:18,PHC:15};
    MKRS.forEach(function(m){
      // Block filter: if block selected, show only that block
      if(CURBLK){
        var cb=CURBLK.trim().toLowerCase();
        var mb=(m.block||'').trim().toLowerCase();
        if(mb!==cb&&mb.indexOf(cb)<0&&cb.indexOf(mb)<0)return;
      }
      var col=TC_COLORS[m.type]||'#888';
      var lb=TC_LBL[m.type]||m.type;
      var sz=TC_SZ[m.type]||14;
      var icon=L.divIcon({
        className:'',
        html:'<div style="width:'+sz+'px;height:'+sz+'px;border-radius:4px;background:'+col+';display:flex;align-items:center;justify-content:center;color:white;font-size:'+(sz<=14?'8':'9')+'px;font-weight:700;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);">'+lb+'</div>',
        iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]
      });
      var mk=L.marker([m.lat,m.lon],{icon:icon});
      mk.bindTooltip('<b>'+m.name+'</b><br>'+m.type+' &middot; '+m.status+'<br><span style="color:#aaa;">'+m.block+'</span>',{direction:'top',offset:[0,-12]});
      mk.on('click',function(){map.flyTo([m.lat,m.lon],16,{duration:1});});
      mk.addTo(extFacLyr);
      total++;
    });
  }

  buildLegend();
  // Update sbar
  var sbar=el('sbar');
  if(sbar){
    if(CURBLK){
      sbar.innerHTML='&#128205; <b>'+CURBLK+'</b> Block &nbsp;|&nbsp; &#127973; '+total+' facilities &nbsp;|&nbsp; <span style="cursor:pointer;color:#1976d2;font-weight:600;" onclick="clearBlockSel()">&#10005; Show All Blocks</span>';
    } else {
      if(total>0)sbar.innerHTML='&#128205; Barabanki District &nbsp;|&nbsp; 15 Blocks &nbsp;|&nbsp; &#127973; '+total+' facilities shown';
      else sbar.innerHTML='&#128205; Barabanki District &nbsp;|&nbsp; 15 Blocks &nbsp;|&nbsp; 594 Facilities';
    }
  }
}

// Clear block selection - show all facilities again
function clearBlockSel(){
  CURBLK=null;
  applyBS();
  showPH();
  renderExtFac();
}
function fAlert(msg,type){var e=el('fac-alert');e.className='alert show '+type;e.textContent=msg;}


// Print
function openPM(){el('pm-wrap').classList.add('on');}
function closePM(){el('pm-wrap').classList.remove('on');}
function setPL(l){PL=l;el('pol').classList.toggle('S',l==='landscape');el('pop').classList.toggle('S',l==='portrait');}
function doPrint(){
  var title=el('pti').value||'Barabanki District - Health Facilities Map';
  var sT=el('cT').checked,sL=el('cL').checked,sN=el('cN').checked,sS=el('cS').checked;
  var bc={};BNAMES.forEach(function(nm){bc[nm]=getBC(nm);});
  var scKm=20,scMid=10;
  if(map){var ctr=map.getCenter(),p1=map.latLngToContainerPoint(ctr),p2=L.point(p1.x+110,p1.y);var ll2=map.containerPointToLatLng(p2);var d=Math.round(ctr.distanceTo(ll2)/1000);var nice=[1,2,5,10,20,50,100];scKm=nice.reduce(function(a,b){return Math.abs(b-d)<Math.abs(a-d)?b:a;});scMid=Math.round(scKm/2);}
  var LON_MIN=80.85,LON_MAX=81.85,LAT_MIN=26.45,LAT_MAX=27.45,W=680,H=760,P=35;
  function sv(lon,lat){return[(P+(lon-LON_MIN)/(LON_MAX-LON_MIN)*(W-2*P)).toFixed(1),(H-P-(lat-LAT_MIN)/(LAT_MAX-LAT_MIN)*(H-2*P)).toFixed(1)];}
  var bSVG='';
  BGEO.features.forEach(function(feat){
    var nm=feat.properties.tehs_name;var col=bc[nm]||'#ccc';
    function cp(coords){var paths=[];(function w(a){if(a.length&&typeof a[0][0]==='number'){paths.push('M '+a.map(function(c){return sv(c[0],c[1]).join(',');}).join(' L ')+' Z');}else{a.forEach(w);}})(coords);return paths.join(' ');}
    bSVG+='<path d="'+cp(feat.geometry.coordinates)+'" fill="'+col+'" fill-opacity="'+(fillOn?fillOp:0)+'" stroke="#1a3c5e" stroke-width="1" stroke-linejoin="round"/>';
    var c=centroid(feat.geometry.coordinates);var sp=sv(c[1],c[0]);
    bSVG+='<text x="'+sp[0]+'" y="'+sp[1]+'" text-anchor="middle" font-size="7.5" fill="#1a3c5e" font-family="Arial" font-weight="700" paint-order="stroke" stroke="white" stroke-width="2.5">'+nm+'</text>';
  });
  var mSVG='';
  MKRS.forEach(function(m){var col=TC[m.type]||'#888',lb=TLBL[m.type]||m.type;var sp=sv(m.lon,m.lat);mSVG+='<rect x="'+(sp[0]-6.5)+'" y="'+(sp[1]-6.5)+'" width="13" height="13" rx="2" fill="'+col+'" stroke="white" stroke-width="1.5"/><text x="'+sp[0]+'" y="'+(parseFloat(sp[1])+3)+'" text-anchor="middle" font-size="6" fill="white" font-family="Arial" font-weight="700">'+lb+'</text>';});
  var scSVG='';if(el('chk-sc')&&el('chk-sc').checked){SC_DATA.forEach(function(m){var sp=sv(m.lon,m.lat);scSVG+='<circle cx="'+sp[0]+'" cy="'+sp[1]+'" r="3" fill="#f57c00" fill-opacity=".85" stroke="white" stroke-width=".7"/>';});}
  var extSVG='';
  if(extFacLyr){FAC_RAW.forEach(function(f){var T=FAC_TYPES[f.type];if(!T||!T.enabled)return;var cls=T.classes[f.cls];if(!cls||!cls.enabled)return;var sp=sv(f.lng,f.lat);var col=T.color;extSVG+='<circle cx="'+sp[0]+'" cy="'+sp[1]+'" r="4" fill="'+col+'" fill-opacity=".9" stroke="white" stroke-width="1.2"/>';});}
  var legH='';[{k:'DH',l:'District Hospital'},{k:'CHC',l:'CHC'},{k:'ACHC',l:'Additional CHC'},{k:'PHC',l:'PHC'},{k:'SC',l:'Sub Centre'}].forEach(function(t){var col=TC[t.k];legH+='<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;"><div style="width:12px;height:12px;border-radius:2px;background:'+col+'"></div><span style="font-size:9px;color:#333;">'+t.l+'</span></div>';});
  var blkH='<div style="font-size:8px;font-weight:700;color:#555;text-transform:uppercase;margin-bottom:4px;">Blocks</div>';BNAMES.forEach(function(nm){blkH+='<div style="display:flex;align-items:center;gap:4px;margin-bottom:1px;"><div style="width:10px;height:10px;background:'+(fillOn?bc[nm]:'#ccc')+'"></div><span style="font-size:8px;color:#333;">'+nm+'</span></div>';});
  var ph=['<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+title+'</title><style>*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}body{font-family:"Segoe UI",Arial,sans-serif;background:white;}@page{size:A4 '+PL+';margin:5mm;}.np{display:block;}@media print{.np{display:none!important;}}</style></head><body>'];
  ph.push('<div class="np" style="background:#1a3c5e;color:white;padding:7px 14px;display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;font-weight:600;">Print Preview</span><div><button onclick="window.print()" style="background:#2e7d32;color:white;border:none;padding:6px 14px;border-radius:5px;cursor:pointer;font-size:11px;font-weight:600;margin-right:5px;">&#128438; Print / Save PDF</button><button onclick="window.close()" style="background:#666;color:white;border:none;padding:6px 10px;border-radius:5px;cursor:pointer;font-size:10px;">Close</button></div></div>');
  if(sT)ph.push('<div style="padding:6px 14px;border-bottom:2px solid #1a3c5e;"><div style="font-size:13px;font-weight:700;color:#1a3c5e;">'+title+'</div><div style="font-size:9px;color:#666;">Uttar Pradesh | Real GIS Data | Barabanki District</div></div>');
  ph.push('<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;background:white;">'+bSVG+mSVG+scSVG+extSVG);
  if(sN)ph.push('<g transform="translate('+(W-50)+',10)"><circle cx="25" cy="25" r="24" fill="white" stroke="#ddd" stroke-width="1.5"/><polygon points="25,4 29,18 25,15 21,18" fill="#1a3c5e"/><polygon points="25,46 29,32 25,35 21,32" fill="#bbb"/><text x="25" y="15" text-anchor="middle" font-size="7" font-weight="700" fill="white" font-family="Arial">N</text><text x="25" y="44" text-anchor="middle" font-size="6" fill="#666" font-family="Arial">S</text><text x="7" y="27" text-anchor="middle" font-size="6" fill="#666" font-family="Arial">W</text><text x="43" y="27" text-anchor="middle" font-size="6" fill="#666" font-family="Arial">E</text></g>');
  ph.push('</svg><div style="display:flex;justify-content:space-between;align-items:flex-end;padding:5px 14px;border-top:1px solid #eee;">');
  if(sL)ph.push('<div style="display:flex;gap:10px;"><div style="border:1.5px solid #ccc;border-radius:5px;padding:7px 10px;"><div style="font-size:8px;font-weight:700;color:#555;text-transform:uppercase;margin-bottom:4px;">FACILITIES</div>'+legH+'</div><div style="border:1.5px solid #ccc;border-radius:5px;padding:7px 10px;">'+blkH+'</div></div>');else ph.push('<div></div>');
  if(sS)ph.push('<div><div style="font-weight:600;text-align:center;margin-bottom:2px;color:#333;font-size:9px;">'+scKm+' km</div><div style="display:flex;height:6px;border:1.5px solid #333;overflow:hidden;width:100px;"><div style="flex:1;background:#333"></div><div style="flex:1;background:white;border-left:1.5px solid #333;border-right:1.5px solid #333"></div><div style="flex:1;background:#333"></div></div><div style="display:flex;justify-content:space-between;font-size:7px;color:#555;width:100px;"><span>0</span><span>'+scMid+' km</span><span>'+scKm+' km</span></div></div>');else ph.push('<div></div>');
  ph.push('</div></body></html>');
  var pw=window.open('','_blank');if(!pw){alert('Popup blocked!');return;}
  pw.document.write(ph.join(''));pw.document.close();closePM();
}
