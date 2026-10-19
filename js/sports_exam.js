import {assertSaveCurrent} from './save_session.js';
// Shared local training records. These are learning records, not anti-cheat credentials.
export const EXAM_SPORTS = {
  1: {name:'跑步',title:'运动测算实验室',targets:[30,60,100],unit:'米',verb:'跑',lesson:'听到发令后出发，沿跑道正向前进。用 Shift 调节跑速，留意体力。平均速度 = 路程 ÷ 用时。'},
  2: {name:'篮球',title:'篮球数据裁判室',targets:[3,5,7],unit:'次',verb:'投',lesson:'瞄准篮筐，按住 E 蓄力、松开出手。每次实际出手单独记一笔，未命中记 0；不能遗漏，也不能把重复的分数合并。'},
  3: {name:'游泳',title:'泳道编程工坊',targets:[10,25,50],unit:'米',verb:'游',lesson:'W 前进划水，Shift 加快划频；接近池壁转身折返。先判断剩余距离，再划水并更新进度，就像 while 循环。'}
};
export const DIFFICULTIES=['入门','应用','挑战'];
const KEY='campus.sportsExam.v1';
function read(storage=localStorage){try{const v=JSON.parse(storage.getItem(KEY)||'[]');return Array.isArray(v)?v.filter(valid):[];}catch{return [];}}
function valid(m){return m&&typeof m.id==='string'&&[1,2,3].includes(m.lv)&&[1,2,3].includes(m.tier)&&Number.isFinite(m.created);}
function write(items,storage=localStorage){assertSaveCurrent(storage);storage.setItem(KEY,JSON.stringify(items.slice(-30)));}
export function createMission(lv,tier,storage=localStorage){
  if(!EXAM_SPORTS[lv]||![1,2,3].includes(tier))throw Error('无效考核等级');
  const mission={id:crypto.randomUUID(),lv,tier,target:EXAM_SPORTS[lv].targets[tier-1],created:Date.now(),status:'ready'};
  write([...read(storage),mission],storage);return mission;
}
export function getMission(id,storage=localStorage){return read(storage).find(m=>m.id===id)||null;}
export function finishMission(id,data,storage=localStorage){
  const list=read(storage),m=list.find(m=>m.id===id);if(!m)throw Error('找不到本次实测，请回考核室重新开始');
  if(m.status==='complete')return m;
  if(m.lv===2){
    if(!Array.isArray(data.shots)||data.shots.length!==m.target||data.shots.some(n=>![0,2,3].includes(n)))throw Error('投篮记录不完整');
    m.result={shots:data.shots.slice(),points:data.shots.reduce((a,b)=>a+b,0),hits:data.shots.filter(n=>n>0).length};
  }else{
    if(!Number.isFinite(data.seconds)||data.seconds<=0||!Number.isFinite(data.distance)||data.distance<m.target)throw Error('实测距离或时间不完整');
    m.result={distance:m.target,seconds:+data.seconds.toFixed(1)};
    if(m.result.seconds<=0)m.result.seconds=.1;
  }
  if(data.control&&data.control.ruleVersion===2)m.control={ruleVersion:2,assisted:!!data.control.assisted};
  m.status='complete';m.completed=Date.now();write(list,storage);return m;
}
export const missionURL=m=>'./?sportsExam='+encodeURIComponent(m.id);
export const returnURL=m=>'classrooms.html?wing='+m.lv+'&exam='+m.lv+'&difficulty='+m.tier+'&examMode=classic&mission='+encodeURIComponent(m.id);
export function sportSummary(m){
  if(m?.status!=='complete')return '尚未进行体育实测';
  const r=m.result;return m.lv===2?`${r.shots.length} 次出手 / ${r.hits} 次命中 / ${r.points} 分`:`${r.distance} 米 / ${r.seconds.toFixed(1)} 秒`;
}
