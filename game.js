
const c=game=document.getElementById('game'),x=c.getContext('2d');
const W=c.width,H=c.height,CX=W/2,CY=H/2,R=180;
let k={},ball={x:CX,y:CY,vx:0,vy:0},p={x:CX,y:H-120},cpu={x:CX,y:120};
onkeydown=e=>k[e.key.toLowerCase()]=1;
onkeyup=e=>k[e.key.toLowerCase()]=0;
function hex(){
 x.beginPath();
 for(let i=0;i<6;i++){
  let a=Math.PI/6+i*Math.PI/3;
  let X=CX+Math.cos(a)*R*2,Y=CY+Math.sin(a)*R;
  i?x.lineTo(X,Y):x.moveTo(X,Y);
 }
 x.closePath();x.strokeStyle="#fff";x.lineWidth=3;x.stroke();
}
function loop(){
 requestAnimationFrame(loop);
 let s=(k["k"]?4:2);
 if(k["w"])p.y-=s;if(k["s"])p.y+=s;if(k["a"])p.x-=s;if(k["d"])p.x+=s;
 let dx=ball.x-cpu.x,dy=ball.y-cpu.y,d=Math.hypot(dx,dy)||1;
 cpu.x+=dx/d*1.6;cpu.y+=dy/d*1.6;
 if(k["l"]){
   let vx=ball.x-p.x,vy=ball.y-p.y,d=Math.hypot(vx,vy);
   if(d<28){ball.vx=0;ball.vy=-8;}
 }
 ball.x+=ball.vx;ball.y+=ball.vy;
 ball.vx*=0.99;ball.vy*=0.99;
 x.clearRect(0,0,W,H);
 hex();
 x.fillStyle="gold";x.beginPath();x.arc(ball.x,ball.y,8,0,7);x.fill();
 x.fillStyle="dodgerblue";x.beginPath();x.arc(p.x,p.y,14,0,7);x.fill();
 x.fillStyle="crimson";x.beginPath();x.arc(cpu.x,cpu.y,14,0,7);x.fill();
}
loop();
