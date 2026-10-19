// blocked callbacks must include the controller radius (campus uses 0.45m).
// Shared movement geometry. Coordinates are metres; no render or physics state is owned here.
export const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export function clearSegment(a,b,blocked,spacing=.18){
 const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/spacing));
 for(let i=1;i<=n;i++)if(blocked(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n))return false;
 return true;
}
export function slideMove(position,dx,dz,blocked){
 const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15));dx/=n;dz/=n;
 for(let i=0;i<n;i++){
  if(!blocked(position.x+dx,position.z+dz)){position.x+=dx;position.z+=dz;continue;}
  if(!blocked(position.x+dx,position.z))position.x+=dx;
  if(!blocked(position.x,position.z+dz))position.z+=dz;
 }
}
// Bounded A*: only replan when a destination changes or a cached route is obstructed.
// Every edge, including diagonals and final smoothing, checks the whole segment.
export function findRoute(start,goal,blocked,{cell=.8,budget=1800,margin=7}={}){
 if(blocked(goal.x,goal.z))return [];
 if(clearSegment(start,goal,blocked))return [{...goal}];
 const minX=Math.min(start.x,goal.x)-margin,maxX=Math.max(start.x,goal.x)+margin;
 const minZ=Math.min(start.z,goal.z)-margin,maxZ=Math.max(start.z,goal.z)+margin;
 const key=(x,z)=>x+','+z,heuristic=p=>Math.hypot(p.x-goal.x,p.z-goal.z);
 const first={x:start.x,z:start.z,i:0,j:0,g:0,h:heuristic(start),parent:null};
 const open=[first],seen=new Map([[key(0,0),first]]),closed=new Set();let found=null;
 for(let count=0;open.length&&count<budget;count++){
  let best=0;for(let k=1;k<open.length;k++)if(open[k].g+open[k].h<open[best].g+open[best].h)best=k;
  const node=open.splice(best,1)[0],id=key(node.i,node.j);if(closed.has(id))continue;closed.add(id);
  if(node.h<cell*1.6&&clearSegment(node,goal,blocked)){found=node;break;}
  for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const i=node.i+di,j=node.j+dj,k=key(i,j);if(closed.has(k))continue;
   const p={x:start.x+i*cell,z:start.z+j*cell};
   if(p.x<minX||p.x>maxX||p.z<minZ||p.z>maxZ||!clearSegment(node,p,blocked))continue;
   const g=node.g+Math.hypot(di,dj)*cell,old=seen.get(k);if(old&&old.g<=g)continue;
   const next={...p,i,j,g,h:heuristic(p),parent:node};seen.set(k,next);open.push(next);
  }
 }
 if(!found)return [];
 const reverse=[{...goal}];for(let n=found;n?.parent;n=n.parent)reverse.push({x:n.x,z:n.z});reverse.reverse();
 const route=[];let anchor=start,index=0;
 while(index<reverse.length){let end=reverse.length-1;while(end>index&&!clearSegment(anchor,reverse[end],blocked))end--;route.push(reverse[end]);anchor=reverse[end];index=end+1;}
 return route;
}
export class CharacterNavigator{
 constructor(){this.path=[];this.goal=null;this.speed=0;this.plans=0;this.status='idle';}
 pause(){this.speed=0;}
 update(position,goal,yaw,dt,maxSpeed,blocked,player){
  dt=Math.max(0,Math.min(.05,dt));const distance=Math.hypot(goal.x-position.x,goal.z-position.z);
  if(distance<.18){this.speed=0;this.status='arrived';return {x:position.x,z:position.z,yaw,speed:0,status:this.status};}
  if(!this.goal||Math.hypot(goal.x-this.goal.x,goal.z-this.goal.z)>.6||!this.path.length||(this.path.length===1&&Math.hypot(this.path[0].x-position.x,this.path[0].z-position.z)<.12)||!clearSegment(position,this.path[0],blocked)){
   this.path=findRoute(position,goal,blocked);this.goal={...goal};this.plans++;
  }
  if(!this.path.length){this.speed=0;this.status='unreachable';return {x:position.x,z:position.z,yaw,speed:0,status:this.status};}
  while(this.path.length>1&&Math.hypot(this.path[0].x-position.x,this.path[0].z-position.z)<.001)this.path.shift();
  const target=this.path[0],dx=target.x-position.x,dz=target.z-position.z,d=Math.hypot(dx,dz);
  const wanted=Math.atan2(dx,dz),delta=angleDelta(wanted,yaw),turn=Math.max(-3.6*dt,Math.min(3.6*dt,delta));yaw+=turn;
  let desired=Math.min(maxSpeed,Math.sqrt(2*2.5*distance))*Math.max(0,Math.cos(angleDelta(wanted,yaw)));
  if(player){const px=player.x-position.x,pz=player.z-position.z,pd=Math.hypot(px,pz);if(pd<1.15&&px*dx+pz*dz>0)desired*=Math.max(0,(pd-.65)/.5);}
  this.speed+=Math.max(-4*dt,Math.min(2.5*dt,desired-this.speed));
  const amount=Math.min(d,this.speed*dt),next={x:position.x+dx/(d||1)*amount,z:position.z+dz/(d||1)*amount};
  if(!clearSegment(position,next,blocked)){this.path=[];this.speed=0;this.status='blocked';return {x:position.x,z:position.z,yaw,speed:0,status:this.status};}
  this.status=this.speed>.025?'walking':'turning';return {...next,yaw,speed:dt?amount/dt:0,status:this.status};
 }
}
