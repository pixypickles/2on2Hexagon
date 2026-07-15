'use strict';

const TEAMS = [
  {name:'BLIZZARD FOX', primary:'#f5f5f5', secondary:'#0b0b0d', accent:'#75dcff', pattern:'stripes', shorts:'#08090b'},
  {name:'SALVIDA A', primary:'#7a1d35', secondary:'#7a1d35', accent:'#f7f3ef', pattern:'solid', shorts:'#f4f4f4'},
  {name:'SALVIDA B', primary:'#22b8b5', secondary:'#22b8b5', accent:'#f7f3ef', pattern:'solid', shorts:'#f4f4f4'},
  {name:'TAKE-ZO', primary:'#f056a7', secondary:'#17223f', accent:'#ffffff', pattern:'hoops', shorts:'#f4f4f4'},
  {name:'漫チェスターP', primary:'#111a37', secondary:'#111a37', accent:'#27335c', pattern:'solid', shorts:'#111a37'}
];

const $ = s => document.querySelector(s);
const canvas = $('#gameCanvas');
const ctx = canvas.getContext('2d');
const menu = $('#menu'), gameScreen = $('#gameScreen'), result = $('#result');
const teamSelect = $('#teamSelect'), opponentSelect = $('#opponentSelect');
TEAMS.forEach((t,i)=>{teamSelect.add(new Option(t.name,i));opponentSelect.add(new Option(t.name,i));});
opponentSelect.value='1';

