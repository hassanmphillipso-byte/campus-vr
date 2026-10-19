import {targetsActor,loopPulses} from './adventure_data.js';

export const SHAPES=[[[0,0],[1,0],[2,0],[3,0]],[[0,0],[1,0],[0,1],[1,1]],[[0,0],[1,0],[2,0],[1,1]],[[0,0],[1,0],[2,0],[2,1]]];
export function newBlocks(){return {grid:Array.from({length:12},()=>Array(12).fill(0)),index:0,x:4,y:11,cells:SHAPES[0].map(p=>p.slice()),answers:[],lines:0,clock:0};}
export function fits(s,cells=s.cells,x=s.x,y=s.y){return cells.every(([dx,dy])=>x+dx>=0&&x+dx<12&&y+dy>=0&&y+dy<12&&!s.grid[y+dy][x+dx]);}
export function landingY(s){let y=s.y;while(fits(s,s.cells,s.x,y-1))y--;return y;}
export function moveBlock(s,dx){if(fits(s,s.cells,s.x+dx,s.y)){s.x+=dx;return true;}return false;}
export function rotateBlock(s){
  const turned=s.cells.map(([x,y])=>[-y,x]),minX=Math.min(...turned.map(p=>p[0])),minY=Math.min(...turned.map(p=>p[1])),cells=turned.map(([x,y])=>[x-minX,y-minY]);
  for(const dy of [0,-1,-2,-3,1,2])for(const dx of [0,-1,1,-2,2])if(fits(s,cells,s.x+dx,s.y+dy)){s.cells=cells;s.x+=dx;s.y+=dy;return true;}return false;
}
export function tickBlocks(s,dt){s.clock+=dt;if(s.clock>.6){s.clock=0;if(fits(s,s.cells,s.x,s.y-1))s.y--;}}
export function dropBlock(s,question){
  if(s.index>=4)return {accepted:false};
  const lanes=new Set(s.cells.map(([x])=>Math.floor((s.x+x)/4)));
  if(lanes.size!==1)return {accepted:false,reason:'把整块放进同一条仓道，再落下。'};
  if(!fits(s))return {accepted:false,reason:'这里放不下，换个位置或旋转。'};
  const lane=[...lanes][0];s.y=landingY(s);
  for(const [x,y] of s.cells)s.grid[s.y+y][s.x+x]=s.index+1;
  const cleared=[];
  // Each four-cell dock clears its own full rows, retaining the other docks.
  for(let d=0;d<3;d++){
    const rows=s.grid.map(row=>row.slice(d*4,d*4+4)).filter((row,y)=>{if(row.every(Boolean)){cleared.push([d,y]);return false;}return true;});
    while(rows.length<12)rows.push([0,0,0,0]);
    rows.forEach((row,y)=>row.forEach((v,x)=>s.grid[y][d*4+x]=v));
  }
  s.lines+=cleared.length;
  const answer={code:question.code,picked:question.lanes[lane],expected:question.value,pass:question.lanes[lane]===question.value,lane,cleared:cleared.length};
  s.answers.push(answer);s.index++;s.clock=0;
  if(s.index<4){s.cells=SHAPES[s.index].map(p=>p.slice());s.x=4;s.y=12-Math.max(...s.cells.map(p=>p[1]))-1;}
  return {accepted:true,answer,done:s.index===4,cleared};
}
// Tier-one assist: the learner chooses a lane; the same landing and scoring
// rules still record that choice. Never select a lane from question.value.
export function dropBlockInLane(s,question,lane){
  if(!Number.isInteger(lane)||lane<0||lane>2||s.index>=4)return {accepted:false,reason:'请选择一个数字仓道。'};
  const width=Math.max(...s.cells.map(p=>p[0]))+1,height=Math.max(...s.cells.map(p=>p[1]))+1;
  for(let offset=0;offset<=4-width;offset++){
    const x=lane*4+offset,y=12-height;
    if(fits(s,s.cells,x,y)){s.x=x;s.y=y;s.clock=0;return dropBlock(s,question);}
  }
  return {accepted:false,reason:'这条仓道暂时放不下，请旋转方块再试。'};
}
export function newFlight(task,config){return {time:0,spawned:0,player:{x:0,y:13},actors:[],bullets:[],enemyShots:[],effects:[],cooldown:0,hostileClock:0,hits:0,friendlyHits:0,blocked:0,damage:0,recover:0,config:structuredClone(config),done:false,pulse:task.lv===3?loopPulses(config):null};}
const distanceSegment=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
export function tickFlight(s,task,dt,input={x:0,y:0}){
  if(s.done)return;dt=Math.min(.05,Math.max(0,dt));s.time+=dt;s.recover=Math.max(0,s.recover-dt);
  s.effects??=[];s.effects=s.effects.filter(fx=>(fx.age+=dt)<.55);
  s.player.x=Math.max(-4.6,Math.min(4.6,s.player.x+(input.x||0)*7*dt));s.player.y=Math.max(7,Math.min(14,s.player.y+(input.y||0)*7*dt));
  while(s.spawned<task.actors.length&&task.actors[s.spawned].at<=s.time){const a=task.actors[s.spawned++];s.actors.push({...a,y:-1,shots:0,alive:true});}
  for(const a of s.actors)if(a.alive){a.y+=1.05*dt;if(a.y>17)a.alive=false;}
  s.cooldown-=dt;
  const eligible=s.actors.filter(a=>a.alive&&a.y<s.player.y-.6&&targetsActor(task,s.config,a)&&(task.lv!==3||a.shots<s.pulse.count));
  if(s.cooldown<=0&&eligible.length){
    const a=eligible.sort((a,b)=>Math.hypot(a.x-s.player.x,a.y-s.player.y)-Math.hypot(b.x-s.player.x,b.y-s.player.y))[0];
    const dx=a.x-s.player.x,dy=a.y-s.player.y,len=Math.hypot(dx,dy);a.shots++;
    s.bullets.push({x:s.player.x,y:s.player.y-.5,vx:dx/len*17,vy:dy/len*17,target:a.id});s.cooldown=.22;
  }
  for(const b of s.bullets){
    const a=s.actors.find(a=>a.id===b.target&&a.alive);if(!a){b.dead=true;continue;}
    // Guided pulses only couple to the locked target; incidental crossings do not
    // turn a correct logical rule into a transport strike.
    const dx=a.x-b.x,dy=a.y-b.y,len=Math.hypot(dx,dy)||1,prev={x:b.x,y:b.y};b.x+=dx/len*17*dt;b.y+=dy/len*17*dt;
    if(distanceSegment(a,prev,b)<=.58){
      b.dead=true;if(a.shield){s.blocked++;}else{a.hp--;if(a.hp<=0){a.alive=false;s.effects.push({x:a.x,y:a.y,age:0});if(a.kind==='enemy')s.hits++;else s.friendlyHits++;}}
    }
  }
  s.bullets=s.bullets.filter(b=>!b.dead&&b.y>-3&&b.y<18&&Math.abs(b.x)<8);
  s.hostileClock+=dt;
  if(s.hostileClock>1.6){s.hostileClock=0;for(const a of s.actors.filter(a=>a.alive&&a.kind==='enemy'))s.enemyShots.push({x:a.x,y:a.y+.6});}
  for(const b of s.enemyShots){const prev={x:b.x,y:b.y};b.y+=5*dt;if(distanceSegment(s.player,prev,b)<.5){b.dead=true;if(s.recover<=0){s.damage++;s.recover=1.4;}}}
  s.enemyShots=s.enemyShots.filter(b=>!b.dead&&b.y<17);
  // Never skip future waves: finish only after every actor has spawned and exited.
  if(s.time>=task.duration||(s.spawned===task.actors.length&&!s.actors.some(a=>a.alive&&targetsActor(task,s.config,a))&&!s.bullets.length)){s.done=true;s.endReason=s.time>=task.duration?'time-limit':'selected-waves-cleared';}
}
