
const c=document.getElementById("game"),g=c.getContext("2d");
const W=c.width,H=c.height,CX=W/2,CY=H/2;
const court={top:55,bottom:H-55,left:110,right:W-110,cut:185},goalW=180;
const keys={up:false,down:false,left:false,right:false,dash:false,shoot:false};
const score=[0,0];
const player={x:CX,y:H-125,r:16,team:0};
const cpu={x:CX,y:125,r:16,team:1,think:0};
const keepers=[{x:CX,y:H-78,r:18,team:0,hold:0},{x:CX,y:78,r:18,team:1,hold:0}];
const ball={x:CX,y:CY,vx:0,vy:0,r:9,owner:null,laser:false,cool:0};
const bumpers=[{x:CX,y:175,r:23},{x:CX,y:H-175,r:23}];
let charging=false,charge=0,last=performance.now();

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

function boundsAtY(y){
  const mid=CY;
  if(y<=mid){
    const t=clamp((y-court.top)/(mid-court.top),0,1);
    return {min:court.left+court.cut*(1-t),max:court.right-court.cut*(1-t)};
  }
  const t=clamp((court.bottom-y)/(court.bottom-mid),0,1);
  return {min:court.left+court.cut*(1-t),max:court.right-court.cut*(1-t)};
}
function constrain(o,minY,maxY){
  o.y=clamp(o.y,minY,maxY);
  const b=boundsAtY(o.y);
  o.x=clamp(o.x,b.min+o.r,b.max-o.r);
}
function resetBall(team=-1){
  ball.owner=null;ball.laser=false;ball.vx=ball.vy=0;ball.cool=.35;
  ball.x=CX;ball.y=CY;
  player.x=CX;player.y=H-125;cpu.x=CX;cpu.y=125;
  if(team===0)attach(player);
  if(team===1)attach(cpu);
}
function attach(o){
  ball.owner=o;ball.vx=ball.vy=0;ball.laser=false;ball.cool=.18;
}
function kick(o,dx,dy,power,laser=false){
  const d=Math.hypot(dx,dy)||1;
  ball.owner=null;
  ball.x=o.x+dx/d*(o.r+ball.r+4);
  ball.y=o.y+dy/d*(o.r+ball.r+4);
  ball.vx=dx/d*power;ball.vy=dy/d*power;
  ball.laser=laser;ball.cool=.14;
}
function releaseShot(){
  if(ball.owner!==player)return;
  const laser=charge>=1.15;
  const power=laser?18:charge>=.5?12:8;
  kick(player,0,-1,power,laser);
}
function startShoot(){if(!charging){charging=true;charge=0}}
function stopShoot(){if(charging){releaseShot();charging=false;charge=0}}

addEventListener("keydown",e=>{
  const q=e.key.toLowerCase();
  if(q==="w")keys.up=true;if(q==="s")keys.down=true;if(q==="a")keys.left=true;if(q==="d")keys.right=true;
  if(q==="k")keys.dash=true;if(q==="l")startShoot();
});
addEventListener("keyup",e=>{
  const q=e.key.toLowerCase();
  if(q==="w")keys.up=false;if(q==="s")keys.down=false;if(q==="a")keys.left=false;if(q==="d")keys.right=false;
  if(q==="k")keys.dash=false;if(q==="l")stopShoot();
});

function bindHold(el,on,off){
  const down=e=>{e.preventDefault();el.classList.add("active");on()};
  const up=e=>{e.preventDefault();el.classList.remove("active");off()};
  el.addEventListener("pointerdown",down);
  el.addEventListener("pointerup",up);
  el.addEventListener("pointercancel",up);
  el.addEventListener("pointerleave",e=>{if(e.buttons)up(e)});
}
document.querySelectorAll("[data-dir]").forEach(b=>{
  const d=b.dataset.dir;bindHold(b,()=>keys[d]=true,()=>keys[d]=false);
});
bindHold(document.getElementById("dash"),()=>keys.dash=true,()=>keys.dash=false);
bindHold(document.getElementById("shoot"),startShoot,stopShoot);

