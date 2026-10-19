// Stable, versioned evidence. Answers are recorded once; corrections are separate.
const make=(title,code,opts,a,ex,model,values)=>({title,code,opts:opts.map(String),a,ex,model,values});
const num=(title,code,n,ex,model,values)=>{
 const opts=[Number((n+1).toFixed(2)),n,Number((n-1).toFixed(2))].map(String);
 // Rotate bank options; each new exam additionally shuffles all choices.
 const shift=[...title+code].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,0)%3;
 return make(title,code,opts.slice(shift).concat(opts.slice(0,shift)),(1-shift+3)%3,ex,model,values);
};
// 命中率不可能为负：只给命中率题用。全部未命中（正确值不足 1）时干扰项改用 n+1、n+2（多算一场/两场命中的典型错误），避免出现 -1。
const numHit=(title,code,n,ex,model,values)=>{
 const opts=(n<1?[n+1,n,n+2]:[Number((n+1).toFixed(2)),n,Number((n-1).toFixed(2))]).map(String);
 const shift=[...title+code].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,0)%3;
 return make(title,code,opts.slice(shift).concat(opts.slice(0,shift)),(1-shift+3)%3,ex,model,values);
};
export function shuffledQuestion(q,rng=Math.random){
 const order=q.opts.map((_,i)=>i);
 for(let i=order.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 return {...q,opts:order.map(i=>q.opts[i]),a:order.indexOf(q.a)};
}
// Python round(x, 2): round the exact binary64 value, with ties to even.
// Scaling x by 100 before rounding loses the distinction at values such as 2.675.
export function round2(x){
  if(!Number.isFinite(x))throw Error('非有限数值');
  const view=new DataView(new ArrayBuffer(8));view.setFloat64(0,Math.abs(x));const bits=view.getBigUint64(0),rawExp=Number(bits>>52n&2047n);
  const mantissa=(bits&((1n<<52n)-1n))+(rawExp?1n<<52n:0n),exp=rawExp?rawExp-1075:-1074;
  let numerator=mantissa*100n,denominator=1n;if(exp>=0)numerator<<=BigInt(exp);else denominator<<=BigInt(-exp);
  let n=numerator/denominator;const twice=numerator%denominator*2n;if(twice>denominator||twice===denominator&&n%2n)n++;
  return Math.sign(x)*Number(n)/100;
}
export function questions(lv,tier,result=null){
  if(![1,2,3].includes(lv)||![1,2,3].includes(tier))throw Error('无效题组');
  const d=result?.distance||100,t=result?.seconds||13,shots=result?.shots||(tier===1?[3,1,4,1,5]:[2,0,3,0,2]);
  const speed=round2(d/t),sum=shots.reduce((a,b)=>a+b,0),max=Math.max(...shots),hit=shots.filter(n=>n>0).length;
  const units=Math.ceil((result?.distance||25)/5),poolD=result?.distance||25;
  const card={scores:shots};
  if(lv===1){
    if(tier===1)return [
      result?num('把本次跑步变成速度读数（round(x, 2) 表示把 x 四舍五入保留 2 位小数）',`distance = ${d}\ntime = ${t}\nround(distance / time, 2)`,speed,`${d} ÷ ${t} ≈ ${speed} 米/秒。先除再保留两位小数；这不是取整。`,'run',{d,t,speed}):make('计时门读数：平均速度','print(100 / 13)',['7','7.692307692307693','8'],1,'/ 保留小数结果，100 / 13 是 7.692307692307693，仪表约为 7.69 米/秒。','run',{d:100,t:13,speed:7.69}),
      make('每组能分到几个训练球？','print(100 // 13)',['7','7.69','7.5'],0,'100 个球平均分给 13 组，每组 7 个，还剩 9 个。本题均为正数。','group',{total:100,groups:13,each:7,left:9}),
      make('三轮二选一，产生多少条路线？','print(2 ** 3)',['6','8','9'],1,'每轮分成 2 条，三轮是 2 × 2 × 2 = 8 条；** 表示幂。','branch',{rounds:3})
    ];
    if(tier===2)return [
      num('用两位小数报告平均速度（round(x, 2) 表示把 x 四舍五入保留 2 位小数）',`round(${d} / ${t}, 2)`,speed,`距离 ${d} 米、时间 ${t} 秒；平均速度 ${speed} 米/秒。`,'run',{d,t,speed}),
      num('分组后还剩多少球？','100 % 13',9,'13 × 7 + 9 = 100，余数必须小于 13。','group',{total:100,groups:13,each:7,left:9}),
      num('四轮二选一路线','2 ** 4',16,'分支依次为 2、4、8、16。不要把幂当作乘法 2 × 4。','branch',{rounds:4})
    ];
    return [
      make('时间减半后，同样的路程平均速度变为原来的 ___ 倍',`distance = ${d}\ntime = ${t} / 2\nspeed = distance / time\nprint(speed)`,['1','2','0.5'],1,`路程不变、用时减半：${d} ÷ (${t} / 2) 的结果是原来的 2 倍。`,'run',{d,t:t/2,speed:round2(d/(t/2))}),
      make('改正不够分的器材计划','13 组，每组 8 个，共有 100 个球',['刚好够','多 4 个','少 4 个'],2,'13 × 8 = 104，需要再补 4 个球。原来的余数 9 不是缺少的数量。','group',{total:100,groups:13,each:8,left:-4}),
      Object.assign(make('先分支，再把路线均分给两队','2 ** 3 // 2',['6','4','8'],1,'先计算幂得到 8，再整除 2，得到每队 4 条路线。','branch',{rounds:3,divide:2}),{noSignal:true})
    ];
  }
  if(lv===2){
    if(tier===1)return [
      num('逐张点名，不漏掉重复记录',`scores = [${shots.join(', ')}]\nlen(scores)`,shots.length,`一张卡就是一次记录，即使数字相同也分别计数，共 ${shots.length} 张。`,'cards',{...card,metric:'count'}),
      result?num('核验本次投篮总积分',`sum([${shots.join(', ')}])`,sum,`${shots.join(' + ')} = ${sum}。0 分出手也保留在原始名单。`,'bars',{...card,metric:'sum'}):Object.assign(make('把训练积分放上计分尺','sum([2, 3, 5])',['3','10','5'],1,'2 + 3 + 5 = 10，sum 计算总和。','bars',{scores:[2,3,5]}),{kp:'sum'}),
      result?num('找出单次最高积分',`max([${shots.join(', ')}])`,max,`本次最高一投是 ${max} 分。全部未命中时，最高值仍是 0。`,'rank',{...card,metric:'max'}):make('最高积分属于哪张卡？','max(4, 9, 1)',['1','4','9'],2,'这里比较的是积分，9 分最高；跑步用时则不能用最大值挑冠军。','rank',{scores:[4,9,1]})
    ];
    if(tier===2)return [
      num('每次出手平均得到几分？',`round(sum([${shots}]) / len([${shots}]), 2)`,round2(sum/shots.length),`总分 ${sum} ÷ ${shots.length} 次出手，结果按 Python round 保留两位小数。`,'bars',{...card,metric:'mean'}),
      num('最高与最低积分差',`max([${shots}]) - min([${shots}])`,max-Math.min(...shots),'分别取最大值和最小值，再相减。','rank',{...card,metric:'range'}),
      make('补记一笔 0 分后，print(scores) 输出什么？',`scores = [${shots.join(', ')}]\nscores.append(0)\nprint(scores)`,[`[${shots.join(', ')}]`,`[${shots.join(', ')}, 0]`,`[${sum}]`],1,'append 把 0 追加到列表末尾：列表多一条记录，其他元素不变。','cards',{scores:[...shots,0],metric:'append'})
    ];
    return [
      numHit('计算命中率，保留两位小数',`round(${hit} / ${shots.length} * 100, 2)`,round2(hit/shots.length*100),`命中率按次数计算，不按总分计算。本组为 ${round2(hit/shots.length*100)}%。`,'cards',{...card,metric:'hitRate'}),
      make('发现一张重复数字卡，要删掉吗？',`scores = [${shots}, ${shots[0]}]`,['删掉相同数字','保留，每张代表一次出手','只保留最大值'],1,'数字相同不代表同一次出手；统计的是记录，不是不同数字的种类。','cards',{scores:[...shots,shots[0]],metric:'count'}),
      num('再投中一个三分，新的平均积分',`round((${sum} + 3) / (${shots.length} + 1), 2)`,round2((sum+3)/(shots.length+1)),'总分加 3，出手次数也必须加 1，再求平均，并按 Python round 保留两位小数。','bars',{scores:[...shots,3],metric:'mean'})
    ];
  }
  if(tier===1)return [
    num('i 从 0 开始，while i < 3 每轮 i += 1，训练 ___ 组','i = 0\nwhile i < 3:\n    i += 1',3,'i 取 0、1、2，条件成立 3 次；更新到 3 后条件不成立，退出。','loop',{start:0,end:3,step:1}),
    make('机器人一直游，最可能漏了什么？','i = 0\nwhile i < 3:\n    swim(5)',['忘记更新 i','使用英文冒号','变量名太长'],0,'i 一直为 0，条件始终为真。演示只播放有限步并安全暂停，这不代表程序正常结束。','loop',{start:0,end:3,step:0}),
    result?make('已达到本次实测距离，还要继续吗？',`distance = ${poolD}\nwhile distance < ${poolD}:\n    swim(5)`,['0 次','1 次','4 次'],0,`已经达到本次实测的 ${poolD} 米，第一次条件判断即为假，执行 0 次。`,'loop',{start:poolD,end:poolD,step:5}):make('先看条件，再决定是否下水','while 4 < 3:\n    swim(5)',['0 次','1 次','4 次'],0,'第一次判断就是假，循环体执行 0 次；while 不是先做一次再判断。','loop',{start:4,end:3,step:1})
  ];
  if(tier===2)return [
    num('每轮 5 米，至少几轮达到本次距离？',`distance = 0\nwhile distance < ${poolD}:\n    distance += 5`,units,`依次累加 5，达到或超过 ${poolD} 米时停止，共 ${units} 轮。`,'loop',{start:0,end:poolD,step:5}),
    make('每轮递增一次，更新指令应放在哪？','while distance < target:',['循环外面','训练后，循环里面','删除更新指令'],1,'更新必须在循环体内执行，下一轮条件才会看见新的进度。','loop',{start:0,end:15,step:5}),
    num('i 从 1 开始，i <= 3 训练几次？','i = 1\nwhile i <= 3:\n    i += 1',3,'1、2、3 均满足 <= 3；更新到 4 后退出。','loop',{start:1,end:3,step:1,inclusive:true})
  ];
  return [
    num('严格小于时，会训练几轮？','i = 1\nwhile i < 3:\n    i += 1',2,'仅 i = 1、2 执行，i = 3 时条件已为假。','loop',{start:1,end:3,step:1}),
    num('每轮 4 米，停止时累计多少米？',`distance = 0\nwhile distance < ${poolD}:\n    distance += 4`,Math.ceil(poolD/4)*4,`条件在每轮开始判断，最后可能超过目标，停止读数为 ${Math.ceil(poolD/4)*4} 米。`,'loop',{start:0,end:poolD,step:4}),
    num('i = 1，while i < 10 每轮 i += 4：停止时 i = ___','i = 1\nwhile i < 10:\n    i += 4',13,'i 依次是 1、5、9；更新到 13 时 13 < 10 不成立才停止——步子太大可能跳过终点。','loop',{start:1,end:10,step:4})
  ];
}
export function gradeAttempt(a){return a.questions.reduce((n,q,i)=>n+(a.answers[i]?.first===q.a?1:0),0);}
export function answerQuestion(a,index,choice){
  const q=a.questions[index];if(!q||!Number.isInteger(choice)||choice<0||choice>=q.opts.length)return false;
  const old=a.answers[index];if(old){if(choice===q.a)old.corrected=true;return false;}
  a.answers[index]={first:choice,corrected:false};return true;
}
export function loopTrace(v){
  let value=v.start;const trace=[];
  for(let n=0;n<24;n++){
    const condition=v.inclusive?value<=v.end:value<v.end;
    trace.push({value,condition});if(!condition)return {trace,stopped:true};value+=v.step;
  }
  return {trace,stopped:false};
}

// The model's calculation uses the question's actual records, including misses and repeats.
export function statisticReadout(q,index=0){
 const s=q.values.scores,n=s.length,total=s.reduce((a,b)=>a+b,0),lo=Math.min(...s),hi=Math.max(...s),i=Math.min(Math.max(0,index),n-1);
 // Old saved attempts predate metric tags; infer only the known bank operations.
 const metric=q.values.metric||(q.model==='bars'&&q.code.includes('/')?'mean':q.model==='cards'&&/\*\s*100/.test(q.code)?'hitRate':q.model==='rank'&&/\-\s*min\(/.test(q.code)?'range':({cards:'count',bars:'sum',rank:'max'})[q.model]);
 const value=({count:n,sum:total,mean:round2(total/n),range:hi-lo,max:hi,hitRate:round2(s.filter(x=>x>0).length/n*100)})[metric];
 const formula=({count:`${n} 张记录，重复和 0 均计入`,sum:`${s.join(' + ')} = ${total}`,mean:`${total} ÷ ${n} ≈ ${value} 分/次`,range:`最大 ${hi} − 最小 ${lo} = ${value}`,max:`最高 ${hi}，逐张比较`,hitRate:`命中 ${s.filter(x=>x>0).length} 次 ÷ ${n} 次 × 100% ≈ ${value}%`})[metric];
 return {metric,value,formula,current:i+1,count:n,lo,hi,mean:total/n};
}
