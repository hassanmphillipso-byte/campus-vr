// The model reads the same preamble as the editor, including changed test data.
const definitions={
 '1-1':['run','跳绳计时现场'],'1-2':['rank','整数商观察台'],
 '1-3':['swim','泳道观察台'],'1-4':['gate','分组判定现场'],
 '2-1':['sum','运动会成绩台'],'2-2':['count','参赛登记台'],
 '2-3':['average','平均成绩分析台'],'2-4':['extremes','成绩比较台'],
 '2-5':['condition','逐张审核台'],'3-1':['loop','循环训练台'],
 '3-2':['accumulate','团队训练台'],'3-3':['debug','训练设备检修台'],
 '3-4':['graduate','毕业数据实验台'],'3-5':['route','顺序训练路线'],
};
export function taskSceneData(room,levels=[]){
 const task=room.task||{},[kind,title]=task.step==='power'?['power','路线选择台']:definitions[room.id]||['observe',task.title||'模型演练'];
 const pre=task.pre||(room.id==='2-5'?levels[1]?.tasks[0]?.pre:'')||'',vars={};
 for(const m of pre.matchAll(/^\s*([a-zA-Z_]\w*)\s*=\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(?:#.*)?$/gm))vars[m[1]]=Number(m[2]);
 const match=pre.match(/scores\s*=\s*\[([^\]]*)\]/),scores=match?match[1].split(',').filter(x=>x.trim()).map(Number).filter(Number.isFinite):[];
 // Fixed distances/thresholds are part of the task; any named preamble value wins.
 const distance=vars.distance??100,time=vars.time,pool=vars.pool,swim=vars.swim,choices=vars.choices,rounds=vars.rounds;
 const count=vars.count??Number(task.tiers?.join('\n').match(/while\s+\w+\s*<=\s*(\d+)/)?.[1]||0);
 const data={id:room.id,kind,title,scores,lv:room.lv,vars,distance,time,pool,swim,choices,rounds,count,target:vars.target,perRound:vars.per_round,score:vars.score,speed:vars.speed,minScore:vars.min_score??60,minSpeed:vars.min_speed??7,threshold:vars.threshold??180,wrongExample:task.wrongExample||''};
 data.given=({run:`跳绳 ${distance} 下 · 用时 ${time} 秒`,rank:`${distance} 米 / ${time} 秒 · 只考察整除 //`,swim:`累计 ${swim} 米 · 整段 ${Math.floor(swim/pool)}×${pool} 米 · 本趟 ${swim%pool} 米`,power:`每轮 ${choices} 种选择 · 共 ${rounds} 轮`,gate:`队伍 ${vars.team} 人 · 每 ${vars.size} 人一组 · 两项都满足才判“正好分完”`,loop:`目标 ${count} 次 · 依次传入编号`,debug:`目标 ${count} 次 · 检查条件与更新`,accumulate:`目标 ${data.target} · 每轮 ${data.perRound}`,route:`从第 1 站到第 ${count} 站 · train(station) 按顺序访问`})[kind]||`本题 ${scores.length} 份成绩 · ${scores.join('、')}`;
 // 2026-10-17 换题（老师修改意见）：gate 两条件改为分组判定——组数 ≥ 1、剩余 == 0。
 if(kind==='gate'){
  const team=vars.team,size=vars.size;
  if(Number.isFinite(team)&&Number.isFinite(size)&&size>0){
   const groups=Math.floor(team/size),left=team%size;
   data.conds=[{name:'组数条件',expr:`组数 ${groups} ≥ 1`,ok:groups>=1},{name:'剩余条件',expr:`剩余 ${left} == 0`,ok:left===0}];
  }else data.conds=[{name:'组数条件',expr:`组数 ${Math.floor((vars.score??0)/(vars.minScore||1))} ≥ 1`,ok:true},{name:'剩余条件',expr:'剩余 0 == 0',ok:true}];   // 兜底：题面缺 team/size 时退化为恒真展示
 }
 return data;
}
export function taskSceneResult(result){
 if(!result)return null;
 const raw=String(result.out||''),text=raw.split('\n').filter(x=>!x.startsWith('ACTS:')&&!x.startsWith('TOTAL:')).join('\n').trim();
 const values=(text.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)||[]).map(Number).filter(Number.isFinite);
 const failed=!!(result.error||result.timeout||result.ok===false);
 const match=raw.match(/ACTS:\s*(\[[^\]]*\])/);let actions=[];
 // Legacy stdout is usable only after normal completion. On failure it may be a student's forged print.
 if(!failed)try{const a=match?JSON.parse(match[1]):result.acts;actions=Array.isArray(a)?a.filter(Number.isFinite).slice(0,10000):[];}catch{}
 const trace=result.trace&&Array.isArray(result.trace.events)?result.trace:null;
 if(trace)actions=trace.events.filter(e=>e.type==='action'&&['jump','train'].includes(e.name)&&Number.isFinite(e.value)).map(e=>e.value);
 const partial=failed||!!(result.partial||trace?.partial||trace?.truncated);
 const total=raw.match(/TOTAL:\s*(-?\d+(?:\.\d+)?)/);
 return {pass:!!result.pass&&!partial,partial,error:result.error||'',hint:result.hint||'',timeout:!!result.timeout,text,values,actions,total:total?Number(total[1]):null,trace};
}
