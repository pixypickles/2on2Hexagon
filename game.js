
const c=document.getElementById("game"),g=c.getContext("2d");
const W=c.width,H=c.height,CX=W/2,CY=H/2,goalW=170;
const court={top:50,bottom:H-50,left:120,right:W-120,cut:180};
const keys={},score=[0,0];
const player={x:CX,y:H-120,r:15,team:0};
const cpu={x:CX,y:120,r:15,team:1,cool:0};
const keepers=[{x:CX,y:H-68,r:17,team:0,hold:0},{x:CX,y:68,r:17,team:1,hold:0}];
const ball={x:CX,y:CY,vx:0,vy:0,r:8,owner:null,laser:false,cool:0};
const bumpers=[{x:CX,y:170,r:20},{x:CX,y:H-170,r:20}];
let charging=false,charge=0,last=performance.now();

c.focus();
c.addEventListener("pointerdown",()=>c.focus());

addEventListener("keydown",e=>{
  const q=e.key.toLowerCase();
  keys[q]=true;
  if(["w","a","s","d","k","l","arrowup","arrowdown","arrowleft","arrowright"].includes(q))e.preventDefault();
  if(q==="l"&&!charging){charging=true;charge=0;}
});
addEventListener("keyup",e=>{
  const q=e.key.toLowerCase();
  keys[q]=false;
  if(q==="l"&&charging){releaseShot();charging=false;charge=0;}
});

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

