export function actionFrame(result,index){const a=result?.actions||[],i=Math.max(0,Math.min(a.length,Math.floor(index)));return {index:i,count:a.length,current:a[i]??null,next:a[i+1]??null,ended:i===a.length};}
export function actionPlaybackText(data,result,index){
 const f=actionFrame(result,index),command=data.kind==='route'?'train':'jump',partial=!!(result?.partial||result?.error||result?.timeout||result?.trace?.truncated||result?.trace?.partial);
 if(partial)return f.ended?`已到部分记录末尾：仅收到 ${f.count} 条真实动作；执行或记录未完成，不代表程序正常结束。`:`部分记录 ${f.index+1}/${f.count}：${command}(${f.current})；执行或记录未完成，仅回放已收到的真实动作。`;
 return f.ended?`回放结束：程序实际留下 ${f.count} 条动作记录。${result?.pass?'本题通过。':'本题尚未通过。'}`:`实际记录 ${f.index+1}/${f.count}：${command}(${f.current}) → ${f.next===null?'没有下一条':`下一条 ${command}(${f.next})`}。`;
}
const fmt=n=>Number.isInteger(n)?String(n):String(Number(n.toFixed(4)));
export function taskExplanation(data,r){
 if(!r)return ({swim:'先操作完整段和剩余段，分清两个量；再用代码算出并只打印本趟已游 remainder。演练中的结果不计成绩。',power:'先逐轮增加分支，再用乘方复现完整路线数。',loop:'先逐轮操作，观察编号前进和条件停止，再用 while 与 jump(i) 复现。',accumulate:'先逐轮累加，达到或超过目标就停止，再用代码复现。模型的一次动作代表程序的一轮。',condition:`逐张判断是否达到 ${data.threshold}；同分同学也分别计数。`,debug:'先逐步观察缺少更新的错误示例；最多演示六步，安全停下。补上更新，再到下方修复代码。',graduate:'先取一项、加到 total、再移动指针，最后汇总。编程回放只使用实际执行的累加记录。',route:`先从第 1 站依次访问到第 ${data.count} 站，再用 for 调用 train(station) 复现。`})[data.kind]||'先动手操作上方模型，再在下方用代码复现。模型与题面共用同一组数据。';
 if(r.partial)return `执行或记录未完成${r.error?'：'+r.error:''}。这里只显示已收到的部分真实记录，不能当作正常结束或任务通过；修复后重新运行。`;
 if(r.error)return r.timeout?'程序没有正常结束。模型保留已收到的真实记录，不补造成功动作；检查条件和每轮更新，再重新运行。':`这次程序未正常完成：${r.error}。先修复错误，再观察结果。`;
 if(r.hint&&!['loop','debug','route'].includes(data.kind))return r.hint;
 if(r.hint?.includes('需要用 while')||r.hint?.includes('需要用 for'))return r.hint;
 const got=r.text||'没有打印值',a=r.actions||[],s=data.scores||[];
 if(data.kind==='swim'){const rest=data.swim%data.pool,left=(data.pool-rest)%data.pool;return `你输出 ${got} 米。${data.swim} = ${Math.floor(data.swim/data.pool)} × ${data.pool} + ${rest}：本趟已游 ${rest} 米，还差 ${left} 米。绿色段是题目剩余距离，橙色标记是你提交的位置；正好在端点时剩余为 0。`;}
 if(data.kind==='power')return `你输出 ${got} 种。每轮有 ${data.choices} 个分支，共 ${data.rounds} 轮；图中结构对应本题给定条件。代码中的 routes 与打印值以实际执行记录为准。`;
 if(['loop','debug','route'].includes(data.kind)){
  const expected=data.count,command=data.kind==='route'?'train':'jump';
  if(expected==null)return `本次实际执行 ${a.length} 次动作。每执行一次 ${command} 才有一条动作记录；对照题目目标核对次数与顺序。`;   // 兜底：题面缺目标数时不输出 undefined/NaN
  if(a.length!==expected)return `本次实际执行 ${a.length} 次，目标 ${expected} 次，${a.length<expected?'少':'多'}了 ${Math.abs(a.length-expected)} 次。每执行一次 ${command} 才有一条动作记录。`;
  const bad=a.findIndex((v,i)=>v!==i+1);if(bad>=0)return `第 ${bad+1} 条传入了 ${a[bad]}，应为 ${bad+1}。次数虽对，但顺序不对；请检查起点、边界与更新。`;
  return `实际记录从 ${command}(1) 到 ${command}(${expected})，共 ${expected} 次。逐步查看当前这一条和下一条；没有下一条即回放结束。${r.pass?'本题通过。':'过程或边界复核尚未通过，请按提示修改。'}`;
 }
 if(data.kind==='accumulate')return `本次产生 ${a.length} 条训练指令，最终 total = ${r.total??'未打印'}。给定目标 ${data.target}，每轮增加 ${data.perRound}；首次达到或超过目标就停止。模型只回放实际指令，不从正确答案推算你的动作。`;
 if(data.kind==='run')return `你的输出是 ${got}。跳绳 ${data.distance} 下除以 ${data.time} 秒，用 / 计算约为 ${fmt(data.distance/data.time)} 下/秒。演练计时用于比较频率，不是答题倒计时。`;
 if(data.kind==='rank')return `你的输出是 ${got}。// 只留整数部分：${data.distance} // ${data.time} = ${Math.floor(data.distance/data.time)}（余 ${Math.floor(data.distance)%Math.floor(data.time)} 舍去）。演练计时用于观察整数商，不是答题倒计时。`;
 if(data.kind==='gate')return `你的输出是 ${got}。${data.conds?.[0]?.expr||''} 为 ${data.conds?.[0]?.ok?'True':'False'}，${data.conds?.[1]?.expr||''} 为 ${data.conds?.[1]?.ok?'True':'False'}；and 要两项都为 True 才是“正好分完”。可以先分别核对两个条件，再用 and 合并。`;
 if(s.length){const total=s.reduce((a,b)=>a+b,0);const details={sum:`把 ${s.length} 份成绩相加，总数为 ${total}`,count:`共有 ${s.length} 份记录；重复成绩和 0 分也都计入人数`,average:`总数 ${total} ÷ 人数 ${s.length} = ${fmt(total/s.length)}；黄色线根据本次代码输出显示`,extremes:`最大值 ${Math.max(...s)}，最小值 ${Math.min(...s)}；先最大后最小`,graduate:`本次可回放 ${(r.trace?.events||[]).filter(e=>e.type==='accumulate').length} 条真实累加记录；逐条核对索引、取出的值和 total 的变化`};return `你的输出：${got}。${details[data.kind]||'每根柱对应一份原始记录'}。`;}
 return `本次输出：${got}。${r.pass?'已通过本题校验。':'请按题目要求修改。'}`;
}
