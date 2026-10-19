/* py_levels_data.js — Python 编程关卡内容数据（三关 × 任务 × 三档脚手架 × 判定 × 小测）
 * 约定：___ 为填空占位；tiers[0]=填空(1★) [1]=补全(2★) [2]=从零写(3★)
 *      check(out文本行数组, res) → {pass, got, hint}；数据每次刷新随机 → 防抄答案
 * 加载：<script src="js/py_levels_data.js"></script> 置于主脚本之前 */
(function () {
  'use strict';
  // —— 随机成绩（每次加载不同，判定同步引用）——
  const S2 = Array.from({ length: 8 }, () => 150 + Math.floor(Math.random() * 51));       // 关卡2 班级成绩
  const S3 = Array.from({ length: 8 }, () => 150 + Math.floor(Math.random() * 51));       // 关卡3 毕业用
  // Strict output shape: numeric equivalence is allowed, extra answers are not.
  const numbers = lines => {
    if(lines.length !== 1)return [];
    const tokens=lines[0].trim().split(/\s+/);
    return tokens.every(s=>/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s))?tokens.map(Number):[];
  };
  const num = l => {const ns=numbers([String(l)]);return ns.length===1?ns[0]:NaN;};
  const near = (a,b,tol=.000001) => Number.isFinite(a)&&Math.abs(a-b)<=tol;
  const numericOutput = (lines,expected,tol=.000001) => {const ns=numbers(lines);return ns.length===expected.length&&ns.every((n,i)=>near(n,expected[i],tol));};
  const hasVal = (lines,v,tol=.000001) => numericOutput(lines,[v],tol);
  const ACTS_PRE = 'ACTS = []\ndef jump(n=0):\n    if len(ACTS) < 10000:\n        ACTS.append(n)';
  const TRAIN_PRE = 'count = 5\nACTS = []\ndef train(station):\n    if len(ACTS) < 10000:\n        ACTS.append(station)';
  const ACTS_SUF = "print('ACTS:' + str(ACTS))";
  const parseActs = out => {
    const m = out.match(/ACTS:\s*\[([^\]]*)\]/);
    if (!m) return null;
    const body=m[1].trim();
    if(!body)return [];
    const values=body.split(',').map(s=>s.trim());
    return values.every(s=>/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s))?values.map(Number):null;
  };

  window.PY_LEVELS = [
    /* ================= 关卡 1 运动会计分台（运算符 + float）· 教学楼·北楼一层教室 ================= */
    {
      id: 1, name: '运动会计分台', pos: [-43.5, -85], door: [-40.2, -85], color: 0x3d7bff,
      room: '①号编程教室（教学楼·北楼一层）', teacher: '邹亮',
      story: '校运会开幕！教学楼·北楼一层的①号编程教室变成了计分指挥室。变量 time 已给出，把成绩算出来！',
      card: '【知识卡 · 运算符与 float】\n算术：+ - * / // % **（/ 真除法得小数，// 向下取整，% 取余数，** 乘方）\n比较：> < >= <= == !=，结果是 True/False\n逻辑：and（都真才真）or（一真即真）not（取反）\nfloat 就是带小数点的数：100/13 = 7.692307692307693',
      tasks: [
        {
          id: '1-1', title: '跳绳测频', teach: '/ 是真除法，结果是小数（float）',
          brief: '跳绳同学 13 秒跳完 100 下。用给定变量 time 算每秒跳绳频率：freq = 100 / time，然后 print(freq)。让小数原样输出——不要用 // 取整，也不要自己四舍五入。换一组 time 也应成立。',
          pre: 'time = 13.0',
          tiers: ['freq = 100 ___ time\nprint(freq)',
                  'freq = 100 / time\nprint(___)',
                  '# time = 13.0 已给出：13 秒跳 100 下\n# 算每秒跳绳频率并打印（结果是小数）\n\n'],
          ops: ['/', '//', '*', '+', 'freq'],
          check: lines => {
            const g = lines.length===1?num(lines[0]):NaN;
            if (!isNaN(g) && near(g, 100 / 13)) return { pass: true, got: g };
            if (!isNaN(g) && near(g, 7)) return { pass: false, got: g, hint: '得到 7 —— 你用了整除 //，本题正数计算会舍去小数部分。这题要精确小数，用 /。' };
            return { pass: false, got: g, hint: '请直接打印 100 / time 的结果（当前约 7.6923076923），不要手动截断为 7.69。只打印一个数。' };
          },
          anim: 'led-speed',
        },
        {
          id: '1-2', title: '整数商观察', teach: '// 向下取整；本题正数的整数商为 7',
          brief: '用 // 计算 100 米除以 time 秒的整数商，只打印结果。',
          pre: 'time = 13.0',
          tiers: ['speed = 100 ___ time\nprint(speed)',
                  'speed = 100 // ___\nprint(speed)',
                  '# 用 // 算整数速度并打印\n\n'],
          ops: ['//', '/', '%', 'time'],
          check: lines => {
            const g = lines.length===1?num(lines[0]):NaN;
            if (!isNaN(g) && near(g, 7)) return { pass: true, got: g };
            if (!isNaN(g) && near(g, 100 / 13, 0.01)) return { pass: false, got: g, hint: '得到小数 —— 这题要用整除 //（只留整数部分）。' };
            return { pass: false, got: g, hint: '期望 7（100 // 13）。' };
          },
          anim: 'podium',
        },
        {
          id: '1-3', title: '泳道折返', teach: '% 取余数，算本趟已游',
          brief: '一段泳道长 50 米，已经累计游了 137 米。137 里有两个整段（2×50=100），本趟已经游了 37 米。用 % 直接算出这个 remainder：swim % pool，只打印 remainder。先看已知距离，再运行代码；正好在端点时应输出 0。',
          pre: 'pool = 50\nswim = 137',
          tiers: ['remainder = swim ___ pool\nprint(remainder)',
                  'remainder = swim % pool\nprint(___)',
                  '# pool=50、swim=137 已给出。\n# 用 % 算本趟已游米数并打印。\n'],
          ops: ['%', '//', '/', 'remainder'],
          check: lines => {
            const g = lines.length===1?num(lines[0]):NaN;
            if (!isNaN(g) && g === 37) return { pass: true, got: g };
            return { pass: false, got: g, hint: '期望 37（137 % 50）。取余直接给出本趟零头。' };
          },
          anim: 'led',
        },
        {
          id: '1-4', title: '分组判定', teach: '// 算组数、% 算剩余，再用 and 判断是否正好分完',
          brief: '跳绳队 team = 45 人，每 size = 6 人一组训练。先算出能分成几组 groups = team // size、还剩几人 left = team % size；再判断是否正好分完（剩余为 0，且至少分出一组）：full = left == 0 and groups >= 1。按顺序打印 groups、left、full。',
          pre: 'team = 45\nsize = 6',
          tiers: ['groups = team // size\nleft = team ___ size\nfull = left == 0 and groups >= 1\nprint(groups, left, full)',
                  'groups = team ___ size\nleft = team % size\nfull = ___ == 0 and groups >= 1\nprint(groups, left, full)',
                  '# team=45、size=6 已给出\n# 组数 groups = team // size；剩余 left = team % size\n# 正好分完：full = left == 0 and groups >= 1\n# 按顺序打印 groups、left、full\n\n'],
          ops: ['%', '//', 'and', 'left', 'groups'],
          check: lines => {
            if (lines.length !== 1) return { pass: false, hint: '只打印一行：groups、left、full 三个值（空格隔开）。' };
            const tk = lines[0].trim().split(/\s+/);
            if (tk.length !== 3) return { pass: false, hint: '应一行打印三个值：groups left full（空格隔开）。' };
            if (tk[2] !== 'False') return { pass: false, got: tk.join(' '), hint: '45 // 6 = 7 组，45 % 6 剩 3 人；剩余 3 不为 0，full 应为 False。' };
            if (tk[0] === '7' && tk[1] === '3') return { pass: true, got: tk.join(' ') };
            return { pass: false, got: tk.join(' '), hint: '组数用 team // size（45 // 6 = 7），剩余用 team % size（45 % 6 = 3）。' };
          },
          anim: 'cheer',
        },
      ],
      quiz: [
        { q: 'print(100 / 13) 输出什么？', opts: ['7', '7.692307692307693', '8'], a: 1, ex: '/ 是真除法，结果是小数（float）。' },
        { q: 'print(100 // 13) 输出什么？', opts: ['7', '7.69', '7.5'], a: 0, ex: '// 向下取整。本题均为正数，所以 100 // 13 = 7；负数不能直接丢掉小数。' },
        { q: 'print(2 ** 3) 输出什么？', opts: ['6', '8', '9'], a: 1, ex: '** 是乘方：2³ = 8。' },
      ],
    },

    /* ================= 关卡 2 大课间数据局（sum/len/min/max）· 教学楼·中楼一层教室 ================= */
    {
      id: 2, name: '大课间数据局', pos: [-43.5, -14], door: [-40.2, -14], color: 0x35b06a,
      room: '②号编程教室（教学楼·中楼一层）', teacher: '邓老师',
      papers: [[-10, -40], [38, 8], [-24, -55]],      // 先收集 3 张成绩单才解锁（多元化：跑腿收集）
      story: '体育老师的成绩单被风吹散了三张！先在校园里把它们捡回来（跟着光柱走），再到教学楼·中楼的②号编程教室做报表。',
      card: '【知识卡 · 统计四函数】\nsum(列表) 求和 · len(列表) 个数 · max(列表) 最大值 · min(列表) 最小值\n平均数 = sum(列表) / len(列表)\nscores = [' + S2.join(', ') + ']（本次班级成绩）',
      tasks: [
        {
          id: '2-1', title: '全班总数', teach: 'sum() 一行算总和',
          brief: '算出全班跳绳总数 total 并打印。',
          pre: `scores = [${S2.join(', ')}]`,
          tiers: ['total = ___(scores)\nprint(total)',
                  'total = sum(scores)\nprint(___)',
                  '# scores 已给出：算全班总数并打印\n\n'],
          ops: ['sum', 'len', 'max', 'min', 'total'],
          check: lines => hasVal(lines, S2.reduce((a, b) => a + b, 0)) ? { pass: true } : { pass: false, hint: `期望 ${S2.reduce((a, b) => a + b, 0)}。求和用 sum(scores)。` },
          anim: 'bars',
        },
        {
          id: '2-2', title: '参赛人数', teach: 'len() 数个数',
          brief: '算出参赛人数 n 并打印。',
          pre: `scores = [${S2.join(', ')}]`,
          tiers: ['n = ___(scores)\nprint(n)',
                  'n = len(scores)\nprint(___)',
                  '# 算参赛人数并打印\n\n'],
          ops: ['len', 'sum', 'min', 'n'],
          check: lines => hasVal(lines, S2.length) ? { pass: true } : { pass: false, hint: `期望 ${S2.length}。数个数用 len(scores)。` },
          anim: 'bars',
        },
        {
          id: '2-3', title: '平均成绩', teach: 'sum/len 组合出平均（复习关卡1除法）',
          brief: '算出平均成绩 avg 并打印（会是小数——想想为什么）。',
          pre: `scores = [${S2.join(', ')}]`,
          tiers: ['avg = sum(scores) ___ len(scores)\nprint(avg)',
                  'avg = ___(scores) / ___(scores)\nprint(avg)',
                  '# 算平均成绩并打印\n\n'],
          ops: ['sum', 'len', 'max', 'min', '/'],
          check: lines => hasVal(lines, S2.reduce((a, b) => a + b, 0) / S2.length, 0.01) ? { pass: true } : { pass: false, hint: `期望约 ${(S2.reduce((a, b) => a + b, 0) / S2.length).toFixed(2)}。平均 = sum(scores) / len(scores)。` },
          anim: 'avg',
        },
        {
          id: '2-4', title: '冠军与进步', teach: 'max/min 找极值',
          brief: '一行打印冠军成绩和最需要加油的成绩（空格隔开）：先 max 后 min。',
          pre: `scores = [${S2.join(', ')}]`,
          tiers: ['print(___(scores), ___(scores))',
                  'best = max(scores)\nleast = min(scores)\nprint(___, ___)',
                  '# 一行打印 max 和 min\n\n'],
          ops: ['max', 'min', 'sum', 'best', 'least'],
          check: lines => {
            const l = lines[lines.length - 1] || '';
            const ns = numbers(lines);
            return (ns.length === 2 && ns[0] === Math.max(...S2) && ns[1] === Math.min(...S2))
              ? { pass: true } : { pass: false, hint: `期望 ${Math.max(...S2)} 和 ${Math.min(...S2)}（先 max 后 min）。` };
          },
          anim: 'bars',
        },
        {
          id: '2-5', title: '及格人数之谜', teach: '制造需求：不用循环数到累',
          type: 'narrative',
          brief: '老师又问：八份成绩（模拟的立定跳远厘米数）里，不低于 180 的有几人？你只能一张一张核对，数完还要复查一遍。名单变成 80 人、800 人呢？这种重复的核对，正是下一关 while 循环要替你做的事。完成本区小测并交作业后，进入循环教学区学习 while。',
          check: () => ({ pass: true }), anim: 'hint-next',
        },
      ],
      quiz: [
        { q: 'len([3, 1, 4, 1, 5]) 的结果是？', opts: ['4', '5', '14'], a: 1, ex: 'len 数的是元素个数。' },
        { q: 'sum([2, 3, 5]) 的结果是？', opts: ['3', '10', '5'], a: 1, ex: 'sum 把所有元素加起来。' },
        { q: 'max(4, 9, 1) 的结果是？', opts: ['1', '4', '9'], a: 2, ex: 'max 取最大值。' },
      ],
    },

    /* ================= 关卡 3 操场无限循环（while）· 综合楼一层机房 ================= */
    {
      id: 3, name: '操场无限循环', pos: [-42.5, 62], door: [-39.7, 62], color: 0xe8a13c,
      room: '③号编程机房（综合楼一层）', teacher: '张守安',
      story: '综合楼一层的机房里有一台"训练控制台"（需先提交①②关作业解锁）。教练说：跳绳队要练到全队累计 500 个，总不能手写 500 行吧？念出循环咒语——while！',
      card: '【知识卡 · while 三要素】\n初始化：i = 1（出发前定好起点）\n条件：while i <= 10:（满足才继续跳）\n更新：i += 1（每跳一次 +1，别忘了！忘了就是死循环）\nwhile 条件:\n    循环体（缩进 4 格）',
      tasks: [
        {
          id: '3-1', title: '计数循环', teach: 'while 基本结构：让 NPC 跳 10 次',
          brief: '让运动员跳跃 10 次，每次把序号传给 jump(i)。jump 是本课程提供的模型指令，不是 Python 内置函数，无需自己定义。运行后 3D 里会照着你的循环逐次表演！',
          pre: ACTS_PRE + '\ncount = 10', suffix: ACTS_SUF,
          tiers: ['i = 1\nwhile i ___ 10:\n    jump(i)\n    i += 1',
                  'i = 1\nwhile i <= 10:\n    ___\n    ___',
                  '# 用 while 跳 10 次，每次 jump(i)\n\n'],
          ops: ['<=', '<', '+=', '-=', '1', '10', 'jump(i)', 'i += 1'],
          check: (lines, out) => {
            const a = parseActs(out);
            if (a && a.length === 10 && a.every((v, k) => v === k + 1)) return { pass: true, acts: a };
            if (a && a.length === 0) return { pass: false, hint: '一次都没跳：条件一开始就不成立。检查 i 的起点和 <= 方向。' };
            if (a && a.length > 10) return { pass: false, hint: `跳了 ${a.length} 次停不下来——条件或更新写错了。` };
            return { pass: false, hint: '期望 jump(1) 到 jump(10) 恰好 10 次。模板：i=1 起步、while i<=10、循环里 i += 1。' };
          },
          anim: 'acts-jump',
        },
        {
          id: '3-2', title: '累加循环', teach: '未达标才继续：total < target；每轮 total += per_round',
          brief: '累计目标 target = 500 个，每轮增加 per_round = 60 个。用 while 在 total < target 时继续；达到或超过目标立即停止。每轮调用一次 jump()（不带参数），模型的一次动作代表一轮。请使用给定变量：系统还会检查 target = 480 等恰好达标的情况。',
          pre: ACTS_PRE + '\ntarget = 500\nper_round = 60', displayPre:'已提供 jump()：一次指令代表一轮训练。\ntarget = 500\nper_round = 60', suffix: ACTS_SUF,
          tiers: ['total = 0\nwhile total ___ target:\n    total += per_round\n    jump()',
                  'total = 0\nwhile total < target:\n    total ___ per_round\n    jump()',
                  '# target、per_round 已给出。total 从 0 开始。\n# 未达标时每轮增加 per_round 并 jump()；达到或超过 target 就停。\n\n'],
          ops: ['<', '<=', '>', '+='],
          check: (lines, out) => {
            const a = parseActs(out);
            if (a && a.length === 9 && a.every(n=>n===0) && Number(out.match(/TOTAL:([^\n]+)/)?.[1])===540) return { pass: true, acts: a };
            if (a && a.length === 8) return { pass: false, hint: '本次只有 8 次训练指令；每轮 60 时累计应为 480，还未达到 500。累计 480 时还差 20，应继续第 9 轮。每轮都更新 total、调用 jump()。' };
            if (a && a.length > 9) return { pass: false, hint: `本次执行了 ${a.length} 轮；本题第 9 轮累计 540 时已首次达标，后面不应继续。首次超过 500 是正确停止，不是错误；检查条件和每轮更新。` };
            return { pass: false, hint: '期望恰好 9 轮（60×9=540 ≥ 500），每轮 jump() 不带参数。' };
          },
          anim: 'acts-total',
        },
        {
          id: '3-3', title: '死循环陷阱', teach: '无限循环的成因与修复',
          brief: '先观察错误示例：i 从 1 开始，却一直不增加，所以运动员反复做第 1 次动作。然后补上让 i 前进的更新语句，让它依次跳 1 到 5 次并停下。',
          wrongExample: 'i = 1\nwhile i <= 5:\n    jump(i)\n    # 忘记更新 i，永远停在第 1 次',
          pre: ACTS_PRE + '\ncount = 5', suffix: ACTS_SUF, allowTimeout: true,
          tiers: ['i = 1\nwhile i <= 5:\n    jump(i)\n    i += ___',
                  'i = 1\nwhile i <= 5:\n    jump(i)\n    ___',
                  '# 修好它：跳 5 次\n\n'],
          ops: ['1', 'i += 1', 'break', 'print(i)'],
          check: (lines, out) => {
            const a = parseActs(out);
            if (a && a.length === 5 && a.every((v, k) => v === k + 1)) return { pass: true, acts: a };
            return { pass: false, hint: '还没修好。死循环的原因：忘了让 i 前进——循环体里要有 i += 1。' };
          },
          anim: 'deadloop',
        },
        {
          id: '3-4', title: '毕业挑战', teach: '三关知识合体：while 遍历 + 统计',
          brief: `成绩单 scores = [${S3.join(', ')}]。① total 和 i 都从 0 开始。② 用 while 逐个查看 scores[i]，把本次成绩加到原来的 total 上。③ 每次让 i 加 1。④ 用累加得到的 total 算平均数，一行打印总数、平均数、最低成绩 min(scores)。`,
          pre: `scores = [${S3.join(', ')}]`, suffix: '',
          tiers: ['total = 0\ni = 0\nwhile i ___ len(scores):\n    total += scores[i]\n    i += 1\nprint(total, total / len(scores), min(scores))',
                  'total = 0\ni = 0\nwhile i < ___:\n    total += scores[___]\n    ___ += 1\nprint(total, total / len(scores), min(scores))',
                  '# while 遍历 scores：算 total\n# 一行打印：total、平均、min(scores)\n\n'],
          ops: ['<', '<=', 'len(scores)', 'i', 'total'],
          check: lines => {
            const l = lines[lines.length - 1] || '';
            const ns = numbers(lines);
            const sum = S3.reduce((a, b) => a + b, 0), avg = sum / S3.length, mn = Math.min(...S3);
            if (ns.length === 3 && near(ns[0], sum) && near(ns[1], avg, 0.01) && near(ns[2], mn)) return { pass: true };
            return { pass: false, hint: `期望 ${sum}、约${avg.toFixed(2)}、${mn}（总数 平均 最小，空格隔开）。用 while 累加，别直接 sum()！` };
          },
          anim: 'graduate',
        },
        {
          id:'3-5',title:'for 巡回训练',teach:'for 逐站执行；range 的终点不包含在内。',
          brief:'操场有 count 个训练站，编号从 1 开始。用 for 按顺序巡回，每到一站调用 train(station)。不遗漏、不重复，到第 count 站后结束。站点数为 0 时不做动作；系统还会换站点数复核。',
          pre:TRAIN_PRE,displayPre:'count = 5\n已提供 train(station)：到编号 station 的训练站做一次动作。',suffix:ACTS_SUF,
          card:'for station in range(1, count + 1):\n    train(station)\nrange 不包含终点，所以终点写 count + 1。每一轮 station 自动变成下一个站号，不用自己加 1。',
          tiers:['for station in range(1, ___):\n    train(station)','for station in range(1, count + 1):\n    ___','# count 和 train(station) 已给出。\n# 用 for 从第 1 站训练到第 count 站，每站一次。\n'],
          ops:['count + 1','count','train(station)','range','for'],requiresFor:true,
          check:(lines,out)=>{
            const acts=parseActs(out),onlyActions=out.trim().split('\n').length===1&&out.trim().startsWith('ACTS:');
            if(onlyActions&&acts?.length===5&&acts.every((n,i)=>n===i+1))return {pass:true,acts};
            return {pass:false,acts:acts||[],hint:'应按顺序训练第 1、2、3、4、5 站，每站一次。请使用 count，range 的终点不包含在内。'};
          },anim:'acts-train',
        },
      ],
      quiz: [
        { q: 'i = 0，while i < 3 每轮 i += 1，循环体执行几次？', opts: ['2 次', '3 次', '4 次'], a: 1, ex: 'i 取 0、1、2，条件成立 3 次；更新到 3 后退出。' },
        { q: '死循环最常见的原因是？', opts: ['忘了写更新语句', '用了英文冒号', '变量名太长'], a: 0, ex: '计数器不前进，条件永远成立。' },
        { q: 'while 4 < 3: 循环体会执行几次？', opts: ['0 次', '1 次', '4 次'], a: 0, ex: '条件一开始就是 False，一次都不执行。' },
      ],
    },
  ];
  const tasks = window.PY_LEVELS.flatMap(l => l.tasks);
  tasks.find(t => t.id === '1-4').tests = [
    { pre: 'team = 36\nsize = 6', expected: ['6 0 True'] },
    { pre: 'team = 40\nsize = 6', expected: ['6 4 False'] },
    { pre: 'team = 24\nsize = 8', expected: ['3 0 True'] },
    { pre: 'team = 23\nsize = 4', expected: ['5 3 False'] },
  ];
  tasks.find(t => t.id === '3-2').suffix += "\nprint('TOTAL:' + str(total))";
  const get=id=>tasks.find(t=>t.id===id);
  for(const id of ['1-1','1-2'])get(id).tests=[10,16,12.5].map(time=>({pre:`time = ${time}`,expected:[String(id==='1-1'?100/time:Math.floor(100/time))],numeric:true,hint:`请使用给定的 time。time = ${time} 时也须正确计算，只打印一个结果。`}));
  get('1-2').process='floor';
  // 本题知识卡：仅保留当前任务用到的概念；双步骤与 for 课沿用各自专用卡。
  get("1-1").card = "【本题知识卡 · 跳绳频率】\n/：真除法，总下数 ÷ 用时。\nfloat 是带小数点的数；100 / 13 的结果约为 7.6923076923。\nfreq 保存每秒跳绳频率，time 是用时；print(freq) 打印计算结果，不手动取整。";
  get("1-2").card = "【本题知识卡 · 整数商】\n//：向下取整，得到整数商。\n本题都是正数，100 // 13 得到 7。\n使用给定 time 计算 speed，再 print(speed)。";
  get("1-4").card = "【本题知识卡 · 分组判断】\n//：整除，算组数——45 // 6 = 7 组。\n%：取余，算剩余——45 % 6 = 3 人。\nand：两边都成立，结果才是 True。\nfull = left == 0 and groups >= 1 判断是否正好分完；按顺序打印 groups、left、full。";
  get("2-1").card = "【本题知识卡 · 求总数】\nsum(scores)：把成绩列表里的每个数加起来。\ntotal 保存总数；print(total) 输出总数。" + '\n本次数据：' + get("2-1").pre + '\n列表：用方括号创建、逗号分隔元素，例 scores = [86, 90, 78]；这一关的 scores 就是一个列表。';
  get("2-2").card = "【本题知识卡 · 数人数】\nlen(scores)：数列表里有几条记录。\n重复的成绩也分别计数；n 保存人数，print(n) 输出人数。" + '\n本次数据：' + get("2-2").pre + '\n追加 append：scores.append(95) 会把 95 追加到列表末尾，列表长度加 1；len 数的是全部元素。';
  get("2-3").card = "【本题知识卡 · 求平均】\nsum(scores)：总成绩；len(scores)：人数。\n平均数 = 总成绩 / 人数；/ 是真除法，平均数可以有小数。\navg 保存平均数，print(avg) 输出结果。" + '\n本次数据：' + get("2-3").pre + '\n保留小数 round：round(x, 2) 把 x 四舍五入保留 2 位小数，例 round(7.6923, 2) = 7.69。';
  get("2-4").card = "【本题知识卡 · 找极值】\nmax(scores)：最大成绩；min(scores)：最小成绩。\n一行打印两个数：先最大值，后最小值。\n相同成绩属于不同记录，不能删掉。" + '\n本次数据：' + get("2-4").pre;
  get("2-5").card = "【本题知识卡 · 逐张判断】\nscores[i]：第 i 个索引位置的成绩，索引从 0 开始。\n>= 180：成绩达到或超过 180。\n逐张判断，不遗漏同分同学；名单变长时，可以用循环重复检查。";
  get("3-1").card = "【本题知识卡 · 计数循环】\n初始化：i = 1。\n条件：while i <= 10:，包含第 10 次。\n循环体缩进 4 格：jump(i) 执行动作，i += 1 更新序号。\njump 是本课提供的模型指令。";
  get("3-2").card = "【本题知识卡 · 累加到目标】\ntotal = 0：累计值从 0 开始。\nwhile total < target:：未达标才继续，达到或超过就停止。\n每轮 total += per_round，再调用一次 jump()；循环体缩进 4 格。\njump() 是本课提供的训练指令。";
  get("3-3").card = "【本题知识卡 · 修复死循环】\ni = 1：从第 1 次开始；while i <= 5: 包含第 5 次。\n循环内 jump(i) 后要 i += 1，才能让条件最终不成立。\n循环体缩进 4 格；print(i) 只打印，不会改变 i。";
  get("3-4").card = "【本题知识卡 · 逐项统计】\ni = 0、total = 0：索引和累计值从 0 开始。\nwhile i < len(scores):：索引小于记录条数才继续。\n循环体缩进 4 格：total += scores[i]，然后 i += 1。\n平均数 = total / len(scores)；min(scores) 求最低成绩。\n一行依次打印 total、平均数、最低成绩。" + '\n本次数据：' + get("3-4").pre;
  // Legacy campus panel now mirrors the classroom: single % output only (routes step removed 2026-10-17).
  get('1-3').tests=[0,50,51,150].map(swim=>({pre:`pool = 50\nswim = ${swim}`,expected:[`${swim%50}`],numeric:true,hint:'本趟已游 = swim % pool，在端点时为 0。'}));
  for(const id of ['2-1','2-2','2-3','2-4','3-4'])get(id).tests=[[0,3,3,8,1],[7],[10,0,10,2]].map(scores=>{
    const sum=scores.reduce((a,b)=>a+b,0),avg=sum/scores.length,mn=Math.min(...scores),mx=Math.max(...scores);
    const answer=({'2-1':[sum],'2-2':[scores.length],'2-3':[avg],'2-4':[mx,mn],'3-4':[sum,avg,mn]})[id];
    return {pre:`scores = [${scores}]`,expected:[answer.join(' ')],numeric:true,hint:`换一份成绩单 [${scores}] 也要正确。保留重复值与 0，只打印题目要求的结果。`};
  });
  get('3-2').tests=[[480,60],[500,60],[120,60],[0,60],[125,25]].map(([target,per])=>{
    const rounds=Math.ceil(target/per);
    return {trace:true,target,perRound:per,pre:ACTS_PRE+`\ntarget = ${target}\nper_round = ${per}`,expected:[`ACTS:[${Array(rounds).fill(0).join(', ')}]`,`TOTAL:${rounds*per}`],hint:`目标 ${target}，每轮 ${per}：应执行 ${rounds} 轮，累计 ${rounds*per}。未达标才继续；达到或首次超过目标立即停止。`};
  });
  get('3-5').tests=[0,1,3,5,7].map(count=>({acts:true,pre:TRAIN_PRE.replace('count = 5',`count = ${count}`),expected:[`ACTS:[${Array.from({length:count},(_,i)=>i+1).join(', ')}]`],hint:`站点数 count = ${count} 时，应依次训练 ${count?'1 到 '+count+' 站':'0 站（不做动作）'}，每站恰好一次。`}));
  window.PY_GRADING={
    boundaryHint(task,code,result,test){
      if(task.id!=='3-2')return test.hint||'换一组数据后不成立，请使用题目变量。';
      // Hints only; do not use token presence as a grading requirement.
      const source=code.replace(/'''[\s\S]*?'''|"""[\s\S]*?"""|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|#[^\n]*/g,' ');
      const missing=['target','per_round'].filter(name=>!new RegExp('\\b'+name+'\\b').test(source));
      const acts=parseActs(result.out||''),actualTotal=Number((result.out||'').match(/TOTAL:([^\n]+)/)?.[1]);
      const actual=acts?`本次实际 ${acts.length} 轮${Number.isFinite(actualTotal)?`，累计 ${actualTotal}`:''}。`:'';
      let advice=missing.length?`代码没有读取给定的 ${missing.join('、')}。不要把目标或轮数写死；换数据后需要的轮数可能变化。`:'';
      if(!advice&&test.target===0)advice='目标为 0 时，初始 total 已达标，应一次也不执行。检查是否在判断之前就训练了。';
      if(!advice&&acts?.length>Math.ceil(test.target/test.perRound))advice='实际多执行了训练指令。检查条件与每轮更新；如果使用 <=，恰好达到目标后还会多执行一轮。';
      if(!advice)advice='核对每轮是否加上 per_round 并只调用一次 jump()，再根据 total 与 target 判断下一轮。';
      return [test.hint,actual,advice].filter(Boolean).join(' ');
    },
    testMatches(out,test){if(test.acts)return out.trim().split('\n').length===1&&out.trim().startsWith('ACTS:')&&JSON.stringify(parseActs(out))===JSON.stringify(parseActs(test.expected[0]));if(test.trace){const actual=out.trim().split('\n');return actual.length===2&&JSON.stringify(parseActs(out))===JSON.stringify(parseActs(test.expected[0]))&&Number(actual[1].replace(/^TOTAL:/,''))===Number(test.expected[1].slice(6));}const lines=out.split('\n').map(s=>s.trim()).filter(Boolean);return test.numeric?numericOutput(lines,test.expected[0].split(/\s+/).map(Number)):out.trim()===test.expected.join('\n');},
    processCheck(t,r){
      if(t.process==='floor'&&!r.process?.floor)return {pass:false,hint:'本题练习 // 向下取整，请实际使用 // 计算。'};
      if(t.requiresWhile&&!(t.id==='3-4'?r.process?.whileScores:r.process?.whileJump||r.process?.whileJumpEmpty))return {pass:false,hint:t.id==='3-4'?'请在 while 中把本次 scores[i] 加到旧总数上，再用这个累计总数打印总数和平均数；忽略旧总数或改用 sum() 输出都不算完成。':'本题需要实际用 while 调用 jump；写在注释、字符串或不执行的分支里不算完成。'};
      if(t.requiresFor&&!(r.process?.forTrain||r.process?.forTrainEmpty))return {pass:false,hint:'请实际用 for 逐站调用 train(station)。空循环、while 代替、直接改 ACTS 都不算完成；count 为 0 时到达 for 后不做动作是正确的。'};
      return null;
    }
  };
  for (const id of ['3-1','3-2','3-3','3-4']) get(id).requiresWhile = true;
})();
