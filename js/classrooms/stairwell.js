import * as T from 'three';

// The teaching corridor is the upper landing; the campus door is one storey below.
export const STAIRWELL=Object.freeze({start:5.2,run:.3,rise:.17,steps:18,width:2.7,door:14.4});
export function stairGroundHeight(x,z){
 const s=STAIRWELL;
 if(z<=s.start)return 0;
 if(z>=s.start+s.run*s.steps)return -s.rise*s.steps;
 return -Math.min(s.steps,Math.floor((z-s.start)/s.run)+1)*s.rise;
}
export function corridorLocation(z){return z>10.6?'首层门厅':z>5.2?'下行楼梯':z>3.7?'楼梯入口':'教学走廊';}
export function stairDownwardTravel(fromZ,toZ){
 const s=STAIRWELL,end=s.start+s.run*s.steps;
 return Math.max(0,Math.min(end,toZ)-Math.max(s.start,fromZ))*s.rise/s.run;
}

export function buildExitStairwell({group,colliders,interactions,box,cyl,label,mat,m}){
 const s=STAIRWELL,bottom=-s.rise*s.steps,end=s.start+s.run*s.steps;
 const stone=mat('#c0c7be',.86),edge=mat('#7c8b7d',.7),frame=mat('#455b51',.28,.68);
 const glass=mat('#c7e0db',.16,.08);glass.transparent=true;glass.opacity=.2;glass.depthWrite=false;
 const safety=mat('#e1c283',.74),light=mat('#fff9df',.5);light.emissive.set('#fff1c9');light.emissiveIntensity=1.3;

 // A genuine opening replaces the previous solid end wall. Keep the guide nearby.
 for(const x of [-2.175,2.175])box(x,1.65,3.7,1.65,3.3,.18,m.wall,true);
 box(0,2.99,3.7,2.7,.62,.18,m.wall,true);
 for(const x of [-1.39,1.39])box(x,1.3,3.62,.085,2.6,.13,frame);
 box(0,2.62,3.62,2.86,.08,.13,frame);
 label('↓ 下楼 · 返回校园',0,2.99,3.59,2.45,.3,Math.PI,'#285a45','#f1f3df');
 label('教学区导览',-2.16,1.87,3.59,1.35,.25,Math.PI);
 label('楼下通往校园',2.16,1.87,3.59,1.35,.25,Math.PI);
 box(0,-.1,4.4,6,.2,1.6,m.white,true);
 for(const z of [3.97,4.47,4.97])box(0,.005,z,5.7,.008,.012,m.trim);
 // Tactile strip before the first descent; the stairs themselves have 18 solid treads.
 for(const z of [4.87,4.98,5.09])box(0,.012,z,2.55,.018,.045,safety);
 for(let i=0;i<s.steps;i++){
  const z=s.start+(i+.5)*s.run,top=-(i+1)*s.rise,h=top-bottom+.22;
  box(0,top-h/2,z,s.width,h,s.run,stone,true);
  box(0,top+.004,z,s.width,.008,s.run-.025,m.white);
  box(0,top+.012,z-s.run/2+.024,s.width,.018,.045,edge);
  for(const x of [-1.41,1.41])colliders.push({x,y:top+.6,z,w:.11,h:1.2,d:s.run});
 }
 // Slim posts, two continuous sloping rails, and enclosed landings prevent side falls.
 const angle=Math.atan(s.rise/s.run),railLength=Math.hypot(end-s.start,bottom);
 for(const x of [-1.35,1.35]){
  for(const height of [1.02,.53])box(x,height+bottom/2,(s.start+end)/2,.055,.055,railLength,frame).rotation.x=angle;
  for(let i=0;i<=s.steps;i+=3)cyl(x,-i*s.rise+.51,s.start+i*s.run,.022,1.02,frame);
  box(x,.56,4.45,.075,1.12,1.5,glass);
  box(x,1.02,4.45,.06,.06,1.5,frame);
  colliders.push({x,y:.6,z:4.45,w:.12,h:1.2,d:1.5});
 }

 // Daylit double-height stairwell. Window frames are separate from collision panes.
 const middle=(3.7+s.door)/2,length=s.door-3.7;
 box(-3,.15,middle,.18,6.42,length,m.wall,true);
 box(3,bottom+.5,middle,.18,1,length,m.trim,true);
 box(3,3.07,middle,.18,.58,length,m.wall,true);
 box(3,.2,middle,.025,4.97,length-.1,glass);
 colliders.push({x:3,y:.2,z:middle,w:.18,h:6.42,d:length});
 for(let z=3.78;z<s.door;z+=1.3)box(2.96,.25,z,.08,5.22,.06,frame);
 for(const y of [-2.04,.5,2.86])box(2.96,y,middle,.09,.065,length,frame);
 box(0,3.36,(3.6+end)/2,6,.18,end-3.6,m.wall,true);
 const ceilingY=.24;
 box(0,ceilingY,(end+s.door)/2,6,.18,s.door-end,m.wall,true);
 box(0,bottom-.1,(end+s.door)/2,6,.2,s.door-end,m.white,true);
 for(const z of [11.1,11.9,12.7,13.5])box(0,bottom+.007,z,5.7,.009,.012,m.trim);
 for(const x of [-2.88,2.88])box(x,bottom+.06,(end+s.door)/2,.06,.12,s.door-end,frame);
 for(const z of [4.4,8.1,12.5]){
  const y=z>10.6?ceilingY-.12:3.15;
  box(0,y,z,1.28,.04,.19,frame);box(0,y-.026,z,1.2,.012,.13,light);
  const fill=new T.PointLight('#fff1d8',8,7,2);fill.position.set(0,y-.1,z);group.add(fill);
 }
 // The glazed exit has a real door frame and handles. E pushes through to the campus.
 const doorY=bottom+1.2;
 for(const x of [-2.13,2.13])box(x,bottom+1.6,s.door,1.74,3.2,.18,m.wall,true);
 box(0,bottom+2.83,s.door,2.52,.74,.18,m.wall,true);
 for(const x of [-1.22,0,1.22])box(x,doorY,s.door-.045,.055,2.4,.1,frame);
 for(const y of [bottom+.035,bottom+2.4])box(0,y,s.door-.045,2.5,.06,.1,frame);
 box(0,doorY,s.door,2.4,2.36,.026,glass,true);
 for(const x of [-.13,.13])cyl(x,bottom+1.04,s.door-.095,.016,.35,frame);
 box(0,bottom+.92,s.door-.075,2.4,.075,.025,frame);
 label('校园出口  →',0,bottom+2.76,s.door-.12,2,.25,Math.PI,'#285a45','#f1f3df');
 label('↑ 返回教学区',-2.2,bottom+1.6,11.6,1.4,.22,Math.PI/2);
 label('学习进度自动保留',-2.13,bottom+1.55,s.door-.1,1.38,.18,Math.PI);
 box(0,bottom+.012,13.75,1.8,.02,.75,m.rubber);
 for(const x of [-2.35,2.35]){
  cyl(x,bottom+.23,13.45,.22,.46,mat('#c8b595'));
  for(let i=0;i<5;i++){
   const leaf=box(x+Math.sin(i)*.12,bottom+.75+i*.065,13.45+Math.cos(i)*.1,.13,.52,.025,m.green);
   leaf.rotation.z=Math.sin(i)*.45;
  }
 }
 // Landscaped light court visible through the stair windows and the ground-floor door.
 box(0,bottom-.15,17,9,.16,5,mat('#c8cbbb'));
 box(0,bottom-.24,17,1.9,.04,5,m.white);
 for(const x of [-3.5,3.5])box(x,bottom-.17,17,3,.1,4,mat('#8c9b78'));
 interactions.push({type:'campus',x:0,y:bottom,z:13.9,radius:1.2,label:'推门，回到校园室外'});
 return {groundHeight:stairGroundHeight,downwardTravel:stairDownwardTravel,location:position=>corridorLocation(position.z)};
}
