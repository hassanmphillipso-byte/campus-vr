export const CONSTRUCTION_KEY='campus.construction.v1';
export const FACILITIES=[
 {id:'classroom',name:'教室',detail:'北楼自习教室',cost:300,x:-64,z:-91,w:12,d:18,action:'study',accent:'#879cac'},
 {id:'gym',name:'体育馆',detail:'训练队与老师 · 体育训练',cost:600,x:44,z:-80,w:18,d:16,action:'training',accent:'#749994'},
 {id:'music',name:'音乐馆',detail:'钢琴合唱排练 · 节奏跟练',cost:500,x:45,z:-110,w:22,d:18,action:'music',accent:'#ac8870'},
 {id:'pool',name:'游泳馆',detail:'泳队热身更衣 · 通往主泳池',cost:800,facing:-1,x:-18,z:48,w:20,d:8,action:'swim',accent:'#75a8b4'},
 {id:'tennis',name:'网球馆',detail:'球场与器材空间',cost:450,x:62,z:99,w:18,d:28,action:'tennis',accent:'#789d82'},
 {id:'basketball',name:'篮球馆',detail:'训练与观赛扩建',cost:550,x:26,z:-78,w:10,d:18,action:'basketball',accent:'#ba9674'},
 // 第7馆·电影馆：西南草坪（食堂西侧空地，实测 0 静态墙/0 旧馆重叠），门朝南接 z=120 路带到南北主轴
 {id:'cinema',name:'电影馆',detail:'开放电影放映 · 三部开源大片',cost:650,action:'cinema',accent:'#6d5a86',x:-52,z:106,w:16,d:14},
].map(v=>({...v,bounds:{minX:v.x-v.w/2-.65,maxX:v.x+v.w/2+.65,minZ:v.z-v.d/2-.65,maxZ:v.z+v.d/2+.65},entry:{x:v.x,z:v.z+(v.facing||1)*(v.d/2+1.8)},interior:{x:v.x,z:v.z+(v.facing||1)*(v.d/2-2)}}));
// Programming rewards only; the 205 observation lesson does not mint stars.
export const TASK_IDS=['1-1','1-2','1-3','1-4','2-1','2-2','2-3','2-4','3-1','3-2','3-3','3-4','3-5'];
export const inBounds=(b,x,z,r=0)=>x>b.minX-r&&x<b.maxX+r&&z>b.minZ-r&&z<b.maxZ+r;
export function rewardRecords(save){const out={};for(const id of TASK_IDS){const stars=Number(save?.tasks?.[id]);if(!Number.isInteger(stars)||stars<1||stars>3)continue;for(let i=1;i<=stars;i++)out[`task:${id}:${i}`]={amount:i===1?100:50,source:id};}for(const lv of [1,2,3])if(save?.submitted?.[lv]===true)out[`submit:${lv}`]={amount:300,source:`exam-${lv}`};return out;}
export const earned=s=>Object.values(s.awards).reduce((n,a)=>n+a.amount,0);
export const spent=s=>Object.values(s.purchases).reduce((n,a)=>n+a.cost,0);
export const balance=s=>earned(s)-spent(s);

export const ROADS={classroom:[[-64,-80],[-64,-57]],gym:[[44,-71],[44,-57]],music:[[45,-100],[60,-100],[60,-57]],pool:[[-18,43],[-18,38]],tennis:[[62,114],[62,120],[-32,120],[-32,106]],basketball:[[26,-68],[26,-57]],cinema:[[-52,114.8],[-52,120],[-34,120],[-34,106]]/*→南北主轴 x=-32*/};
// Reserve actual foliage bounds, not just trunks: static vegetation is merged later.
export function landscapeConflicts(b){const overlap=(a,pad=0)=>b.maxX>a.minX-pad&&b.minX<a.maxX+pad&&b.maxZ>a.minZ-pad&&b.minZ<a.maxZ+pad;return FACILITIES.some(v=>overlap(v.bounds,.5)||ROADS[v.id].some((p,i,ps)=>i>0&&overlap({minX:Math.min(p[0],ps[i-1][0])-1.5,maxX:Math.max(p[0],ps[i-1][0])+1.5,minZ:Math.min(p[1],ps[i-1][1])-1.5,maxZ:Math.max(p[1],ps[i-1][1])+1.5})));}