function updatePlayer(dt){
  let dx=(keys.right?1:0)-(keys.left?1:0),dy=(keys.down?1:0)-(keys.up?1:0);
  const d=Math.hypot(dx,dy)||1;
  const speed=(keys.dash?300:175)*(charging?.55:1);
  player.x+=dx/d*speed*dt;player.y+=dy/d*speed*dt;
  constrain(player,CY+15,court.bottom-18);
  if(charging)charge=Math.min(1.3,charge+dt);
}
function updateCPU(dt){
  cpu.think-=dt;
  let tx=ball.x,ty=ball.y;
  if(ball.owner===cpu){tx=CX;ty=court.bottom-35}
  const dx=tx-cpu.x,dy=ty-cpu.y,d=Math.hypot(dx,dy)||1;
  cpu.x+=dx/d*135*dt;cpu.y+=dy/d*135*dt;
  constrain(cpu,court.top+18,CY-15);
  if(ball.owner===cpu&&cpu.think<=0){
    kick(cpu,(CX-cpu.x)*.45,1,9+Math.random()*2,Math.random()<.08);
    cpu.think=.8;
  }
}
function updateKeepers(dt){
  keepers.forEach((k,i)=>{
    k.hold-=dt;
    const target=clamp(ball.x,CX-goalW/2+20,CX+goalW/2-20);
    k.x+=clamp(target-k.x,-170*dt,170*dt);
    if(ball.owner===k&&k.hold<=0){
      const mate=i===0?player:cpu;
      kick(k,mate.x-k.x,mate.y-k.y,7,false);
    }
  });
}
function collisions(){
  if(ball.cool>0)return;
  for(const o of [player,cpu,...keepers]){
    if(distance(ball,o)>ball.r+o.r+4)continue;
    if(ball.laser){
      ball.laser=false;
      const dx=ball.x-o.x,dy=ball.y-o.y,d=Math.hypot(dx,dy)||1;
      ball.vx=dx/d*9;ball.vy=dy/d*9;ball.cool=.12;
    }else if(keepers.includes(o)){
      attach(o);o.hold=.5;
    }else if(Math.hypot(ball.vx,ball.vy)<7.5){
      attach(o);
    }else{
      const dx=ball.x-o.x,dy=ball.y-o.y,d=Math.hypot(dx,dy)||1;
      ball.vx=dx/d*5.5;ball.vy=dy/d*5.5;ball.cool=.1;
    }
    break;
  }
}
function updateBall(){
  if(ball.cool>0)ball.cool-=1/60;
  if(ball.owner){
    const o=ball.owner,dir=o.team===0?-1:1;
    ball.x=o.x;ball.y=o.y+dir*(o.r+ball.r+3);
    return;
  }
  ball.x+=ball.vx;ball.y+=ball.vy;
  if(!ball.laser){ball.vx*=.991;ball.vy*=.991}
  for(const b of bumpers){
    let dx=ball.x-b.x,dy=ball.y-b.y,d=Math.hypot(dx,dy)||1;
    if(d<b.r+ball.r){
      const sp=Math.max(ball.laser?15:7.5,Math.hypot(ball.vx,ball.vy));
      ball.x=b.x+dx/d*(b.r+ball.r+1);ball.y=b.y+dy/d*(b.r+ball.r+1);
      ball.vx=dx/d*sp;ball.vy=dy/d*sp;ball.cool=.08;
    }
  }
  const b=boundsAtY(ball.y);
  if(ball.x-ball.r<b.min){ball.x=b.min+ball.r;ball.vx=Math.abs(ball.vx)}
  if(ball.x+ball.r>b.max){ball.x=b.max-ball.r;ball.vx=-Math.abs(ball.vx)}
  if(ball.y-ball.r<court.top){
    if(Math.abs(ball.x-CX)<goalW/2){score[0]++;resetBall(1);return}
    ball.y=court.top+ball.r;ball.vy=Math.abs(ball.vy);
  }
  if(ball.y+ball.r>court.bottom){
    if(Math.abs(ball.x-CX)<goalW/2){score[1]++;resetBall(0);return}
    ball.y=court.bottom-ball.r;ball.vy=-Math.abs(ball.vy);
  }
  collisions();
}
function drawCourt(){
  g.beginPath();
  g.moveTo(court.left+court.cut,court.top);g.lineTo(court.right-court.cut,court.top);
  g.lineTo(court.right,CY);g.lineTo(court.right-court.cut,court.bottom);
  g.lineTo(court.left+court.cut,court.bottom);g.lineTo(court.left,CY);g.closePath();
  g.fillStyle="#1b5b49";g.fill();g.strokeStyle="#dff";g.lineWidth=4;g.stroke();
  g.beginPath();g.moveTo(court.left,CY);g.lineTo(court.right,CY);g.stroke();
  g.strokeRect(CX-goalW/2,court.top-30,goalW,30);
  g.strokeRect(CX-goalW/2,court.bottom,goalW,30);
}
function circle(o,color){
  g.fillStyle=color;g.beginPath();g.arc(o.x,o.y,o.r,0,Math.PI*2);g.fill();
}
function draw(){
  g.clearRect(0,0,W,H);drawCourt();
  bumpers.forEach(b=>{circle(b,"#bbb");g.strokeStyle="#666";g.lineWidth=4;g.stroke()});
  circle(keepers[0],"#69aaff");circle(keepers[1],"#ff7777");
  circle(player,"#008cff");circle(cpu,"#ed174c");
  g.shadowBlur=ball.laser?28:0;g.shadowColor="#8fffff";
  circle(ball,ball.laser?"#9fffff":"gold");g.shadowBlur=0;
  document.getElementById("score").textContent=score[0]+" - "+score[1];
  document.getElementById("status").textContent=charging?(charge>=1.15?"LASER":charge>=.5?"POWER":"CHARGE"):"WASD / 画面ボタン";
}
function loop(now){
  const dt=Math.min(.033,(now-last)/1000);last=now;
  updatePlayer(dt);updateCPU(dt);updateKeepers(dt);updateBall();draw();
  requestAnimationFrame(loop);
}
resetBall(0);
requestAnimationFrame(loop);
