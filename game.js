
const canvas=document.getElementById("game");
const ctx=canvas.getContext("2d");
const W=canvas.width,H=canvas.height,CX=W/2,CY=H/2;
const court={top:52,bottom:H-52,left:100,right:W-100,cut:195};
const goalW=190;
const input={up:false,down:false,left:false,right:false,dash:false};
const score=[0,0];

const player={x:CX,y:H-120,r:24,team:0,down:0,vx:0,vy:0};
const cpu={x:CX,y:120,r:24,team:1,cool:0,down:0,vx:0,vy:0};
const keepers=[
  {x:CX,y:H-80,r:26,team:0,hold:0},
  {x:CX,y:80,r:26,team:1,hold:0}
];
const ball={x:CX,y:CY,vx:0,vy:0,r:14,owner:null,laser:false,cool:0};

const bumpers=[
  {x:250,y:150,r:24,a:0,moving:false},
  {x:710,y:150,r:24,a:2,moving:false},
  {x:180,y:245,r:24,a:3,moving:false},
  {x:780,y:245,r:24,a:4,moving:false},
  {x:250,y:390,r:24,a:5,moving:false},
  {x:710,y:390,r:24,a:7,moving:false},
  {x:165,y:315,r:24,a:8,moving:false},
  {x:795,y:315,r:24,a:9,moving:false},
  {x:CX,y:CY,r:28,a:0,moving:true,baseX:CX,t:0}
];

let charging=false,charge=0,last=performance.now();

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

function boundsAtY(y){
  if(y<=CY){
    const t=clamp((y-court.top)/(CY-court.top),0,1);
    return {min:court.left+court.cut*(1-t),max:court.right-court.cut*(1-t)};
  }
  const t=clamp((court.bottom-y)/(court.bottom-CY),0,1);
  return {min:court.left+court.cut*(1-t),max:court.right-court.cut*(1-t)};
}
function constrain(o,minY,maxY){
  o.y=clamp(o.y,minY,maxY);
  const b=boundsAtY(o.y);
  o.x=clamp(o.x,b.min+o.r,b.max-o.r);
}
function attach(o){
  if(o.down>0)return;
  ball.owner=o; ball.vx=ball.vy=0; ball.laser=false; ball.cool=.18;
}
function kick(o,dx,dy,power,laser=false){
  const d=Math.hypot(dx,dy)||1;
  ball.owner=null;
  ball.x=o.x+dx/d*(o.r+ball.r+4);
  ball.y=o.y+dy/d*(o.r+ball.r+4);
  ball.vx=dx/d*power; ball.vy=dy/d*power;
  ball.laser=laser; ball.cool=.15;
}
function resetBall(team=0){
  Object.assign(player,{x:CX,y:H-120,down:0,vx:0,vy:0});
  Object.assign(cpu,{x:CX,y:120,down:0,vx:0,vy:0});
  Object.assign(ball,{x:CX,y:CY,vx:0,vy:0,owner:null,laser:false,cool:.3});
  attach(team===0?player:cpu);
}
function startShoot(){ if(!charging){charging=true;charge=0;} }
function stopShoot(){
  if(!charging)return;
  if(ball.owner===player){
    const laser=charge>=1.1;
    const power=laser?19:charge>=.45?12:8;
    kick(player,0,-1,power,laser);
  }
  charging=false; charge=0;
}

addEventListener("keydown",e=>{
  const k=e.key.toLowerCase();
  if(k==="w")input.up=true;
  if(k==="s")input.down=true;
  if(k==="a")input.left=true;
  if(k==="d")input.right=true;
  if(k==="k")input.dash=true;
  if(k==="l")startShoot();
});
addEventListener("keyup",e=>{
  const k=e.key.toLowerCase();
  if(k==="w")input.up=false;
  if(k==="s")input.down=false;
  if(k==="a")input.left=false;
  if(k==="d")input.right=false;
  if(k==="k")input.dash=false;
  if(k==="l")stopShoot();
});

function bindHold(el,on,off){
  const down=e=>{e.preventDefault();el.classList.add("active");on();};
  const up=e=>{e.preventDefault();el.classList.remove("active");off();};
  el.addEventListener("pointerdown",down);
  el.addEventListener("pointerup",up);
  el.addEventListener("pointercancel",up);
  el.addEventListener("pointerleave",e=>{if(e.buttons)up(e)});
}
document.querySelectorAll("[data-dir]").forEach(btn=>{
  const dirs=btn.dataset.dir.split(",");
  bindHold(btn,()=>dirs.forEach(d=>input[d]=true),()=>dirs.forEach(d=>input[d]=false));
});
bindHold(document.getElementById("dash"),()=>input.dash=true,()=>input.dash=false);
bindHold(document.getElementById("shoot"),startShoot,stopShoot);