const W=1280,H=720,CX=W/2,CY=H/2;
const COURT={left:165,right:1115,top:72,bottom:648,cut:185,goalW:260};
const keys={};
const touchDir={up:false,down:false,left:false,right:false};
const touchAct={A:false,B:false,C:false,D:false};
let state=null, raf=0, last=0;

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function len(x,y){return Math.hypot(x,y)||1;}
function norm(x,y){const l=len(x,y);return{x:x/l,y:y/l};}
function angleDiff(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
function hexBoundsAtY(y){
  const {left,right,top,bottom,cut}=COURT;
  if(y<top+cut){const t=(y-top)/cut;return{min:left+cut*(1-t),max:right-cut*(1-t)}}
  if(y>bottom-cut){const t=(bottom-y)/cut;return{min:left+cut*(1-t),max:right-cut*(1-t)}}
  return{min:left,max:right};
}
function inGoalMouth(x){return Math.abs(x-CX)<COURT.goalW/2;}

class Player{
  constructor(team,role,x,y){this.team=team;this.role=role;this.x=x;this.y=y;this.r=27;this.vx=0;this.vy=0;this.action='';this.actionT=0;this.stun=0;this.charge=0;this.charging='';this.dive=0;this.diveVX=0;this.diveVY=0;this.justWindow=0;}
}
class Ball{
  constructor(){this.reset();}
  reset(){this.x=CX;this.y=CY;this.vx=0;this.vy=0;this.r=13;this.z=0;this.vz=0;this.owner=null;this.lastTeam=-1;this.type='normal';this.curve=0;this.charge=0;this.special='';this.specialT=0;this.visible=true;this.trail=[];this.passTarget=null;this.contactCooldown=0;}
}

function newGame(){
  cancelAnimationFrame(raf);
  const t1=TEAMS[+teamSelect.value],t2=TEAMS[+opponentSelect.value];
  state={
    mode:$('#modeSelect').value,difficulty:$('#difficultySelect').value,total:+$('#timeSelect').value,time:+$('#timeSelect').value,
    running:true,score:[0,0],gauge:[0,0],teams:[t1,t2],special:[$('#specialSelect').value,['hook','curve','break','stealth'][Math.floor(Math.random()*4)]],
    active:[1,1],players:[[],[]],ball:new Ball(),freeze:0,statusT:1.2,goalPause:0,keyboard2:false
  };
  state.players[0]=[new Player(0,'GK',CX,H-118),new Player(0,'FP',CX,H-285)];
  state.players[1]=[new Player(1,'GK',CX,118),new Player(1,'FP',CX,285)];
  $('#p1Name').textContent=t1.name;$('#p2Name').textContent=t2.name;
  menu.classList.add('hidden');result.classList.add('hidden');gameScreen.classList.remove('hidden');
  updateHUD();last=performance.now();raf=requestAnimationFrame(loop);
}

function resetKickoff(scoredOn=-1){
  const b=state.ball;b.reset();
  state.players[0][0].x=CX;state.players[0][0].y=H-118;state.players[0][1].x=CX;state.players[0][1].y=H-285;
  state.players[1][0].x=CX;state.players[1][0].y=118;state.players[1][1].x=CX;state.players[1][1].y=285;
  state.active=[1,1];state.goalPause=.9;state.statusT=.9;
  $('#statusText').textContent=scoredOn<0?'KICK OFF':'GOAL!';
}

function inputVector(team){
  let x=0,y=0;
  if(team===0){
    if(keys.KeyA||touchDir.left)x--; if(keys.KeyD||touchDir.right)x++; if(keys.KeyW||touchDir.up)y--; if(keys.KeyS||touchDir.down)y++;
  }else{
    if(keys.ArrowLeft)x--;if(keys.ArrowRight)x++;if(keys.ArrowUp)y--;if(keys.ArrowDown)y++;
  }
  return norm(x,y);
}
function actionHeld(team,a){
  if(team===0){const map={A:'KeyJ',B:'KeyK',C:'KeyL',D:'Semicolon'};return !!(keys[map[a]]||touchAct[a]);}
  const map={A:'Digit1',B:'Digit2',C:'Digit3',D:'Digit0'};return !!keys[map[a]];
}

function pressAction(team,a){
  if(!state||!state.running)return;
  const own=state.ball.owner && state.ball.owner.team===team;
  if(own){
    if((a==='C'||a==='D') && actionHeld(team,a==='C'?'D':'C') && state.gauge[team]>=100){fireSpecial(team);return;}
    if(a==='A'||a==='B')pass(team,a==='B');
    else if(a==='C'||a==='D'){const p=state.ball.owner;p.charging=a;p.charge=0;}
  }else{
    if(a==='A')state.active[team]=1-state.active[team];
    else if(a==='B'){const p=state.players[team][state.active[team]];p.action='return';p.actionT=.22;}
    else if(a==='C'||a==='D')keeperDive(team,a==='C');
  }
}
function releaseAction(team,a){
  if(!state)return;const p=state.ball.owner;
  if(p&&p.team===team&&p.charging===a){shoot(team,a,p.charge);p.charging='';p.charge=0;}
}

function pass(team,lob){
  const b=state.ball,from=b.owner;if(!from||from.team!==team)return;
  const mate=state.players[team][from===state.players[team][0]?1:0];
  const n=norm(mate.x-from.x,mate.y-from.y);b.owner=null;b.x=from.x+n.x*35;b.y=from.y+n.y*35;b.vx=n.x*(lob?430:650);b.vy=n.y*(lob?430:650);b.z=lob?18:0;b.vz=lob?410:0;b.type=lob?'lob':'normal';b.lastTeam=team;b.passTarget=lob?mate:null;b.contactCooldown=.12;state.active[team]=mate.role==='GK'?0:1;state.gauge[team]=clamp(state.gauge[team]+4,0,100);
}
function shoot(team,button,charge){
  const b=state.ball,p=b.owner;if(!p)return;const targetY=team===0?COURT.top-30:COURT.bottom+30;let dx=(CX-p.x)+(p.team===0?1:-1)*0;let dy=targetY-p.y;const mv=inputVector(team);if(Math.abs(mv.x)>0.05)dx+=mv.x*420;const n=norm(dx,dy);const power=640+charge*520;b.owner=null;b.x=p.x+n.x*36;b.y=p.y+n.y*36;b.vx=n.x*power;b.vy=n.y*power;b.z=0;b.vz=0;b.type=button==='C'?(charge>.93?'knuckle':charge>.25?'charged':'normal'):'curve';b.curve=button==='D'?(team===0?1:-1)*(Math.abs(mv.x)>.1?Math.sign(mv.x):1)*(.32+charge*.82):0;b.charge=charge;b.lastTeam=team;state.gauge[team]=clamp(state.gauge[team]+7+charge*5,0,100);
}
function fireSpecial(team){
  const b=state.ball,p=b.owner;if(!p)return;const spec=state.special[team];const targetY=team===0?COURT.top-20:COURT.bottom+20;const mv=inputVector(team);let aimX=CX+(Math.abs(mv.x)>.1?Math.sign(mv.x):1)*120;const n=norm(aimX-p.x,targetY-p.y);b.owner=null;b.x=p.x+n.x*40;b.y=p.y+n.y*40;b.vx=n.x*(spec==='break'?330:780);b.vy=n.y*(spec==='break'?330:780);b.type='special';b.special=spec;b.specialT=0;b.lastTeam=team;b.curve=spec==='curve'?(Math.abs(mv.x)>.1?Math.sign(mv.x):1)*(team===0?1:-1)*1.55:0;b.visible=true;state.gauge[team]=0;state.statusT=.8;$('#statusText').textContent='SPECIAL!';
}
function keeperDive(team,longDive){
  const g=state.players[team][0],b=state.ball;const n=norm(b.x-g.x,b.y-g.y);g.dive=longDive?.42:.3;g.diveVX=n.x*(longDive?720:470);g.diveVY=n.y*(longDive?720:470);g.action=longDive?'punch':'catch';g.actionT=g.dive;g.justWindow=.12;
}

function update(dt){
  if(state.freeze>0){state.freeze-=dt;return;}
  if(state.goalPause>0){state.goalPause-=dt;return;}
  state.time-=dt;if(state.time<=0){state.time=0;finish();return;}
  if(state.statusT>0){state.statusT-=dt;if(state.statusT<=0)$('#statusText').textContent='';}
  updateTeam(0,dt,true);
  if(state.mode==='2p') updateTeam(1,dt,true); else updateCPU(dt);
  updateBall(dt);collisions();updateHUD();
}

function updateTeam(team,dt,human){
  const players=state.players[team];for(const p of players){if(p.stun>0)p.stun-=dt;if(p.actionT>0)p.actionT-=dt;if(p.justWindow>0)p.justWindow-=dt;}

  // 操作を離れたGKは、放置された位置に留まらずゴール中央へ素早く帰還する。
  const g=players[0];
  if(state.active[team]!==0 && g.stun<=0){
    const homeY=team===0?H-118:118;
    const dx=CX-g.x,dy=homeY-g.y,d=Math.hypot(dx,dy);
    if(d>3){const n=norm(dx,dy),dash=430;g.x+=n.x*Math.min(d,dash*dt);g.y+=n.y*Math.min(d,dash*dt);constrainPlayer(g);}
  }

  const p=players[state.active[team]];if(!human||p.stun>0)return;
  let v=inputVector(team);if(!((team===0&&(keys.KeyW||keys.KeyS||keys.KeyA||keys.KeyD||Object.values(touchDir).some(Boolean)))||(team===1&&(keys.ArrowUp||keys.ArrowDown||keys.ArrowLeft||keys.ArrowRight))))v={x:0,y:0};
  const speed=p.charging?120:290;p.x+=v.x*speed*dt;p.y+=v.y*speed*dt;constrainPlayer(p);
  if(p.dive>0){p.x+=p.diveVX*dt;p.y+=p.diveVY*dt;p.dive-=dt;constrainPlayer(p);}
  if(p.charging)p.charge=clamp(p.charge+dt/.68,0,1);
}
function updateCPU(dt){
  const diff={easy:.55,normal:.78,hard:1}[state.difficulty];const team=1,b=state.ball,ps=state.players[1],g=ps[0],f=ps[1];
  for(const p of ps){if(p.stun>0)p.stun-=dt;if(p.actionT>0)p.actionT-=dt;if(p.justWindow>0)p.justWindow-=dt;}
  const owns=b.owner&&b.owner.team===1;
  if(owns){state.active[1]=b.owner===g?0:1;const p=b.owner;p.x+=clamp(CX-p.x,-1,1)*110*dt;constrainPlayer(p);if(Math.random()<dt*(.9+diff)){if(state.gauge[1]>=100&&Math.random()<.35)fireSpecial(1);else shoot(1,Math.random()<.45?'D':'C',Math.random()*(.5+diff*.5));}}
  else{
    g.x+=clamp(b.x-g.x,-1,1)*(120+diff*130)*dt;g.x=clamp(g.x,CX-COURT.goalW*.55,CX+COURT.goalW*.55);constrainPlayer(g);
    f.x+=clamp(b.x-f.x,-1,1)*(90+diff*120)*dt;f.y+=clamp(Math.min(320,b.y)-f.y,-1,1)*100*dt;constrainPlayer(f);
    const d=len(b.x-g.x,b.y-g.y);if(d<190&&b.vy<0&&Math.random()<dt*(2+diff*5))keeperDive(1,Math.random()<.65);
    if(len(b.x-f.x,b.y-f.y)<80&&Math.random()<dt*(2+diff*4)){f.action='return';f.actionT=.22;}
  }
}
function constrainPlayer(p){
  const half=p.team===0?1:-1;if(p.team===0)p.y=clamp(p.y,CY+28,COURT.bottom-28);else p.y=clamp(p.y,COURT.top+28,CY-28);const hb=hexBoundsAtY(p.y);p.x=clamp(p.x,hb.min+p.r,hb.max-p.r);
  if(p.role==='GK'){if(p.team===0)p.y=Math.max(p.y,H-210);else p.y=Math.min(p.y,210);}
}

function updateBall(dt){
  const b=state.ball;
  if(b.contactCooldown>0)b.contactCooldown-=dt;
  if(b.owner){const p=b.owner;b.x=p.x;b.y=p.y+(p.team===0?-25:25);b.z=0;return;}
  b.specialT+=dt;if(b.special==='stealth'){b.visible=!(b.specialT>.12&&b.specialT<.62);}
  if(b.type==='knuckle'){const wobble=Math.sin(performance.now()*.035)+Math.sin(performance.now()*.021);b.vx+=wobble*155*dt;}
  if(b.curve){const sp=len(b.vx,b.vy);const nx=-b.vy/sp,ny=b.vx/sp;b.vx+=nx*b.curve*145*dt;b.vy+=ny*b.curve*145*dt;}
  if(b.special==='hook'){
    const goalY=b.lastTeam===0?COURT.top:COURT.bottom;if(Math.abs(b.y-goalY)<180&&b.specialT<1.1){const a=Math.atan2(b.vy,b.vx)+(b.vx>=0?1:-1)*(b.lastTeam===0?-1:1)*Math.PI/6;const sp=len(b.vx,b.vy);b.vx=Math.cos(a)*sp;b.vy=Math.sin(a)*sp;b.specialT=99;}
  }
  b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;b.vz-=900*dt;if(b.z<0){b.z=0;b.vz*=-.35;if(Math.abs(b.vz)<45)b.vz=0;}
  b.vx*=Math.pow(.994,dt*60);b.vy*=Math.pow(.994,dt*60);
  b.trail.push({x:b.x,y:b.y,z:b.z});if(b.trail.length>12)b.trail.shift();
  wallAndGoal(b);
}
function wallAndGoal(b){
  let bounced=false;
  if(b.y-b.r<COURT.top){if(inGoalMouth(b.x)){score(0);return;}b.y=COURT.top+b.r;b.vy=Math.abs(b.vy)*.84;b.vx*=.92;bounced=true;}
  if(b.y+b.r>COURT.bottom){if(inGoalMouth(b.x)){score(1);return;}b.y=COURT.bottom-b.r;b.vy=-Math.abs(b.vy)*.84;b.vx*=.92;bounced=true;}
  const hb=hexBoundsAtY(b.y);
  if(b.x-b.r<hb.min){b.x=hb.min+b.r;b.vx=Math.abs(b.vx)*.84;b.vy*=.92;bounced=true;}
  if(b.x+b.r>hb.max){b.x=hb.max-b.r;b.vx=-Math.abs(b.vx)*.84;b.vy*=.92;bounced=true;}
  // 壁沿いに吸い付く軌道を防ぐため、反射のたびに回転を大きく失わせる。
  if(bounced)b.curve*=.38;
}
function score(team){state.score[team]++;state.gauge[team]=clamp(state.gauge[team]+12,0,100);resetKickoff(1-team);updateHUD();}

function collisions(){
  const b=state.ball;if(b.owner)return;
  for(let team=0;team<2;team++)for(const p of state.players[team]){
    const d=len(b.x-p.x,b.y-p.y);
    // 浮き玉パスは受け手が多少遠くても踏み込んで強引にボレーする。
    if(b.type==='lob' && b.passTarget===p && b.contactCooldown<=0 && d<118 && b.z>12 && b.z<135){autoVolley(p);return;}
    if(d>p.r+b.r+10||b.z>58)continue;
    const incoming=b.lastTeam!==team;
    if(p.role==='GK'&&incoming){
      const just=p.justWindow>0||actionHeld(team,'C')||actionHeld(team,'D');
      if(just){catchBall(p,true);return;}
      if(p.action==='catch'&&b.type!=='knuckle'&&b.type!=='special'){catchBall(p,false);return;}
      if(b.special==='break'){p.stun=.75;reflectFromPlayer(p,1.05);return;}
      if(p.action==='punch'||p.action==='catch'){reflectFromPlayer(p,1.2);state.gauge[team]=clamp(state.gauge[team]+8,0,100);return;}
    }
    if(p.action==='return'&&incoming){const n=norm(CX-p.x,team===0?COURT.top-p.y:COURT.bottom-p.y);b.vx=n.x*760;b.vy=n.y*760;b.lastTeam=team;b.type='charged';state.gauge[team]=clamp(state.gauge[team]+12,0,100);return;}
    if(b.special==='break'&&incoming){p.stun=.75;reflectFromPlayer(p,1.05);return;}
    if(b.type==='charged'||b.type==='knuckle'||b.type==='special'){reflectFromPlayer(p,1.0);return;}
    // Normal ball trap / possession.
    if(b.z<24){b.owner=p;b.vx=b.vy=0;b.type='normal';b.special='';b.visible=true;state.active[team]=p.role==='GK'?0:1;return;}
  }
}
function autoVolley(p){
  const b=state.ball;
  const targetY=p.team===0?COURT.top-24:COURT.bottom+24;
  const leadX=clamp(CX+(CX-p.x)*.25,CX-COURT.goalW*.42,CX+COURT.goalW*.42);
  const n=norm(leadX-p.x,targetY-p.y);
  const power=b.z>78?810:760;
  // 少し離れていても、選手をボール側へ踏み込ませて見た目と判定を一致させる。
  const step=norm(b.x-p.x,b.y-p.y);p.x+=step.x*Math.min(34,len(b.x-p.x,b.y-p.y));p.y+=step.y*Math.min(34,len(b.x-p.x,b.y-p.y));constrainPlayer(p);
  p.action=b.z>78?'overhead':'volley';p.actionT=.28;
  b.x=p.x+n.x*(p.r+b.r+5);b.y=p.y+n.y*(p.r+b.r+5);b.z=Math.max(18,b.z*.45);b.vz=90;
  b.vx=n.x*power;b.vy=n.y*power;b.lastTeam=p.team;b.type='charged';b.curve=0;b.passTarget=null;b.contactCooldown=.15;
  state.active[p.team]=p.role==='GK'?0:1;state.gauge[p.team]=clamp(state.gauge[p.team]+9,0,100);
}

function reflectFromPlayer(p,mul){const b=state.ball,n=norm(b.x-p.x,b.y-p.y),sp=Math.max(430,len(b.vx,b.vy)*mul);b.x=p.x+n.x*(p.r+b.r+2);b.y=p.y+n.y*(p.r+b.r+2);b.vx=n.x*sp;b.vy=n.y*sp;}
function catchBall(p,just){const b=state.ball;b.owner=p;b.vx=b.vy=0;b.type='normal';b.special='';b.visible=true;state.active[p.team]=p.role==='GK'?0:1;state.gauge[p.team]=clamp(state.gauge[p.team]+(just?18:9),0,100);if(just){state.freeze=.2;$('#slowFlash').classList.remove('flash');void $('#slowFlash').offsetWidth;$('#slowFlash').classList.add('flash');$('#statusText').textContent='JUST CATCH!';state.statusT=.75;}}

function draw(){ctx.clearRect(0,0,W,H);drawCourt();drawBallTrail();for(const team of [1,0])for(let i=0;i<2;i++)drawPlayer(state.players[team][i],state.active[team]===i);drawBall();drawCharge();}
function drawCourt(){
  ctx.save();ctx.beginPath();ctx.moveTo(COURT.left+COURT.cut,COURT.top);ctx.lineTo(COURT.right-COURT.cut,COURT.top);ctx.lineTo(COURT.right,COURT.top+COURT.cut);ctx.lineTo(COURT.right,COURT.bottom-COURT.cut);ctx.lineTo(COURT.right-COURT.cut,COURT.bottom);ctx.lineTo(COURT.left+COURT.cut,COURT.bottom);ctx.lineTo(COURT.left,COURT.bottom-COURT.cut);ctx.lineTo(COURT.left,COURT.top+COURT.cut);ctx.closePath();
  const g=ctx.createLinearGradient(0,COURT.top,0,COURT.bottom);g.addColorStop(0,'#174e5b');g.addColorStop(.5,'#15604f');g.addColorStop(1,'#174e5b');ctx.fillStyle=g;ctx.fill();ctx.lineWidth=12;ctx.strokeStyle='#b4e8f2';ctx.stroke();ctx.clip();
  for(let y=COURT.top;y<COURT.bottom;y+=72){ctx.fillStyle=((y/72)|0)%2?'#ffffff08':'#00000008';ctx.fillRect(COURT.left,y,COURT.right-COURT.left,72)}
  ctx.strokeStyle='#d7ffffaa';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(COURT.left,CY);ctx.lineTo(COURT.right,CY);ctx.stroke();ctx.beginPath();ctx.arc(CX,CY,82,0,Math.PI*2);ctx.stroke();ctx.restore();
  drawGoal(true);drawGoal(false);
}
function drawGoal(top){const y=top?COURT.top:COURT.bottom;ctx.save();ctx.strokeStyle='#f2fbff';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(CX-COURT.goalW/2,y);ctx.lineTo(CX-COURT.goalW/2,top?y-45:y+45);ctx.lineTo(CX+COURT.goalW/2,top?y-45:y+45);ctx.lineTo(CX+COURT.goalW/2,y);ctx.stroke();ctx.globalAlpha=.25;ctx.fillStyle='#c8f6ff';ctx.fillRect(CX-COURT.goalW/2,top?y-45:y,COURT.goalW,45);ctx.restore();}
function drawPlayer(p,active){const t=state.teams[p.team];ctx.save();ctx.translate(p.x,p.y);if(p.stun>0)ctx.rotate(Math.sin(performance.now()*.04)*.35);if(p.dive>0)ctx.rotate(Math.atan2(p.diveVY,p.diveVX)+Math.PI/2);
  if(active){ctx.beginPath();ctx.arc(0,0,p.r+8,0,Math.PI*2);ctx.strokeStyle='#fff66b';ctx.lineWidth=5;ctx.stroke();}
  ctx.beginPath();ctx.arc(0,0,p.r,0,Math.PI*2);ctx.fillStyle=t.primary;ctx.fill();ctx.lineWidth=5;ctx.strokeStyle=t.secondary;ctx.stroke();
  if(t.pattern==='stripes'){ctx.save();ctx.beginPath();ctx.arc(0,0,p.r-2,0,Math.PI*2);ctx.clip();ctx.fillStyle=t.secondary;for(let x=-22;x<25;x+=14)ctx.fillRect(x,-30,7,60);ctx.restore();}
  if(t.pattern==='hoops'){ctx.save();ctx.beginPath();ctx.arc(0,0,p.r-2,0,Math.PI*2);ctx.clip();ctx.fillStyle=t.secondary;for(let y=-22;y<25;y+=14)ctx.fillRect(-30,y,60,7);ctx.restore();}
  ctx.fillStyle=t.accent;ctx.beginPath();ctx.arc(0,0,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#07131f';ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(p.role==='GK'?'G':'F',0,1);ctx.restore();}
function drawBallTrail(){const b=state.ball;for(let i=0;i<b.trail.length;i++){const q=b.trail[i],a=i/b.trail.length*.28;ctx.fillStyle=`rgba(210,245,255,${a})`;ctx.beginPath();ctx.arc(q.x,q.y-q.z*.25,b.r*(i/b.trail.length),0,Math.PI*2);ctx.fill();}}
function drawBall(){const b=state.ball;if(b.special==='stealth'&&!b.visible){ctx.save();ctx.globalAlpha=.55;ctx.fillStyle='#07131f';ctx.beginPath();ctx.ellipse(b.x,b.y+10,18,7,0,0,Math.PI*2);ctx.fill();ctx.restore();return;}ctx.save();ctx.translate(b.x,b.y-b.z*.28);ctx.shadowBlur=b.type==='special'?26:10;ctx.shadowColor=b.type==='special'?'#fff06a':'#9ff';ctx.fillStyle='#f7fbff';ctx.beginPath();ctx.arc(0,0,b.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#12202b';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#12202b';ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fill();ctx.restore();if(b.z>0){ctx.fillStyle='#0006';ctx.beginPath();ctx.ellipse(b.x,b.y+9,16,6,0,0,Math.PI*2);ctx.fill();}}
function drawCharge(){for(let team=0;team<2;team++)for(const p of state.players[team])if(p.charging){ctx.fillStyle='#000b';ctx.fillRect(p.x-35,p.y-48,70,8);ctx.fillStyle='#ffe462';ctx.fillRect(p.x-35,p.y-48,70*p.charge,8);}}

function updateHUD(){if(!state)return;$('#score1').textContent=state.score[0];$('#score2').textContent=state.score[1];const s=Math.ceil(state.time),m=Math.floor(s/60),ss=s%60;$('#timer').textContent=`${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;$('#gauge1').style.width=state.gauge[0]+'%';$('#gauge2').style.width=state.gauge[1]+'%';}
function loop(now){if(!state||!state.running)return;const dt=Math.min(.033,(now-last)/1000);last=now;update(dt);draw();raf=requestAnimationFrame(loop);}
function finish(){state.running=false;cancelAnimationFrame(raf);gameScreen.classList.add('hidden');result.classList.remove('hidden');const [a,b]=state.score;$('#resultTitle').textContent=a>b?'YOU WIN!':a<b?'YOU LOSE':'DRAW';$('#resultScore').textContent=`${state.teams[0].name} ${a} - ${b} ${state.teams[1].name}`;}

function bindHoldButton(el,onPress,onRelease){
  const down=e=>{e.preventDefault();el.classList.add('pressed');onPress();};
  const up=e=>{e.preventDefault();el.classList.remove('pressed');onRelease();};
  el.addEventListener('pointerdown',down);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('pointerleave',e=>{if(e.buttons)up(e)});
}
document.querySelectorAll('[data-dir]').forEach(el=>{const d=el.dataset.dir;bindHoldButton(el,()=>touchDir[d]=true,()=>touchDir[d]=false);});
document.querySelectorAll('[data-act]').forEach(el=>{const a=el.dataset.act;bindHoldButton(el,()=>{touchAct[a]=true;pressAction(0,a);},()=>{touchAct[a]=false;releaseAction(0,a);});});
window.addEventListener('keydown',e=>{if(keys[e.code])return;keys[e.code]=true;const m1={KeyJ:'A',KeyK:'B',KeyL:'C',Semicolon:'D'},m2={Digit1:'A',Digit2:'B',Digit3:'C',Digit0:'D'};if(m1[e.code])pressAction(0,m1[e.code]);if(m2[e.code]&&state?.mode==='2p')pressAction(1,m2[e.code]);if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();});
window.addEventListener('keyup',e=>{keys[e.code]=false;const m1={KeyJ:'A',KeyK:'B',KeyL:'C',Semicolon:'D'},m2={Digit1:'A',Digit2:'B',Digit3:'C',Digit0:'D'};if(m1[e.code])releaseAction(0,m1[e.code]);if(m2[e.code])releaseAction(1,m2[e.code]);});
$('#startBtn').addEventListener('click',newGame);$('#rematchBtn').addEventListener('click',newGame);$('#menuBtn').addEventListener('click',()=>{result.classList.add('hidden');menu.classList.remove('hidden');});$('#quitBtn').addEventListener('click',()=>{if(state)state.running=false;cancelAnimationFrame(raf);gameScreen.classList.add('hidden');menu.classList.remove('hidden');});