function boundsAtY(y){
  const {top,bottom,left,right,cut}=court,mid=(top+bottom)/2;
  if(y<=mid){
    const t=clamp((y-top)/(mid-top),0,1);
    return{min:left+cut*(1-t),max:right-cut*(1-t)};
  }
  const t=clamp((bottom-y)/(bottom-mid),0,1);
  return{min:left+cut*(1-t),max:right-cut*(1-t)};
}
function constrain(o,minY,maxY){
  o.y=clamp(o.y,minY,maxY);
  const b=boundsAtY(o.y);
  o.x=clamp(o.x,b.min+o.r,b.max-o.r);
}
function resetBall(){
  Object.assign(ball,{x:CX,y:CY,vx:0,vy:0,owner:null,laser:false,cool:.35});
  Object.assign(player,{x:CX,y:H-120});
  Object.assign(cpu,{x:CX,y:120});
}
function attachBall(o){
  ball.owner=o;ball.vx=ball.vy=0;ball.laser=false;ball.cool=.15;
}
function kick(o,dx,dy,power,laser=false){
  const d=Math.hypot(dx,dy)||1;
  ball.owner=null;
  ball.x=o.x+dx/d*(o.r+ball.r+3);
  ball.y=o.y+dy/d*(o.r+ball.r+3);
  ball.vx=dx/d*power;ball.vy=dy/d*power;
  ball.laser=laser;ball.cool=.12;
}
function releaseShot(){
  if(ball.owner!==player)return;
  const laser=charge>=1.2,power=laser?16:charge>=.5?11:7;
  kick(player,0,-1,power,laser);
}
function updatePlayer(dt){
  let dx=(keys.d?1:0)-(keys.a?1:0),dy=(keys.s?1:0)-(keys.w?1:0);
  const d=Math.hypot(dx,dy)||1;
  const speed=(keys.k?280:165)*(charging?.55:1);
  player.x+=dx/d*speed*dt;player.y+=dy/d*speed*dt;
  constrain(player,CY+20,court.bottom-18);
  if(charging)charge=Math.min(1.4,charge+dt);
}
function updateCPU(dt){
  cpu.cool-=dt;
  const target=ball.owner===cpu?{x:CX,y:court.bottom-35}:ball;
  let dx=target.x-cpu.x,dy=target.y-cpu.y,d=Math.hypot(dx,dy)||1;
  cpu.x+=dx/d*125*dt;cpu.y+=dy/d*125*dt;
  constrain(cpu,court.top+18,CY-20);
  if(ball.owner===cpu&&cpu.cool<=0){
    kick(cpu,(CX-cpu.x)*.5,1,8+Math.random()*2,Math.random()<.08);
    cpu.cool=1;
  }
}
function updateKeepers(dt){
  keepers.forEach((k,i)=>{
    k.hold-=dt;
    const targetX=clamp(ball.x,CX-goalW/2+20,CX+goalW/2-20);
    k.x+=clamp(targetX-k.x,-150*dt,150*dt);
    if(ball.owner===k&&k.hold<=0){
      const mate=i===0?player:cpu;
      kick(k,mate.x-k.x,mate.y-k.y,6,false);
    }
  });
}
function pickupAndCollide(){
  if(ball.cool>0)return;
  for(const o of [player,cpu,...keepers]){
    if(dist(ball,o)>o.r+ball.r+3)continue;
    if(ball.laser){
      ball.laser=false;
      const dx=ball.x-o.x,dy=ball.y-o.y,d=Math.hypot(dx,dy)||1;
      ball.vx=dx/d*8;ball.vy=dy/d*8;ball.cool=.12;
    }else if(keepers.includes(o)){
      attachBall(o);o.hold=.45;
    }else if(Math.hypot(ball.vx,ball.vy)<8){
      attachBall(o);
    }else{
      const dx=ball.x-o.x,dy=ball.y-o.y,d=Math.hypot(dx,dy)||1;
      ball.vx=dx/d*5;ball.vy=dy/d*5;ball.cool=.1;
    }
    break;
  }
}
function updateBall(dt){
  if(ball.cool>0)ball.cool-=dt;
  if(ball.owner){
    const o=ball.owner,dir=o.team===0?-1:1;
    ball.x=o.x;ball.y=o.y+dir*(o.r+ball.r+2);
    return;
  }
  ball.x+=ball.vx;ball.y+=ball.vy;
  if(!ball.laser){ball.vx*=.992;ball.vy*=.992}
  for(const b of bumpers){
    let dx=ball.x-b.x,dy=ball.y-b.y,d=Math.hypot(dx,dy)||1;
    if(d<b.r+ball.r){
      const sp=Math.max(ball.laser?14:7,Math.hypot(ball.vx,ball.vy));
      ball.x=b.x+dx/d*(b.r+ball.r+1);ball.y=b.y+dy/d*(b.r+ball.r+1);
      ball.vx=dx/d*sp;ball.vy=dy/d*sp;ball.cool=.08;
    }
  }
  const b=boundsAtY(ball.y);
  if(ball.x-ball.r<b.min){ball.x=b.min+ball.r;ball.vx=Math.abs(ball.vx)}
  if(ball.x+ball.r>b.max){ball.x=b.max-ball.r;ball.vx=-Math.abs(ball.vx)}
  if(ball.y-ball.r<court.top){
    if(Math.abs(ball.x-CX)<goalW/2){score[0]++;resetBall();return}
    ball.y=court.top+ball.r;ball.vy=Math.abs(ball.vy);
  }
  if(ball.y+ball.r>court.bottom){
    if(Math.abs(ball.x-CX)<goalW/2){score[1]++;resetBall();return}
    ball.y=court.bottom-ball.r;ball.vy=-Math.abs(ball.vy);
  }
  pickupAndCollide();
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
function circle(o,col){g.fillStyle=col;g.beginPath();g.arc(o.x,o.y,o.r,0,Math.PI*2);g.fill();}
function draw(){
  g.clearRect(0,0,W,H);drawCourt();
  bumpers.forEach(b=>{circle(b,"#bbb");g.strokeStyle="#666";g.stroke()});
  circle(keepers[0],"#67aaff");circle(keepers[1],"#ff7777");
  circle(player,"#009dff");circle(cpu,"#ef003d");
  g.shadowBlur=ball.laser?24:0;g.shadowColor="#7fffff";
  circle(ball,ball.laser?"#9fffff":"gold");g.shadowBlur=0;
  scoreEl.textContent=score[0]+" - "+score[1];
  messageEl.textContent=charging?(charge>=1.2?"LASER":charge>=.5?"POWER":"CHARGE"):"WASD 移動 / K ダッシュ / L シュート";
}
const scoreEl=document.getElementById("score"),messageEl=document.getElementById("message");
function loop(now){
  const dt=Math.min(.033,(now-last)/1000);last=now;
  updatePlayer(dt);updateCPU(dt);updateKeepers(dt);updateBall(dt);draw();
  requestAnimationFrame(loop);
}
resetBall();requestAnimationFrame(loop);
