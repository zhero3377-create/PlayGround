(() => {
  'use strict';
  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d', { alpha: false });
  const mapCanvas = document.getElementById('minimap'), mapCtx = mapCanvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a,b,t) => a+(b-a)*t;
  const SAVE_KEY = 'city-of-shadows-afterlight-v1';
  const missions = [
    {title:'A CITY THAT FORGETS', copy:'Find Mara at the Lantern Café. The old port holds more than cargo.', objective:'REACH THE LANTERN CAFÉ', reward:350, place:[38,24], district:'OLD HARBOR', complete:'A NEW LEAD', result:'Mara has a name: Elias Venn. Last seen near the floodlit freight yard.'},
    {title:'THE NIGHT LEDGER', copy:'Mara needs a ledger from a parked courier car. Find it before the harbor shift changes.', objective:'FIND THE COURIER CAR', reward:500, place:[-65,83], district:'FREIGHT QUARTER', complete:'PAPER TRAIL', result:'One account keeps appearing: Northline Development.'},
    {title:'A FAVOR IN GLASS', copy:'Meet fixer Tomas on the avenue. He knows which doors Northline keeps locked.', objective:'MEET TOMAS ON THE AVENUE', reward:650, place:[115,-54], district:'GLASS AVENUE', complete:'THE CITY HAS TEETH', result:'Northline has been buying the shoreline one deed at a time.'},
    {title:'AFTER THE RAIN', copy:'Take the signed photograph to Mara. This is only the first chapter.', objective:'RETURN TO MARA', reward:900, place:[38,24], district:'OLD HARBOR', complete:'CHAPTER ONE · AFTERLIGHT', result:'A new life takes shape. The rest of the city is yours to discover.'}
  ];
  let saved = {}; try { const data = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); if (data && typeof data === 'object') saved = data; } catch {}
  const player = {x:Number.isFinite(saved.x)?saved.x:0,z:Number.isFinite(saved.z)?saved.z:0,yaw:Number.isFinite(saved.yaw)?saved.yaw:0, health:100,money:Number.isFinite(saved.money)?Math.max(0,saved.money):1250, mission:clamp(Number.isInteger(saved.mission)?saved.mission:0,0,missions.length-1), inCar:false, speed:0, run:false, crouch:false, interior:false};
  let ownedCar = saved.ownedCar && Number.isFinite(saved.ownedCar.x) && Number.isFinite(saved.ownedCar.z) && Number.isFinite(saved.ownedCar.yaw) ? {x:saved.ownedCar.x,z:saved.ownedCar.z,yaw:saved.ownedCar.yaw,color:typeof saved.ownedCar.color==='string'?saved.ownedCar.color:'#65766f'} : null;
  const storedQuality=Number(localStorage.getItem('cos-quality')||1);
  const settings = {quality:[0.7,0.85,1].includes(storedQuality)?storedQuality:1, sound:localStorage.getItem('cos-sound')!=='off'};
  let W=innerWidth,H=innerHeight,DPR=1, focal=700, paused=false, elapsed=0, time=18.7, weather='CLEAR', toastTimer=0, saveTimer=0, last=performance.now(), camYaw=0, camX=0, camZ=0, cameraY=8, cameraPitch=.29;
  const keys = new Set(), touch = {forward:0,side:0};
  const colors=['#27353a','#334044','#3c4548','#3a4143','#2c393c','#48504e','#2c3437','#40474a','#29383d'];
  const buildings=[];
  for(let gx=-6;gx<=6;gx++) for(let gz=-6;gz<=6;gz++) {
    if(Math.abs(gx)>5||Math.abs(gz)>5) continue;
    for(let n=0;n<3;n++){
      const seed=Math.abs(Math.sin(gx*127.1+gz*311.7+n*74.7)*43758.5453)%1;
      const seed2=Math.abs(Math.sin(gx*269.5+gz*183.3+n*39.4)*24634.6345)%1;
      let x=gx*60+(n===0?-17: n===1?17:0)+(seed-.5)*8;
      let z=gz*60+(n===2?-18: n===1?17:-17)+(seed2-.5)*8;
      const downtown=Math.max(0,1-Math.hypot(gx-1,gz+1)/4.3);
      let w=16+seed*15,d=17+seed2*15,h=12+seed*30+downtown*(20+seed2*42);
      if(Math.abs(gx)<1&&Math.abs(gz)<1) h=8+seed*12;
      buildings.push({x,z,w,d,h,color:colors[Math.floor(seed*colors.length)],lit:seed2, style:n,seed});
    }
  }
  const traffic=[];
  for(let i=0;i<18;i++) traffic.push({x:(i%6-2.5)*60+(i%2?7:-7),z:(Math.floor(i/6)-1)*60+(i%2?-20:20),dir:i%2?1:-1,axis:i%3===0?'x':'z',speed:5+(i%5)*1.25,color:['#b8b2a1','#9d4b37','#344951','#c0a76e','#536058'][i%5],phase:i*3.1});
  const walkers=[];
  for(let i=0;i<26;i++)walkers.push({x:(i%6-2.5)*60+(i%2?11:-11),z:(Math.floor(i/6)-2)*60+(i%3?16:-16),angle:(i*2.39),speed:.45+(i%4)*.12,phase:i*1.7});
  function resize(){DPR=Math.min(devicePixelRatio||1,1.7);W=innerWidth;H=innerHeight;canvas.width=Math.floor(W*DPR);canvas.height=Math.floor(H*DPR);canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.setTransform(DPR,0,0,DPR,0,0);focal=Math.min(W,H)*.93;}
  addEventListener('resize',resize,{passive:true});resize();
  function proj(x,y,z){const dx=x-camX,dz=z-camZ,right=dx*Math.cos(camYaw)-dz*Math.sin(camYaw),depth=dx*Math.sin(camYaw)+dz*Math.cos(camYaw);const vy=(y-cameraY)*Math.cos(cameraPitch)-depth*Math.sin(cameraPitch),dep=(y-cameraY)*Math.sin(cameraPitch)+depth*Math.cos(cameraPitch);if(dep<1.6)return null;return{x:W*.5+right*focal/dep,y:H*.47-vy*focal/dep,d:dep};}
  function poly(points,fill,stroke=null){const p=points.map(v=>proj(v[0],v[1],v[2]));if(p.some(v=>!v))return;ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)ctx.lineTo(p[i].x,p[i].y);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.7;ctx.stroke();}}
  function shade(hex,amount){const n=parseInt(hex.slice(1),16),r=clamp((n>>16)+amount,0,255),g=clamp(((n>>8)&255)+amount,0,255),b=clamp((n&255)+amount,0,255);return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);}
  function box(x,z,w,d,h,base,opts={}){
    const x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2,y0=opts.y||0,y1=y0+h,cc=opts.colors||[base,shade(base,-13),shade(base,12),shade(base,-21)];
    const faces=[{q:[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0]],c:cc[1],center:(x0+x1)/2*Math.sin(camYaw)+z0*Math.cos(camYaw)},{q:[[x1,y0,z1],[x0,y0,z1],[x0,y1,z1],[x1,y1,z1]],c:cc[2],center:(x1+x0)/2*Math.sin(camYaw)+z1*Math.cos(camYaw)},{q:[[x0,y0,z1],[x0,y0,z0],[x0,y1,z0],[x0,y1,z1]],c:cc[0],center:x0*Math.sin(camYaw)+(z0+z1)/2*Math.cos(camYaw)},{q:[[x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0]],c:cc[3],center:x1*Math.sin(camYaw)+(z0+z1)/2*Math.cos(camYaw)},{q:[[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],c:cc[0],center:(x0+x1)/2*Math.sin(camYaw)+(z0+z1)/2*Math.cos(camYaw)}];
    faces.sort((a,b)=>a.center-b.center);for(const f of faces){poly(f.q,f.c);if(opts.windows&&f.center>0)facadeWindows(f.q,x,z,w,d,h,opts.seed||.5);}
  }
  function facadeWindows(face,x,z,w,d,h,seed){if(h<14||W<450)return;const topY=Math.max(5,h*.78),rows=Math.min(8,Math.floor(topY/4)),cols=Math.min(6,Math.floor(Math.max(w,d)/5)),front=face[0][2]===face[1][2],frontZ=face[0][2],frontX=face[0][0];for(let r=1;r<rows;r++)for(let c=0;c<cols;c++){const u=(c+1)/(cols+1),yy=2.2+r*(topY-2)/rows,xx=front?x-w/2+u*w:frontX,zz=front?frontZ:z-d/2+u*d;const ps=[proj(xx-.65,yy,zz),proj(xx+.65,yy,zz),proj(xx+.65,yy+1.15,zz),proj(xx-.65,yy+1.15,zz)];if(ps.some(p=>!p))continue;ctx.fillStyle=(Math.floor(x+z+c*3+r*5+seed*10)%9===0)?'#e4bd76aa':'#a9c1c122';ctx.beginPath();ctx.moveTo(ps[0].x,ps[0].y);ps.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();ctx.fill();}}
  function groundRect(x,z,w,d,color){poly([[x-w/2,0,z-d/2],[x+w/2,0,z-d/2],[x+w/2,0,z+d/2],[x-w/2,0,z+d/2]],color);}
  function drawWorld(){
    const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,time<6||time>20?'#111c27':'#31464b');sky.addColorStop(.52,time<6||time>20?'#586568':'#89958c');sky.addColorStop(1,'#69716a');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    const haze=ctx.createLinearGradient(0,H*.48-30,0,H*.48+150);haze.addColorStop(0,'#c7bd9b00');haze.addColorStop(.55,'#c7bd9b52');haze.addColorStop(1,'#666e6555');ctx.fillStyle=haze;ctx.fillRect(0,H*.48-30,W,180);
    groundRect(0,0,790,790,'#3a4543');for(let i=-6;i<=6;i++){groundRect(i*60,0,12,790,Math.abs(i)%3===0?'#262f30':'#303a3a');groundRect(0,i*60,790,12,Math.abs(i)%3===0?'#262f30':'#303a3a');groundRect(i*60-7.5,0,1,790,'#77796c');groundRect(i*60+7.5,0,1,790,'#77796c');groundRect(i*60,0,.19,790,'#a49d83');groundRect(0,i*60,790,.19,'#a49d83');for(let j=-6;j<=6;j++)if(Math.abs(j)%2===0){groundRect(i*60,j*60+19,.23,8,'#b4aa8a');groundRect(j*60+19,i*60,8,.23,'#b4aa8a');}}
    const sorted=buildings.map(b=>({...b,depth:(b.x-camX)*Math.sin(camYaw)+(b.z-camZ)*Math.cos(camYaw)})).filter(b=>b.depth>-36&&b.depth<320&&Math.hypot(b.x-player.x,b.z-player.z)<330).sort((a,b)=>b.depth-a.depth);
    for(const b of sorted){const dist=Math.hypot(b.x-player.x,b.z-player.z);box(b.x,b.z,b.w,b.d,b.h,dist>210?'#374143':b.color,{windows:dist<190,seed:b.seed});if(b.h>37&&dist<210)box(b.x,b.z,b.w*.46,b.d*.48,2,'#69736d',{y:b.h});}
    drawStreetDetails();for(const t of traffic)if(t.x!==999)drawCar(t.x,t.z,t.axis==='x'?Math.PI/2:0,t.color,false);for(const p of walkers)drawPerson(p.x,p.z,p.angle,'#a7987a',false);if(ownedCar&&!player.inCar)drawCar(ownedCar.x,ownedCar.z,ownedCar.yaw,ownedCar.color||'#65766f',false);drawMarker();if(player.inCar)drawCar(player.x,player.z,player.yaw,'#65766f',true);else drawPerson(player.x,player.z,player.yaw,'#c5b790',true);if(weather==='RAIN')drawRain();
  }
  function drawStreetDetails(){const nearest=[];for(let x=-300;x<=300;x+=60)for(let z=-300;z<=300;z+=60)nearest.push([x,z]);nearest.sort((a,b)=>Math.hypot(a[0]-player.x,a[1]-player.z)-Math.hypot(b[0]-player.x,b[1]-player.z));for(const [x,z] of nearest.slice(0,22)){for(const side of [-1,1]){const lx=x+side*10.4,lz=z+17,base=proj(lx,0,lz),top=proj(lx,6.2,lz);if(!base||!top||base.d>150)continue;ctx.strokeStyle='#282f2e';ctx.lineWidth=Math.max(1,4*focal/base.d);ctx.beginPath();ctx.moveTo(base.x,base.y);ctx.lineTo(top.x,top.y);ctx.stroke();ctx.fillStyle=time>19||time<6?'#f5d69c':'#d7c899';ctx.globalAlpha=time>19||time<6?.9:.28;ctx.beginPath();ctx.arc(top.x,top.y,Math.max(1,3*focal/base.d),0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}if(Math.abs(x-player.x)<110&&Math.abs(z-player.z)<110){for(let i=0;i<4;i++)groundRect(x+10.2,z+7+i*2.3,4,.85,'#c2baa0');drawCar(x-9,z-14,0,'#4d5552',false,true);}}}
  function drawCar(x,z,yaw,color,hero=false){const rot=(lx,lz)=>[x+lx*Math.cos(yaw)+lz*Math.sin(yaw),z-lx*Math.sin(yaw)+lz*Math.cos(yaw)],len=hero?5.1:4.15,w=hero?2.45:1.9,corners=[[-w/2,-len/2],[w/2,-len/2],[w/2,len/2],[-w/2,len/2]].map(a=>rot(a[0],a[1])),q=corners.map(v=>proj(v[0],.85,v[1]));if(q.some(v=>!v)||q[0].d>190)return;ctx.beginPath();ctx.moveTo(q[0].x,q[0].y);q.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#11191a';ctx.lineWidth=1;ctx.stroke();const cabin=[[-w*.36,-len*.24],[w*.36,-len*.24],[w*.31,len*.26],[-w*.31,len*.26]].map(a=>rot(a[0],a[1])).map(v=>proj(v[0],1.45,v[1]));if(cabin.every(Boolean)){ctx.beginPath();ctx.moveTo(cabin[0].x,cabin[0].y);cabin.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();ctx.fillStyle='#182627';ctx.fill();ctx.strokeStyle='#b9b29a55';ctx.stroke();}for(const side of [-1,1])for(const end of [-1,1]){const p=rot(side*w*.45,end*len*.38),q=proj(p[0],.75,p[1]);if(q){ctx.fillStyle=end===1?'#e6d49c':'#a04c3d';ctx.fillRect(q.x-2,q.y-1,4,2);}}if(hero){const sh=proj(x,2,z);if(sh){ctx.fillStyle='#e7d19b';ctx.font='9px monospace';ctx.fillText('YOUR RIDE',sh.x-25,sh.y-17);}}}
  function drawPerson(x,z,yaw,color,hero){const p=proj(x,0,z),head=proj(x,hero?2.65:2.05,z),shoulder=proj(x,hero?1.95:1.5,z);if(!p||!head||!shoulder||p.d>140)return;const scale=focal/p.d;ctx.strokeStyle='#0f1717';ctx.lineWidth=Math.max(2,7*scale);ctx.beginPath();ctx.moveTo(shoulder.x,shoulder.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=Math.max(2,10*scale);ctx.beginPath();ctx.moveTo(shoulder.x,shoulder.y);ctx.lineTo(p.x,p.y-2*scale);ctx.stroke();ctx.fillStyle=hero?'#c5a877':color;ctx.beginPath();ctx.arc(head.x,head.y,Math.max(2,5*scale),0,Math.PI*2);ctx.fill();if(hero){ctx.fillStyle='#d5bc83';ctx.beginPath();ctx.arc(head.x,head.y-13*scale,3.8*scale,0,Math.PI*2);ctx.fill();}}
  function drawMarker(){const m=missions[player.mission],x=m.place[0],z=m.place[1],d=Math.hypot(x-player.x,z-player.z);if(d>220)return;const p=proj(x,.35+Math.sin(elapsed*3)*.18,z);if(!p)return;const r=clamp(22*focal/p.d,5,50);ctx.strokeStyle='#e1c177cc';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y,r,r*.35,0,0,Math.PI*2);ctx.stroke();const top=proj(x,2.4,z),bottom=proj(x,.15,z);if(top&&bottom){ctx.strokeStyle='#d8b96fe0';ctx.lineWidth=Math.max(1,2*focal/p.d);ctx.beginPath();ctx.moveTo(bottom.x,bottom.y);ctx.lineTo(top.x,top.y);ctx.stroke();}ctx.fillStyle='#f0d99c';ctx.font=`${clamp(10*focal/p.d,8,15)}px monospace`;ctx.textAlign='center';ctx.fillText('✦',p.x,p.y-8);ctx.textAlign='left';if(d<9)completeMission();}
  function drawRain(){ctx.strokeStyle='#d5e0dc30';ctx.lineWidth=1;for(let i=0;i<75;i++){const x=(i*173+elapsed*180)%W,y=(i*97+elapsed*380)%H;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-3,y+10);ctx.stroke();}}
  function drawMinimap(){
    const w=mapCanvas.width,h=mapCanvas.height,s=w/150;mapCtx.clearRect(0,0,w,h);mapCtx.fillStyle='#192728';mapCtx.fillRect(0,0,w,h);
    mapCtx.save();mapCtx.translate(w/2,h/2);mapCtx.rotate(-player.yaw);
    for(let i=-5;i<=5;i++){mapCtx.fillStyle=Math.abs(i)%3===0?'#697065':'#293536';mapCtx.fillRect(i*24-2,-h/2,4,h);mapCtx.fillRect(-w/2,i*24-2,w,4);}
    for(const b of buildings){const dx=(b.x-player.x)*s*.23,dz=(b.z-player.z)*s*.23;if(Math.abs(dx)>w/2||Math.abs(dz)>h/2)continue;mapCtx.fillStyle='#45524d';mapCtx.fillRect(dx-b.w*s*.09,dz-b.d*s*.09,b.w*s*.18,b.d*s*.18);}
    const m=missions[player.mission],mx=(m.place[0]-player.x)*s*.23,mz=(m.place[1]-player.z)*s*.23;mapCtx.fillStyle='#e2bf76';mapCtx.beginPath();mapCtx.arc(mx,mz,4,0,Math.PI*2);mapCtx.fill();
    for(const t of traffic){const dx=(t.x-player.x)*s*.23,dz=(t.z-player.z)*s*.23;if(Math.abs(dx)<w/2&&Math.abs(dz)<h/2){mapCtx.fillStyle='#b4664d';mapCtx.fillRect(dx-1,dz-1,2,2);}}
    mapCtx.restore();mapCtx.fillStyle='#f0d99c';mapCtx.beginPath();mapCtx.arc(w/2,h/2,4,0,Math.PI*2);mapCtx.fill();mapCtx.strokeStyle='#162020';mapCtx.lineWidth=1;mapCtx.stroke();
  }
  function nearestTraffic(){let best=null,dist=Infinity;for(const t of traffic){if(t.x===999)continue;const d=Math.hypot(t.x-player.x,t.z-player.z);if(d<dist){best=t;dist=d;}}return{best,dist};}
  function nearestCar(){const {dist}=nearestTraffic();return Math.min(dist,ownedCar?Math.hypot(ownedCar.x-player.x,ownedCar.z-player.z):Infinity);}
  function updateHUD(){
    const m=missions[player.mission];$('mission-label').textContent=`STORY · ${String(player.mission+1).padStart(2,'0')} / ${String(missions.length).padStart(2,'0')}`;$('mission-title').textContent=m.title;$('mission-copy').textContent=m.copy;$('objective').textContent='OBJECTIVE · '+m.objective;$('reward').textContent=`+$ ${m.reward}`;$('money').textContent='$ '+player.money.toLocaleString();$('district').textContent=m.district;$('clock').textContent=`${String(Math.floor(time)).padStart(2,'0')}:${String(Math.floor((time%1)*60)).padStart(2,'0')} · ${weather}`;
    $('health-text').textContent=player.health;$('health-bar').style.width=player.health+'%';$('vehicle-hud').classList.toggle('hidden',!player.inCar);$('speed').textContent=String(Math.round(Math.abs(player.speed)*7)).padStart(3,'0');$('interact').classList.toggle('hidden',player.inCar||nearestCar()>5.5);$('hint').textContent=player.inCar?'WASD / ARROWS DRIVE  ·  E EXIT  ·  SPACE BRAKE':'WASD / ARROWS MOVE  ·  E INTERACT  ·  SHIFT SPRINT';
  }
  function store(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({x:player.x,z:player.z,yaw:player.yaw,money:player.money,mission:player.mission,ownedCar}));}catch{}}
  function toast(text){const el=$('toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2500);}
  let audioCtx=null;
  function playTone(freq,duration){if(!settings.sound)return;try{audioCtx||=new(window.AudioContext||window.webkitAudioContext)();const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(.035,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+duration);}catch{}}
  function completeMission(){if(paused||!$('complete').classList.contains('hidden'))return;paused=true;const m=missions[player.mission];player.money+=m.reward;player.mission=player.mission<missions.length-1?player.mission+1:0;store();$('complete-title').textContent=m.complete;$('complete-copy').textContent=m.result;$('complete-reward').textContent=`+$ ${m.reward}`;$('complete').classList.remove('hidden');playTone(540,.14);setTimeout(()=>playTone(730,.2),130);}
  function advanceMission(){$('complete').classList.add('hidden');paused=false;store();updateHUD();toast(player.mission===0?'CHAPTER COMPLETE · FREE ROAM UNLOCKED':'NEW LEAD ADDED TO YOUR JOURNAL');}
  function interact(){
    if(paused)return;
    if(player.inCar){player.inCar=false;player.speed=0;if(ownedCar){ownedCar.x=player.x;ownedCar.z=player.z;ownedCar.yaw=player.yaw;}store();toast('ON FOOT · STAY SHARP');playTone(250,.08);return;}
    if(ownedCar&&Math.hypot(ownedCar.x-player.x,ownedCar.z-player.z)<5.5){player.inCar=true;player.x=ownedCar.x;player.z=ownedCar.z;player.yaw=ownedCar.yaw;store();toast('NIGHTJAR S · VEHICLE ACQUIRED');playTone(410,.12);return;}
    const {best,dist}=nearestTraffic();if(best&&dist<5.5){player.inCar=true;player.yaw=best.axis==='x'?Math.PI/2:0;ownedCar={x:best.x,z:best.z,yaw:player.yaw,color:best.color};best.x=999;best.z=999;store();toast('NIGHTJAR S · VEHICLE ACQUIRED');playTone(410,.12);return;}
    if(Math.hypot(player.x-38,player.z-24)<13){toast('MARA · “Keep your head down. People disappear here.”');playTone(330,.12);return;}if(Math.hypot(player.x-115,player.z+54)<14){toast('TOMAS · “Northline owns the skyline. Not the truth.”');playTone(330,.12);return;}toast('NOTHING TO INTERACT WITH HERE');
  }
  function togglePause(){if(!$('complete').classList.contains('hidden'))return;paused=!paused;$('pause-overlay').classList.toggle('hidden',!paused);if(!paused)last=performance.now();}
  function move(dt){
    if(paused)return;
    const f=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)+touch.forward;
    const s=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+touch.side;
    if(player.inCar){const steer=(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)-(keys.has('KeyD')||keys.has('ArrowRight')?1:0)+touch.side;player.speed+=(f*14-(keys.has('Space')?player.speed*3:player.speed*.55))*dt;player.speed=clamp(player.speed,-5,25);player.yaw+=steer*dt*(.8+Math.abs(player.speed)*.06);player.x+=Math.sin(player.yaw)*player.speed*dt;player.z+=Math.cos(player.yaw)*player.speed*dt;}
    else if(f||s){const run=keys.has('ShiftLeft')||keys.has('ShiftRight'),speed=run?13:7.3,l=Math.hypot(f,s)||1,dx=(Math.sin(camYaw)*f+Math.cos(camYaw)*s)/l,dz=(Math.cos(camYaw)*f-Math.sin(camYaw)*s)/l,nx=player.x+dx*speed*dt,nz=player.z+dz*speed*dt;if(!buildings.some(b=>Math.abs(nx-b.x)<b.w/2+1.1&&Math.abs(player.z-b.z)<b.d/2+1.1))player.x=nx;if(!buildings.some(b=>Math.abs(player.x-b.x)<b.w/2+1.1&&Math.abs(nz-b.z)<b.d/2+1.1))player.z=nz;player.yaw=Math.atan2(dx,dz);}
    player.x=clamp(player.x,-355,355);player.z=clamp(player.z,-355,355);
    const targetX=player.x-Math.sin(player.yaw)*9+Math.sin(camYaw)*4,targetZ=player.z-Math.cos(player.yaw)*9-Math.cos(camYaw)*4;camX=mix(camX,targetX,1-Math.pow(.0008,dt));camZ=mix(camZ,targetZ,1-Math.pow(.0008,dt));cameraY=mix(cameraY,player.inCar?9.8:9.1,1-Math.pow(.05,dt));
    if(ownedCar&&player.inCar){ownedCar.x=player.x;ownedCar.z=player.z;ownedCar.yaw=player.yaw;}
    for(const t of traffic){if(t.x===999)continue;if(t.axis==='x'){t.x+=t.dir*t.speed*dt;if(t.x>330)t.x=-330;if(t.x< -330)t.x=330;}else{t.z+=t.dir*t.speed*dt;if(t.z>330)t.z=-330;if(t.z< -330)t.z=330;}}
    for(const p of walkers){p.phase+=dt;if(p.phase>8){p.angle+=(Math.random()-.5)*1.8;p.phase=0;}p.x+=Math.sin(p.angle)*p.speed*dt;p.z+=Math.cos(p.angle)*p.speed*dt;}
    elapsed+=dt;saveTimer+=dt;if(saveTimer>=5){store();saveTimer=0;}time=(time+dt*.004)%24;if(time>21&&weather==='CLEAR'&&Math.random()<dt*.001)weather='RAIN';if(weather==='RAIN'&&time<7)weather='CLEAR';updateHUD();drawMinimap();
  }
  function render(){if(!paused){ctx.save();ctx.scale(settings.quality,settings.quality);ctx.translate(W*(1-settings.quality)/2,H*(1-settings.quality)/2);drawWorld();ctx.restore();}else drawWorld();}
  function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(!paused)move(dt);render();requestAnimationFrame(loop);}
  addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='KeyE'&&!e.repeat)interact();if(e.code==='Escape'&&!e.repeat)togglePause();if(e.code==='KeyC'&&!e.repeat&&player.inCar){player.interior=!player.interior;toast(player.interior?'INTERIOR CAMERA':'CHASE CAMERA');}});
  addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();store();});addEventListener('pagehide',store);$('pause-btn').onclick=togglePause;$('resume-btn').onclick=togglePause;$('continue-btn').onclick=advanceMission;$('quality').value=String(settings.quality);$('quality').onchange=e=>{settings.quality=Number(e.target.value);localStorage.setItem('cos-quality',e.target.value);};$('sound-toggle').textContent=settings.sound?'ON':'OFF';$('sound-toggle').onclick=()=>{settings.sound=!settings.sound;localStorage.setItem('cos-sound',settings.sound?'on':'off');$('sound-toggle').textContent=settings.sound?'ON':'OFF';};$('reset-btn').onclick=()=>{localStorage.removeItem(SAVE_KEY);location.reload();};
  let dragging=false,lastX=0;canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){dragging=true;lastX=e.clientX;canvas.setPointerCapture(e.pointerId);}});canvas.addEventListener('pointermove',e=>{if(dragging){camYaw+=(e.clientX-lastX)*.004;lastX=e.clientX;}});canvas.addEventListener('pointerup',()=>dragging=false);
  const stick=$('stick');let stickPointer=null;stick.addEventListener('pointerdown',e=>{stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);stickMove(e);});stick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)stickMove(e);});stick.addEventListener('pointerup',stickEnd);stick.addEventListener('pointercancel',stickEnd);
  function stickMove(e){const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,lim=r.width*.36,d=Math.hypot(dx,dy),k=Math.min(1,lim/Math.max(1,d));touch.forward=-dy*k/lim;touch.side=dx*k/lim;stick.querySelector('span').style.transform=`translate(${dx*k}px,${dy*k}px)`;}
  function stickEnd(){stickPointer=null;touch.forward=touch.side=0;stick.querySelector('span').style.transform='';}
  $('touch-enter').onclick=interact;$('touch-run').onpointerdown=()=>keys.add('ShiftLeft');$('touch-run').onpointerup=()=>keys.delete('ShiftLeft');$('touch-run').onpointercancel=()=>keys.delete('ShiftLeft');
  updateHUD();drawMinimap();requestAnimationFrame(loop);
})();
