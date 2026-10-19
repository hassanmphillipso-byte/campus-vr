// Original campus training rules. Reference review and license records:
// docs/sports-open-source/README.md (MIT basketball / YUKA pursuit).
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const SPORTS_RULE_VERSION=2;
export const CHARGE_SECONDS=.95;
// Feedback observes the same moving ball as scoring; it never guesses from input power.
export class ShotEvidence {
  constructor(origin,hoop){this.origin={...origin};this.previous={...origin};this.hoop=hoop;this.cross=null;this.apex=origin.y;this.age=0;}
  update(p,dt){
    this.age+=dt;this.apex=Math.max(this.apex,p.y);
    if(this.hoop&&!this.cross)this.cross=planeCross(this.previous,p,'y',this.hoop.y,-1);
    this.previous={...p};
  }
  ended(p,r){return this.age>.35&&p.y<=r+.09||this.age>8||p.y<-.5;}
  message(shot={}){
    if(shot.touchedRim)return '碰到篮圈后弹出 · 保持力度，微调瞄准';
    if(shot.touchedBoard)return '碰到篮板后未进 · 微调瞄准再试';
    if(!this.hoop)return '未命中 · 看落点调整下一次出手';
    if(this.apex<this.hoop.y)return '球没有升到篮圈高度 · 抬高瞄准或增加力度';
    if(this.cross){
      const dx=this.hoop.x-this.origin.x,dz=this.hoop.z-this.origin.z,n=Math.hypot(dx,dz)||1;
      const ex=this.cross.x-this.hoop.x,ez=this.cross.z-this.hoop.z;
      const side=(-dz*ex+dx*ez)/n,along=(dx*ex+dz*ez)/n;
      if(Math.abs(side)>.3)return side>0?'落点偏右 · 向左微调瞄准':'落点偏左 · 向右微调瞄准';
      if(Math.abs(along)>.3)return along>0?'落点越过篮圈 · 稍减力度再试':'落点在篮圈前方 · 稍加力度再试';
    }
    return '未命中 · 看落点，微调后再试';
  }
}
export function planeCross(a,b,axis,plane,sign){
  if(!a||sign*(a[axis]-plane)>0||sign*(b[axis]-plane)<=0)return null;
  const f=(plane-a[axis])/(b[axis]-a[axis]);
  return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,z:a.z+(b.z-a.z)*f};
}
export function basketCross(a,b,hoop,radius=.12){
  const p=planeCross(a,b,'y',hoop.y,-1);
  return !!p&&Math.hypot(p.x-hoop.x,p.z-hoop.z)<=Math.max(.01,.23-radius+.015);
}
export function goalCross(a,b,{x=38,z=-31,width=7.32,height=2.44,sign=-1}={},radius=.11){
  const p=planeCross(a,b,'z',z+sign*radius,sign);
  return !!p&&Math.abs(p.x-x)+radius<width/2&&p.y-radius>=-.025&&p.y+radius<height;
}
export function ballisticVelocity(origin,target,angle,power=.64){
  const dx=target.x-origin.x,dz=target.z-origin.z,d=Math.max(.4,Math.hypot(dx,dz));
  const a=clamp(angle,.60,1.25),dy=target.y-origin.y;
  const speed=Math.sqrt(9.81*d*d/(2*Math.cos(a)**2*Math.max(.15,d*Math.tan(a)-dy)));
  const v=speed*(.68+.5*clamp(power,0,1));
  return {x:dx/d*v*Math.cos(a),y:v*Math.sin(a),z:dz/d*v*Math.cos(a)};
}
// Velocity extrapolation follows the pursuit principle in MIT YUKA.
// Here prediction time is the goal-plane intersection, not distance to an agent.
export function predictIntercept(p,v,z){
  const t=(z-p.z)/v.z;
  return Number.isFinite(t)&&t>0&&t<2.5?{x:p.x+v.x*t,y:p.y+v.y*t-4.905*t*t,t}:null;
}
export class RopeRound{
  constructor({rpm=80,duration=30}={}){Object.assign(this,{rpm,duration,time:0,phase:0,y:0,vy:0,count:0,misses:0,streak:0,best:0,perfect:0,freeze:0,done:false,last:'准备起跳'});}
  jump(){if(this.done||this.freeze>0||this.y>.005||this.vy>0)return false;this.lastJump=this.time;this.vy=4.5;return true;}
  update(dt){
    let left=Math.min(Math.max(0,dt),.1);
    while(left>1e-7&&!this.done){
      const h=Math.min(left,1/240,this.duration-this.time);left-=h;this.time+=h;
      if(this.y>0||this.vy>0){this.y=Math.max(0,this.y+this.vy*h-10*h*h);this.vy-=20*h;if(this.y===0)this.vy=0;}
      if(this.freeze>0){this.freeze=Math.max(0,this.freeze-h);}
      else{
        this.phase+=h*this.rpm/60;
        if(this.phase>=1){
          this.phase-=1;
          if(this.y>.14){this.count++;this.streak++;this.best=Math.max(this.best,this.streak);if(this.y>.35){this.perfect++;this.last='节奏准确';}else this.last='成功过绳';}
          else{this.misses++;this.streak=0;this.freeze=.8;this.phase=0;this.last=this.lastJump==null||this.time-this.lastJump>.8?'没有及时起跳 · 绳到脚前按一次':this.time-this.lastJump>.225?'起跳偏早 · 下次稍晚一点':'起跳偏晚 · 下次稍早一点';}
        }
      }
      if(this.time>=this.duration-1e-7){this.done=true;this.y=this.vy=0;}
    }
  }
}