function updateKnockback(o,dt,minY,maxY){
  if(o.down<=0)return false;
  o.down-=dt;
  o.x+=o.vx*dt; o.y+=o.vy*dt;
  o.vx*=.9; o.vy*=.9;
  constrain(o,minY,maxY);
  return true;
}
function updatePlayer(dt){
  if(updateKnockback(player,dt,CY+10,court.bottom-20))return;
  let dx=(input.right?1:0)-(input.left?1:0);
  let dy=(input.down?1:0)-(input.up?1:0);
  const d=Math.hypot(dx,dy)||1;
  const speed=(input.dash?320:185)*(charging?.58:1);
  player.x+=dx/d*speed*dt; player.y+=dy/d*speed*dt;
  constrain(player,CY+10,court.bottom-20);
  if(charging)charge=Math.min(1.25,charge+dt);
}
function updateCPU(dt){
  if(updateKnockback(cpu,dt,court.top+20,CY-10))return;
  cpu.cool-=dt;
  const target=ball.owner===cpu?{x:CX,y:court.bottom-35}:ball;
  const dx=target.x-cpu.x,dy=target.y-cpu.y,d=Math.hypot(dx,dy)||1;
  cpu.x+=dx/d*145*dt; cpu.y+=dy/d*145*dt;
  constrain(cpu,court.top+20,CY-10);
  if(ball.owner===cpu&&cpu.cool<=0){
    kick(cpu,(CX-cpu.x)*.4,1,9+Math.random()*2,Math.random()<.08);
    cpu.cool=.9;
  }
}
function updateKeepers(dt){
  keepers.forEach((k,i)=>{
    k.hold-=dt;
    const tx=clamp(ball.x,CX-goalW/2+25,CX+goalW/2-25);
    k.x+=clamp(tx-k.x,-180*dt,180*dt);
    if(ball.owner===k&&k.hold<=0){
      const mate=i===0?player:cpu;
      kick(k,mate.x-k.x,mate.y-k.y,7,false);
    }
  });
}
function knockDown(o,speed){
  if(o===player||o===cpu){
    const d=Math.hypot(ball.vx,ball.vy)||1;
    o.down=clamp(.45+speed*.025,.55,1.05);
    o.vx=ball.vx/d*(190+speed*8);
    o.vy=ball.vy/d*(190+speed*8);
    if(ball.owner===o)ball.owner=null;
  }
}
function collideActors(){
  if(ball.cool>0)return;
  const speed=Math.hypot(ball.vx,ball.vy);
  for(const o of [player,cpu,...keepers]){
    if(dist(ball,o)>ball.r+o.r+4)continue;

    if((o===player||o===cpu)&&speed>=10){
      knockDown(o,speed);
      ball.vx*=.65; ball.vy*=.65; ball.laser=false; ball.cool=.12;
      break;
    }

    if(ball.laser){
      ball.laser=false;
      const dx=ball.x-o.x,dy=ball.y-o.y,d=Math.hypot(dx,dy)||1;
      ball.vx=dx/d*10; ball.vy=dy/d*10; ball.cool=.12;
    }else if(keepers.includes(o)){
      attach(o); o.hold=.48;
    }else if(o.down<=0&&speed<8.5){
      attach(o);
    }else{
      const dx=ball.x-o.x,dy=ball.y-o.y,d=Math.hypot(dx,dy)||1;
      ball.vx=dx/d*6; ball.vy=dy/d*6; ball.cool=.1;
    }
    break;
  }
}
function updateBall(dt){
  if(ball.cool>0)ball.cool-=dt;
  if(ball.owner){
    const o=ball.owner,dir=o.team===0?-1:1;
    ball.x=o.x; ball.y=o.y+dir*(o.r+ball.r+4);
    return;
  }

  ball.x+=ball.vx; ball.y+=ball.vy;
  if(!ball.laser){ ball.vx*=.992; ball.vy*=.992; }

  for(const b of bumpers){
    b.a+=dt*14;
    if(b.moving){
      b.t+=dt;
      b.x=b.baseX+Math.sin(b.t*2.4)*170;
    }
    const dx=ball.x-b.x,dy=ball.y-b.y,d=Math.hypot(dx,dy)||1;
    if(d<b.r+ball.r){
      const speed=Math.max(ball.laser?17:9,Math.hypot(ball.vx,ball.vy)*1.22);
      const tangentX=-dy/d,tangentY=dx/d;
      ball.x=b.x+dx/d*(b.r+ball.r+1);
      ball.y=b.y+dy/d*(b.r+ball.r+1);
      ball.vx=dx/d*speed+tangentX*3.5;
      ball.vy=dy/d*speed+tangentY*3.5;
      ball.cool=.08;
    }
  }

  const b=boundsAtY(ball.y);
  if(ball.x-ball.r<b.min){ball.x=b.min+ball.r;ball.vx=Math.abs(ball.vx);}
  if(ball.x+ball.r>b.max){ball.x=b.max-ball.r;ball.vx=-Math.abs(ball.vx);}

  if(ball.y-ball.r<court.top){
    if(Math.abs(ball.x-CX)<goalW/2){score[0]++;resetBall(1);return;}
    ball.y=court.top+ball.r;ball.vy=Math.abs(ball.vy);
  }
  if(ball.y+ball.r>court.bottom){
    if(Math.abs(ball.x-CX)<goalW/2){score[1]++;resetBall(0);return;}
    ball.y=court.bottom-ball.r;ball.vy=-Math.abs(ball.vy);
  }

  collideActors();
}
function drawCourt(){
  ctx.beginPath();
  ctx.moveTo(court.left+court.cut,court.top);
  ctx.lineTo(court.right-court.cut,court.top);
  ctx.lineTo(court.right,CY);
  ctx.lineTo(court.right-court.cut,court.bottom);
  ctx.lineTo(court.left+court.cut,court.bottom);
  ctx.lineTo(court.left,CY);
  ctx.closePath();
  ctx.fillStyle="#1b5b49";ctx.fill();
  ctx.strokeStyle="#dff";ctx.lineWidth=4;ctx.stroke();

  ctx.beginPath();ctx.moveTo(court.left,CY);ctx.lineTo(court.right,CY);ctx.stroke();
  ctx.strokeRect(CX-goalW/2,court.top-30,goalW,30);
  ctx.strokeRect(CX-goalW/2,court.bottom,goalW,30);
}
function circle(o,color){
  ctx.fillStyle=color;ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.fill();
}
function drawBumper(b){
  ctx.save();
  ctx.translate(b.x,b.y);
  ctx.rotate(b.a);
  ctx.fillStyle=b.moving?"#f1c24f":"#b9b9b9";
  ctx.beginPath();ctx.arc(0,0,b.r,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="#6f6f6f";ctx.lineWidth=5;ctx.stroke();
  ctx.strokeStyle="#ff4fbf";ctx.lineWidth=5;
  for(let i=0;i<4;i++){
    ctx.rotate(Math.PI/2);
    ctx.beginPath();ctx.moveTo(5,0);ctx.lineTo(b.r-5,0);ctx.stroke();
  }
  ctx.restore();
}
function drawActor(o,color){
  ctx.save();
  ctx.translate(o.x,o.y);
  if(o.down>0)ctx.rotate(Math.PI/2);
  circle({x:0,y:0,r:o.r},color);
  if(o.down>0){
    ctx.fillStyle="#ffe66d";
    ctx.font="18px sans-serif";
    ctx.fillText("★",o.r,-o.r);
  }
  ctx.restore();
}
function draw(){
  ctx.clearRect(0,0,W,H);
  drawCourt();
  bumpers.forEach(drawBumper);
  circle(keepers[0],"#67aaff");
  circle(keepers[1],"#ff7777");
  drawActor(player,"#008cff");
  drawActor(cpu,"#ed174c");

  ctx.shadowBlur=ball.laser?30:0;
  ctx.shadowColor="#8fffff";
  circle(ball,ball.laser?"#9fffff":"gold");
  ctx.shadowBlur=0;

  document.getElementById("score").textContent=score[0]+" - "+score[1];
  document.getElementById("status").textContent=
    charging?(charge>=1.1?"LASER":charge>=.45?"POWER":"CHARGE"):"中央バンパー移動 / 高速球でダウン";
}
function loop(now){
  const dt=Math.min(.033,(now-last)/1000);
  last=now;
  updatePlayer(dt);
  updateCPU(dt);
  updateKeepers(dt);
  updateBall(dt);
  draw();
  requestAnimationFrame(loop);
}
resetBall(0);
requestAnimationFrame(loop);
