
const c=document.getElementById("game"),g=c.getContext("2d");
const W=c.width,H=c.height,CX=W/2,CY=H/2;
const keys={},score=[0,0],goalW=180;
const player={x:CX,y:H-95,r:15};
const cpu={x:CX,y:95,r:15,shot:0};
const keepers=[{x:CX,y:H-35,r:16},{x:CX,y:35,r:16}];
const ball={x:CX,y:CY,vx:0,vy:0,r:8,laser:false,owner:null};
const bumpers=[{x:CX,y:160,r:18},{x:CX,y:H-160,r:18}];
let charging=false,charge=0,last=performance.now();

onkeydown=e=>{
  const q=e.key.toLowerCase(); keys[q]=1;
  if(q==="l"&&!charging){charging=true;charge=0;}
};
onkeyup=e=>{
  const q=e.key.toLowerCase(); keys[q]=0;
  if(q==="l"&&charging){shoot(player,-1,charge);charging=false;charge=0;}
};

function hexBounds(y){
  const top=50,bottom=H-50,left=120,right=W-120,cut=180,mid=H/2;
  if(y<=mid){const t=(y-top)/(mid-top);return{min:left+cut*(1-t),max:right-cut*(1-t)}}
  const t=(bottom-y)/(bottom-mid);return{min:left+cut*(1-t),max:right-cut*(1-t)}
}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function resetBall(){ball.x=CX;ball.y=CY;ball.vx=ball.vy=0;ball.laser=false;ball.owner=null}
function shoot(p,dir,level){
  if(Math.hypot(ball.x-p.x,ball.y-p.y)>38)return;
  const power=level>=1.2?16:level>=.5?11:7;
  ball.vx=0; ball.vy=dir*power; ball.laser=level>=1.2; ball.owner=null;
}
function movePlayer(dt){
  let dx=(keys.d?1:0)-(keys.a?1:0),dy=(keys.s?1:0)-(keys.w?1:0);
  const d=Math.hypot(dx,dy)||1,s=(keys.k?260:150)*dt;
  player.x+=dx/d*s; player.y+=dy/d*s;
  player.y=clamp(player.y,CY+20,H-55);
  const b=hexBounds(player.y); player.x=clamp(player.x,b.min+player.r,b.max-player.r);
  if(charging)charge=Math.min(1.4,charge+dt);
}
function moveCPU(dt){
  const target=ball.owner===cpu?{x:CX,y:H-60}:ball;
  let dx=target.x-cpu.x,dy=target.y-cpu.y,d=Math.hypot(dx,dy)||1;
  cpu.x+=dx/d*115*dt; cpu.y+=dy/d*115*dt;
  cpu.y=clamp(cpu.y,55,CY-20);
  const b=hexBounds(cpu.y);cpu.x=clamp(cpu.x,b.min+cpu.r,b.max-cpu.r);
  cpu.shot-=dt;
  if(Math.hypot(ball.x-cpu.x,ball.y-cpu.y)<34&&cpu.shot<=0){
    ball.vx=0;ball.vy=7+Math.random()*3;ball.laser=Math.random()<.12;cpu.shot=1;
  }
}
function moveKeepers(dt){
  keepers[0].x+=clamp(ball.x-keepers[0].x,-120*dt,120*dt);
  keepers[1].x+=clamp(ball.x-keepers[1].x,-120*dt,120*dt);
  keepers.forEach((k,i)=>{
    k.x=clamp(k.x,CX-goalW/2+20,CX+goalW/2-20);
    if(Math.hypot(ball.x-k.x,ball.y-k.y)<k.r+ball.r+3){
      if(ball.laser){ball.laser=false;ball.vy*=-.55;ball.vx+=(ball.x-k.x)*.25}
      else{ball.vy*=-.75;ball.vx+=(ball.x-k.x)*.18}
    }
  });
}
function physics(){
  ball.x+=ball.vx;ball.y+=ball.vy;
  if(!ball.laser){ball.vx*=.992;ball.vy*=.992}
  bumpers.forEach(b=>{
    let dx=ball.x-b.x,dy=ball.y-b.y,d=Math.hypot(dx,dy)||1;
    if(d<b.r+ball.r){
      const sp=Math.max(7,Math.hypot(ball.vx,ball.vy));
      ball.x=b.x+dx/d*(b.r+ball.r+1);ball.y=b.y+dy/d*(b.r+ball.r+1);
      ball.vx=dx/d*sp;ball.vy=dy/d*sp;
    }
  });
  const top=50,bottom=H-50,b=hexBounds(ball.y);
  if(ball.x-ball.r<b.min){ball.x=b.min+ball.r;ball.vx=Math.abs(ball.vx)}
  if(ball.x+ball.r>b.max){ball.x=b.max-ball.r;ball.vx=-Math.abs(ball.vx)}
  if(ball.y-ball.r<top){
    if(Math.abs(ball.x-CX)<goalW/2){score[0]++;resetBall()}
    else{ball.y=top+ball.r;ball.vy=Math.abs(ball.vy)}
  }
  if(ball.y+ball.r>bottom){
    if(Math.abs(ball.x-CX)<goalW/2){score[1]++;resetBall()}
    else{ball.y=bottom-ball.r;ball.vy=-Math.abs(ball.vy)}
  }
}
function drawCourt(){
  g.beginPath();g.moveTo(300,50);g.lineTo(660,50);g.lineTo(840,270);g.lineTo(660,490);g.lineTo(300,490);g.lineTo(120,270);g.closePath();
  g.fillStyle="#1b5b49";g.fill();g.strokeStyle="#dff";g.lineWidth=4;g.stroke();
  g.beginPath();g.moveTo(120,CY);g.lineTo(840,CY);g.stroke();
  g.strokeRect(CX-goalW/2,20,goalW,30);g.strokeRect(CX-goalW/2,H-50,goalW,30);
}
function circle(o,col){
  g.fillStyle=col;g.beginPath();g.arc(o.x,o.y,o.r,0,Math.PI*2);g.fill();
}
function draw(){
  g.clearRect(0,0,W,H);drawCourt();
  bumpers.forEach(b=>{circle(b,"#bbb");g.strokeStyle="#666";g.stroke()});
  circle(keepers[0],"#7fb5ff");circle(keepers[1],"#ff8d8d");
  circle(player,"dodgerblue");circle(cpu,"crimson");
  g.shadowBlur=ball.laser?24:0;g.shadowColor="#7fffff";circle(ball,ball.laser?"#9fffff":"gold");g.shadowBlur=0;
  document.getElementById("score").textContent=score[0]+" - "+score[1];
  document.getElementById("charge").textContent=charging?(charge>=1.2?"LASER":charge>=.5?"POWER":"CHARGE"):"";
}
function loop(now){
  const dt=Math.min(.033,(now-last)/1000);last=now;
  movePlayer(dt);moveCPU(dt);moveKeepers(dt);physics();draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
