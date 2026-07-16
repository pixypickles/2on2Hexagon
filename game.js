
const c=document.getElementById("game"),g=c.getContext("2d");
const W=c.width,H=c.height,CX=W/2,CY=H/2;
const p={x:CX,y:H-80},cpu={x:CX,y:80},gk1={x:CX,y:H-25},gk2={x:CX,y:25};
const ball={x:CX,y:CY,vx:0,vy:0};
const bump=[{x:CX,y:150},{x:CX,y:H-150}];
const k={};onkeydown=e=>k[e.key.toLowerCase()]=1;onkeyup=e=>k[e.key.toLowerCase()]=0;
let score=[0,0];
function drawHex(){g.beginPath();for(let i=0;i<6;i++){let a=Math.PI/6+i*Math.PI/3;let x=CX+Math.cos(a)*320,y=CY+Math.sin(a)*220;i?g.lineTo(x,y):g.moveTo(x,y)}g.closePath();g.strokeStyle="#fff";g.stroke();}
function circ(o,r,col){g.fillStyle=col;g.beginPath();g.arc(o.x,o.y,r,0,7);g.fill();}
(function loop(){
 requestAnimationFrame(loop);
 let s=k.k?4:2;
 if(k.w)p.y-=s;if(k.s)p.y+=s;if(k.a)p.x-=s;if(k.d)p.x+=s;
 let d=Math.hypot(ball.x-cpu.x,ball.y-cpu.y)||1;
 cpu.x+=(ball.x-cpu.x)/d*1.6; cpu.y+=(ball.y-cpu.y)/d*1.6;
 if(k.l&&Math.hypot(ball.x-p.x,ball.y-p.y)<25){ball.vx=0;ball.vy=-8;}
 ball.x+=ball.vx; ball.y+=ball.vy; ball.vx*=.99; ball.vy*=.99;
 bump.forEach(b=>{let dx=ball.x-b.x,dy=ball.y-b.y,d=Math.hypot(dx,dy);if(d<18){ball.vx=dx/d*6;ball.vy=dy/d*6;}});
 if(ball.y<15){score[0]++;ball.x=CX;ball.y=CY;ball.vx=ball.vy=0;}
 if(ball.y>H-15){score[1]++;ball.x=CX;ball.y=CY;ball.vx=ball.vy=0;}
 document.getElementById("hud").textContent=score[0]+" - "+score[1];
 g.clearRect(0,0,W,H);drawHex();
 circ(gk1,12,"#88f");circ(gk2,12,"#f88");
 bump.forEach(b=>circ(b,10,"#bbb"));
 circ(cpu,14,"crimson");circ(p,14,"dodgerblue");circ(ball,8,"gold");
})();
