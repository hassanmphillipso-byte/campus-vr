// Pure, ungraded model interactions. No storage, grading, timers, or rewards.
const fmt=n=>Number.isInteger(n)?String(n):String(Number(n.toFixed(4)));
export function createPractice(data){return {kind:data.kind,index:0,phase:'ready',selected:[],total:0,target:data.target,good:0,round:0,actions:[],elapsed:0,time:data.time,score:data.score,speed:data.speed,gateChecks:[],message:'',complete:false,debugFixed:false,debugSteps:0,held:null,added:false,average:null,best:null,least:null,selectedMax:null,selectedMin:null};}
export function practiceAction(data,previous,action,value){
 const s=structuredClone(previous),kind=data.kind,scores=data.scores||[];s.message='';
 if(action==='reset')return createPractice(data);
 if(kind==='accumulate'&&action==='target'){
  if(!Number.isFinite(value)||value<0)return s;
  const next=createPractice(data);next.target=value;next.complete=value===0;
  next.message=value===0?'演练目标为 0：开始时 total = 0，条件已不成立，一轮也不执行。':`演练目标切换为 ${value}，累计值归零；每轮仍为 ${data.perRound}。下方编程题的数据不变。`;return next;
 }
 if(['run','rank'].includes(kind)){
  if(action==='time'){s.time=Number(value);s.elapsed=0;s.complete=false;s.phase='ready';}
  // 2026-10-17 老师反馈：101（run）不再出现"整数商"字样；102（rank）只讲 //，不与 / 对照。
  if(action==='race'){s.elapsed=s.time;s.complete=true;s.phase='finished';s.message=kind==='run'
   ?`跳绳 ${data.distance} 下 ÷ ${s.time} 秒 = ${fmt(data.distance/s.time)} 下/秒（小数原样保留）。可再点一次，换个计时试试。`
   :`// 只留整数部分：${data.distance} // ${s.time} = ${Math.floor(data.distance/s.time)}（余数舍去）。可再点一次试试。`;}
 }else if(kind==='swim'&&action==='segment'){
  s.index=Math.min(2,s.index+1);s.phase=s.index===1?'remainder':'remaining';s.complete=s.index===2;
  const remainder=data.swim%data.pool,left=(data.pool-remainder)%data.pool;
  s.message=s.index===1?`先移开 ${Math.floor(data.swim/data.pool)} 段完整泳道，本趟已游 ${remainder} 米。`:`现在标出剩余 ${left} 米。${remainder===0?'正好在端点，剩余为 0。':'已游段和剩余段合起来是一段泳道。'}`;
 }else if(kind==='power'&&action==='branch'){
  s.round=Math.min(data.rounds,s.round+1);s.complete=s.round===data.rounds;s.message=`第 ${s.round} 轮：${data.choices} ** ${s.round} = ${data.choices**s.round} 条完整路线。`;
 }else if(kind==='gate'){
  // 2026-10-17 换题（老师修改意见）：两条件来自 data.conds（组数 ≥ 1、剩余 == 0），判定"是否正好分完"。
  if(action==='gateCase'){s.gateChecks=[];s.complete=false;}   // 保留兼容入口：无 UI 按钮，node 单测直测
  if(action==='checkScore'&&!s.gateChecks.includes('score'))s.gateChecks.push('score');
  if(action==='checkSpeed'&&!s.gateChecks.includes('speed'))s.gateChecks.push('speed');
  if(action==='gate'){if(s.gateChecks.length<2)s.message='先分别核对两个条件，再让 and 合并两个结果。';else{s.complete=true;s.phase=data.conds.every(c=>c.ok)?'open':'closed';s.message=`${data.conds[0].expr} 为 ${data.conds[0].ok?'True':'False'}；${data.conds[1].expr} 为 ${data.conds[1].ok?'True':'False'}。and → ${s.phase==='open'?'True，正好分完':'False，还有剩余'}。`;}}
 }else if(['sum','count','average'].includes(kind)&&action==='card'){
  const i=Number(value);if(!Number.isInteger(i)||i<0||i>=scores.length||s.selected.includes(i))return s;
  s.selected.push(i);s.total+=scores[i];s.index=s.selected.length;s.message=kind==='count'?`放入第 ${i+1} 张记录。人数 = ${s.index}；相同分数仍分别计数。`:`放入 ${scores[i]}，累计 ${s.total}，已收 ${s.index}/${scores.length} 张。`;
  s.complete=s.index===scores.length&&kind!=='average';
 }else if(kind==='average'&&action==='share'){
  if(s.selected.length!==scores.length)s.message='先把每一张成绩放进统计台，再平均分。';else{s.average=s.total/scores.length;s.complete=true;s.message=`${s.total} ÷ ${scores.length} = ${fmt(s.average)}。每份分到相同数值，黄色线对齐平均值。`;}
 }else if(kind==='extremes'&&['pickMax','pickMin'].includes(action)){
  const i=Number(value);if(!Number.isInteger(i)||i<0||i>=scores.length)return s;
  if(action==='pickMax')s.selectedMax=i;else s.selectedMin=i;
  const max=Math.max(...scores),min=Math.min(...scores);s.complete=scores[s.selectedMax]===max&&scores[s.selectedMin]===min;
  s.message=s.complete?`两端找到：最大 ${max}，最小 ${min}。`:`你选的${action==='pickMax'?'最高':'最低'}是第 ${i+1} 张 ${scores[i]}。${scores[i]===(action==='pickMax'?max:min)?'这一端正确，再检查另一端。':'还可以继续比较，点另一张试试。'}`;
 }else if(kind==='condition'&&action==='judge'){
  if(s.index>=scores.length)return s;const good=scores[s.index]>=data.threshold;
  if((value==='yes')!==good){s.message=`第 ${s.index+1} 张是 ${scores[s.index]}，请重新判断是否 ≥ ${data.threshold}。`;return s;}
  if(good)s.good++;s.selected.push(s.index);s.index++;s.complete=s.index===scores.length;s.message=`已核对 ${s.index}/${scores.length} 张，达到 ${data.threshold} 的有 ${s.good} 人。相同成绩仍各算一人。`;
 }else if(['loop','accumulate'].includes(kind)&&action==='round'){
  const target=s.target??data.target,allowed=kind==='loop'?s.actions.length<data.count:s.total<target;
  if(!allowed){s.complete=true;s.message='条件已经不成立，停止，不再增加动作。';return s;}
  s.actions.push(kind==='loop'?s.actions.length+1:0);if(kind==='accumulate')s.total+=data.perRound;
  s.complete=kind==='loop'?s.actions.length===data.count:s.total>=target;
  s.message=kind==='loop'?`jump(${s.actions.length}) 已完成；下一编号 ${s.actions.length+1} ${s.complete?'>':'≤'} ${data.count}，${s.complete?'停止':'继续'}。`:`第 ${s.actions.length} 轮后 total = ${s.total}；${s.total} < ${target} 为 ${s.complete?'False，停止':'True，继续'}。${s.complete?(s.total===target?'恰好达到也要停，不再加一轮。':'这一轮首次超过目标，属于正确停止，不是多跳了一轮。'):''}`;
 }else if(kind==='debug'){
  if(action==='bug'){s.debugFixed=false;s.debugSteps=Math.min(6,s.debugSteps+1);s.actions=Array(s.debugSteps).fill(1);s.complete=false;s.message=`错误示例第 ${s.debugSteps}/6 步：jump(1)，i 仍是 1，条件仍成立。${s.debugSteps===6?'观察到此自动停止，不让浏览器真的卡住。':'点下一步观察重复编号。'}`;}
  if(action==='fix'){s.debugFixed=true;s.debugSteps=0;s.actions=[];s.message='已补上 i += 1。再逐步运行，观察编号能否前进。';}
  if(action==='fixedStep'&&s.debugFixed&&s.actions.length<data.count){s.actions.push(s.actions.length+1);s.complete=s.actions.length===data.count;s.message=`修复示例：jump(${s.actions.length}) → i = ${s.actions.length+1}。${s.complete?'条件为 False，正常停止。':'编号前进，再检查条件。'}`;}
 }else if(kind==='graduate'){
  if(action==='take'&&s.held===null&&s.index<scores.length){s.held=scores[s.index];s.added=false;s.message=`i = ${s.index}：取出 scores[${s.index}] = ${s.held}，下一步加入 total。`;}
  if(action==='add'&&s.held!==null&&!s.added){const before=s.total;s.total+=s.held;s.added=true;s.message=`total = ${before} + ${s.held} = ${s.total}。取出的这一项已加入；下一步移动 i。`;}
  if(action==='move'){if(s.held===null||!s.added)s.message='先取一项，再加入 total，然后才能移动 i。';else{s.index++;s.held=null;s.added=false;s.message=`i → ${s.index}。${s.index<scores.length?'继续取下一项。':'已到列表末尾，点汇总。'}`;}}
  if(action==='summary'&&s.index===scores.length){s.complete=true;s.average=s.total/scores.length;s.least=Math.min(...scores);s.message=`逐项累加结束：总数 ${s.total}，平均 ${fmt(s.average)}，最小 ${s.least}。`;}
 }else if(kind==='route'&&action==='station'){
  const station=Number(value),next=s.actions.length+1;
  if(station!==next){s.message=`下一站应按顺序访问第 ${next} 站；本次点击没有产生 train 指令。`;return s;}
  if(next<=data.count){s.actions.push(station);s.complete=s.actions.length===data.count;s.message=`train(${station})：第 ${station} 站训练完成。${s.complete?'已按顺序访问全部站点。':`下一站是 ${station+1}。`}`;}
 }
 return s;
}
export function practicePrompt(d,s){
 if(d.kind==='accumulate'&&!s.complete)return `演练目标 ${s.target??d.target}，每轮 ${d.perRound}。点“执行一轮”，更新 total 后再判断是否继续。`;
 const complete=s.complete?(d.kind==='condition'?'演练已完成；可再试一次，也可继续本室学习。':'演练已完成；可再试一次，也可开始编程。'):'';
 if(complete)return complete;
 return ({run:'点“启动计时比较”，观察总下数不变时，用时不同、频率怎么变。',rank:'启动计时后观察整数商；再换一个用时试试。',swim:s.index?'点“标出剩余段”，区分已游与还差。':'先点“移开完整段”，留下本趟已经游过的部分。',power:`点“增加一轮分支”，观察每条路线如何分成 ${d.choices} 条。`,gate:'分别核对组数条件和剩余条件，再点“用 and 合并”。',sum:'逐张点成绩，把每份成绩放入累计框。',count:'逐张点登记卡，一张记一人；0 分和重复成绩也算。',average:s.selected.length===d.scores.length?'所有成绩已收齐，点“平均分给每人”。':'先逐张放入成绩，再平均分给每人。',extremes:'依次选最高和最低，比较后可以随时改选。',condition:s.index<d.scores.length?`第 ${s.index+1} 张：${d.scores[s.index]}。它是否 ≥ ${d.threshold}？`:'全部核对完毕。',loop:'点“执行一轮”，观察传入编号、更新和停止条件。',accumulate:`点“执行一轮”，把 ${d.perRound} 加入 total，再检查是否达到 ${d.target}。`,debug:s.debugFixed?'点“修复后执行一步”，检查编号前进和最终停止。':'点“错误示例下一步”，观察 i 不更新造成重复；最多观察 6 步。',graduate:s.held===null?(s.index<d.scores.length?'先取出当前位置的一项成绩。':'全部遍历完成，点“汇总”。'):s.added?'本项已累加，点“移动到下一项”。':'点“加入 total”，再移动指针。',route:`点第 ${s.actions.length+1} 站，按顺序走完 ${d.count} 个训练站。`})[d.kind]||'操作上方模型后开始编程。';
}
export function replayFrames(data,result){
 if(!result)return [];
 const events=result.trace?.events||[];
 if(data.kind==='graduate')return events.filter(e=>e.type==='accumulate');
 if(['loop','accumulate','debug','route'].includes(data.kind)){
  let values={};const actions=[];for(const event of events){if(event.values)values=event.values;if(event.type==='action')actions.push({...event,values:{...values}});}
  return result.actions.map((value,index)=>({type:'action',name:data.kind==='route'?'train':'jump',value,index,...actions[index]}));
 }
 return events.filter(e=>e.type==='output'||e.type==='statement'&&Object.keys(e.values||{}).some(k=>['speed','left','routes','passed','total','n','avg','best','least'].includes(k)));
}
