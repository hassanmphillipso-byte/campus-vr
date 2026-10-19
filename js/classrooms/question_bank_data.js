// 扩充题库（v3，2026-10-13 老师审阅版）：93 题（原 105 删 12——逻辑/缩进约定/三要素术语/死循环修法/2**5 填空/补 0 编程/索引累加）。
// 题型配比随删微调；保留知识点不变。
// 数值题带 verify（CPython 对拍用）；code 题的 solve/expect 由测试真跑核对。
// 语境沿用校园运动场景：训练球、跑道、积分卡、游泳里程、巡检航线。

export const KNOWLEDGE_POINTS=[
  {lv:1,kp:'print',label:'print 输出'},
  {lv:1,kp:'div',label:'真除法 /'},
  {lv:1,kp:'floor',label:'整除 //'},
  {lv:1,kp:'mod',label:'取余 %'},
  {lv:1,kp:'pow',label:'乘方 **'},
  {lv:1,kp:'cmp',label:'比较运算'},
  {lv:1,kp:'logic',label:'逻辑 and/or/not'},
  {lv:2,kp:'sum',label:'sum 求和'},
  {lv:2,kp:'len',label:'len 计数'},
  {lv:2,kp:'maxmin',label:'max / min'},
  {lv:2,kp:'avg',label:'平均数 sum/len'},
  {lv:2,kp:'list',label:'列表 [ ]'},
  {lv:2,kp:'round',label:'round 保留两位'},
  {lv:2,kp:'append',label:'append 追加'},
  {lv:3,kp:'while3',label:'while 三要素'},
  {lv:3,kp:'bound',label:'边界 < 与 <='},
  {lv:3,kp:'inf',label:'死循环排查'},
  {lv:3,kp:'acc',label:'累加器 +='},
  {lv:3,kp:'wlist',label:'while 遍历列表'},
  {lv:3,kp:'forrange',label:'for + range'},
  {lv:3,kp:'indent',label:'缩进归属'},
];

// 知识点解锁门槛（老师反馈"没教过就考"）：键=知识点，值=教学教室 id；
// 学生存档 save.tasks 里没有该教室完成记录时，抽题跳过这个知识点。
// logic/cmp 在 1-4 分组判定室教学；round/list/append 已在对应教室任务知识卡补教
//（2-1 列表、2-2 append、2-3 round，由并行改动落地），未完成该教室前抽题同样跳过。
// 教学插入位置待老师复核。
export const KP_GATES={logic:'1-4',cmp:'1-4',list:'2-1',append:'2-2',round:'2-3'};

const c=(id,kp,dif,title,code,opts,a,ex,verify)=>({id,lv:Number(id[1]),kp,dif,type:'choice',title,code,opts,a,ex,...(verify?{verify}:{})});
const t=(id,kp,dif,title,code,a,ex,verify)=>({id,lv:Number(id[1]),kp,dif,type:'tf',title,code,opts:['成立','不成立'],a,ex,...(verify?{verify}:{})});
const b=(id,kp,dif,title,code,answer,accept,ex,verify,extra={})=>({id,lv:Number(id[1]),kp,dif,type:'blank',title,code,answer,accept,ex,...(verify?{verify}:{}),...extra});
const k=(id,kp,dif,title,task,starter,solve,expect,ex,extra={})=>({id,lv:Number(id[1]),kp,dif,type:'code',title,task,starter,solve,expect,ex,...extra});

export const POOL=[
// ---------- 关卡1 · print 输出 ----------
c('B101','print',1,'print(3 + 5) 输出什么？','print(3 + 5)',['8','35','3 + 5'],0,'print 先算出表达式的结果，再输出：3 + 5 = 8。',[{code:'print(3 + 5)',expect:'8'}]),
t('B102','print',1,'print(2 * 4) 会输出 8。','print(2 * 4)',0,'print 会先求值：2 × 4 = 8，然后输出 8。',[{code:'print(2 * 4)',expect:'8'}]),
b('B103','print',2,'print(12 - 5) 的输出是 ___','print(12 - 5)','7',['7'],'先算 12 − 5 = 7，print 输出运算结果。',[{code:'print(12 - 5)',expect:'7'}]),
b('B104','print',2,'print(6 * 7) 的输出是 ___','print(6 * 7)','42',['42'],'6 × 7 = 42，print 输出这个结果。',[{code:'print(6 * 7)',expect:'42'}]),
k('B105','print',2,'输出总和','在电脑上写一行代码，用 print 输出 123 与 456 的和。','# 写出你的代码\n','# 写出你的代码\nprint(123 + 456)','579','print 括号里可以写算式：print(123 + 456) 会先算再输出 579。',{require:{calls:['print'],ops:['Add']}}),

// ---------- 关卡1 · 真除法 / ----------
c('B111','div',1,'print(10 / 4) 输出什么？','print(10 / 4)',['2.5','2','2.50'],0,'/ 是真除法，结果是 2.5；不会取整，也不会补零。',[{code:'print(10 / 4)',expect:'2.5'}]),
t('B112','div',1,'print(9 / 3) 输出 3.0 而不是 3。','print(9 / 3)',0,'/ 的结果是小数类型，即使除尽也是 3.0。',[{code:'print(9 / 3)',expect:'3.0'}]),
b('B113','div',2,'print(7 / 2) 的输出是 ___','print(7 / 2)','3.5',['3.5'],'/ 保留小数：7 ÷ 2 = 3.5。',[{code:'print(7 / 2)',expect:'3.5'}]),
b('B114','div',3,'print(100 / 8) 的输出是 ___','print(100 / 8)','12.5',['12.5'],'100 ÷ 8 = 12.5，/ 不取整。',[{code:'print(100 / 8)',expect:'12.5'}]),
k('B115','div',2,'计算平均速度','跑道 50 米用了 8 秒。把速度 = 距离 / 时间 存进变量 speed，再用 print 输出。','distance = 50\ntime = 8\n# 计算 speed 并输出\n','distance = 50\ntime = 8\nspeed = distance / time\nprint(speed)','6.25','用 / 计算：50 / 8 = 6.25，结果是小数。',{cases:[{pre:'distance = 100\ntime = 4',expect:'25.0'},{pre:'distance = 60\ntime = 8',expect:'7.5'}],require:{ops:['Div']}}),

// ---------- 关卡1 · 整除 // ----------
c('B121','floor',1,'print(100 // 13) 输出什么？','print(100 // 13)',['7.69','7','8'],1,'// 取完整份数：100 里最多有 7 个 13（7 × 13 = 91）。',[{code:'print(100 // 13)',expect:'7'}]),
t('B122','floor',2,'print(17 // 5) 与 print(17 / 5) 的输出相同。','print(17 // 5)\nprint(17 / 5)',1,'// 输出 3，/ 输出 3.4，两者不同。',[{code:'print(17 // 5)',expect:'3'},{code:'print(17 / 5)',expect:'3.4'}]),
b('B123','floor',2,'print(22 // 4) 的输出是 ___','print(22 // 4)','5',['5'],'22 里最多有 5 个 4（5 × 4 = 20），// 取 5。',[{code:'print(22 // 4)',expect:'5'}]),
b('B124','floor',3,'87 个训练球分给 12 组，每组最多几个（87 // 12）？','87 // 12','7',['7'],'12 × 7 = 84 ≤ 87，再每组加 1 就不够，所以每组 7 个。',[{code:'print(87 // 12)',expect:'7'}]),
k('B125','floor',2,'分组训练球','45 个训练球平均分给 6 组。用 // 计算每组能分到几个，并输出。','# 用 // 计算并输出\n','# 用 // 计算并输出\nprint(45 // 6)','7','45 // 6 = 7：每组 7 个，还剩 3 个（45 % 6 = 3）。',{require:{calls:['print'],ops:['FloorDiv']}}),

// ---------- 关卡1 · 取余 % ----------
c('B131','mod',1,'print(100 % 13) 输出什么？','print(100 % 13)',['7','9','13'],1,'13 × 7 = 91，100 − 91 = 9；余数一定小于除数。',[{code:'print(100 % 13)',expect:'9'}]),
t('B132','mod',2,'print(15 % 4) 输出 3。','print(15 % 4)',0,'4 × 3 = 12，15 − 12 = 3，余数是 3。',[{code:'print(15 % 4)',expect:'3'}]),
b('B133','mod',2,'print(38 % 5) 的输出是 ___','print(38 % 5)','3',['3'],'5 × 7 = 35，38 − 35 = 3。',[{code:'print(38 % 5)',expect:'3'}]),
b('B134','mod',3,'53 个球分 7 组、每组 7 个后，53 % 7 剩下 ___ 个','53 % 7','4',['4'],'7 × 7 = 49，53 − 49 = 4。',[{code:'print(53 % 7)',expect:'4'}]),
k('B135','mod',2,'清点剩余','81 个训练球分给 8 组。用 % 算出分不完的剩余球数，并输出。','# 用 % 计算剩余并输出\n','# 用 % 计算剩余并输出\nprint(81 % 8)','1','8 × 10 = 80，81 % 8 = 1，剩 1 个。',{require:{calls:['print'],ops:['Mod']}}),

// ---------- 关卡1 · 乘方 ** ----------
c('B141','pow',1,'print(2 ** 4) 输出什么？','print(2 ** 4)',['8','16','6'],1,'** 表示乘方：2 的 4 次方 = 2 × 2 × 2 × 2 = 16，不是 2 × 4。',[{code:'print(2 ** 4)',expect:'16'}]),
t('B142','pow',2,'print(3 ** 2) 输出 6。','print(3 ** 2)',1,'3 ** 2 是 3 的 2 次方 = 9；** 不是乘法。',[{code:'print(3 ** 2)',expect:'9'}]),
b('B143','pow',2,'print(5 ** 2) 的输出是 ___','print(5 ** 2)','25',['25'],'5 的 2 次方 = 25。',[{code:'print(5 ** 2)',expect:'25'}]),
k('B145','pow',2,'路线扩张','巡检航线每次分成 3 条，共分 4 次。用 ** 计算 3 的 4 次方并输出。','# 用 ** 计算并输出\n','# 用 ** 计算并输出\nprint(3 ** 4)','81','3 ** 4 = 3 × 3 × 3 × 3 = 81。',{require:{calls:['print'],ops:['Pow']}}),

// ---------- 关卡1 · 比较运算 ----------
c('B151','cmp',1,'print(7 > 2) 输出什么？','print(7 > 2)',['True','False','7'],0,'比较的结果是 True（成立）或 False（不成立）。7 > 2 成立，输出 True。',[{code:'print(7 > 2)',expect:'True'}]),
t('B152','cmp',2,'print(5 == 5) 输出 False。','print(5 == 5)',1,'== 判断两边是否相等，5 等于 5 成立，输出 True。',[{code:'print(5 == 5)',expect:'True'}]),
b('B153','cmp',2,'print(4 >= 9) 的输出是 ___','print(4 >= 9)','False',['False','false'],'4 >= 9 不成立，输出 False。',[{code:'print(4 >= 9)',expect:'False'}]),
b('B154','cmp',3,'print(12 != 8) 的输出是 ___','print(12 != 8)','True',['True','true'],'!= 判断不相等：12 不等于 8，成立，输出 True。',[{code:'print(12 != 8)',expect:'True'}]),
k('B155','cmp',2,'达标判断','成绩线是 60 分，score = 60。输出 score >= 60 的判断结果。','score = 60\n# 输出 score >= 60 的结果\n','score = 60\nprint(score >= 60)','True','print(score >= 60) 输出比较结果：60 ≥ 60 成立（>= 包含等于），是 True。',{cases:[{pre:'score = 59',expect:'False'},{pre:'score = 75',expect:'True'}],require:{ops:['GtE']}}),

// ---------- 关卡1 · 逻辑 and/or/not ----------
b('B164','logic',3,'print(75 >= 60 and 6 > 7) 的输出是 ___','print(75 >= 60 and 6 > 7)','False',['False','false'],'75 >= 60 是 True，6 > 7 是 False；and 两边都要真，结果是 False。',[{code:'print(75 >= 60 and 6 > 7)',expect:'False'}]),
k('B165','logic',3,'入队核验','入队要同时满足：年龄 age ≥ 10 且训练分超过 80（score > 80）。用 and 连接两个条件并输出结果。','age = 11\nscore = 80\n# 用 and 连接两个条件并输出\n','age = 11\nscore = 80\nprint(age >= 10 and score > 80)','False','年龄 11 >= 10 成立；训练分刚好 80，80 > 80 不成立：True and False = False（边界值，写成 >= 80 会误得 True）。',{cases:[{pre:'age = 9\nscore = 95',expect:'False'},{pre:'age = 12\nscore = 81',expect:'True'}],require:{ops:['And']}}),

// ---------- 关卡2 · sum ----------
c('B201','sum',1,'total = sum([2, 3, 5]) 后 print(total) 输出什么？','total = sum([2, 3, 5])\nprint(total)',['3','10','5'],1,'先把求和结果存进 total，再打印 total：2 + 3 + 5 = 10。',[{code:'total = sum([2, 3, 5])\nprint(total)',expect:'10'}]),
t('B202','sum',1,'print(sum([4, 0, 6])) 输出 10。','print(sum([4, 0, 6]))',0,'0 分也是一次记录，加进去总值不变：4 + 0 + 6 = 10。',[{code:'print(sum([4, 0, 6]))',expect:'10'}]),
b('B203','sum',2,'total = sum([4, 0, 6]) 后 print(total) 的输出是 ___','total = sum([4, 0, 6])\nprint(total)','10',['10'],'0 分也参与求和：4 + 0 + 6 = 10，存进 total 后打印。',[{code:'total = sum([4, 0, 6])\nprint(total)',expect:'10'}]),
b('B204','sum',3,'三次投篮得分 3、0、5，sum([3, 0, 5]) = ___','print(sum([3, 0, 5]))','8',['8'],'0 分出手也保留在名单里：3 + 0 + 5 = 8。',[{code:'print(sum([3, 0, 5]))',expect:'8'}]),
k('B205','sum',2,'统计总分','积分卡 scores = [5, 2, 7]。用 sum 输出总分。','scores = [5, 2, 7]\n# 用 sum 输出总分\n','scores = [5, 2, 7]\nprint(sum(scores))','14','sum(scores) = 5 + 2 + 7 = 14。',{cases:[{pre:'scores = [1, 2, 3]',expect:'6'},{pre:'scores = [10, 0, 5]',expect:'15'}],require:{calls:['sum']}}),

// ---------- 关卡2 · len ----------
c('B211','len',1,'print(len([2, 2, 5])) 输出什么？','print(len([2, 2, 5]))',['2','3','9'],1,'len 数记录的条数：两张 2 是两条独立记录，共 3 条。',[{code:'print(len([2, 2, 5]))',expect:'3'}]),
t('B212','len',1,'print(len([0, 0, 0, 0])) 输出 4。','print(len([0, 0, 0, 0]))',0,'len 只数条数，不看数值大小；0 也占一条。',[{code:'print(len([0, 0, 0, 0]))',expect:'4'}]),
b('B213','len',2,'print(len([3, 1, 4, 1, 5])) 的输出是 ___','print(len([3, 1, 4, 1, 5]))','5',['5'],'5 个元素，其中两个 1 各算一条。',[{code:'print(len([3, 1, 4, 1, 5]))',expect:'5'}]),
b('B214','len',3,'登记表原有 5 条记录，append(0) 之后再 len，共 ___ 条','5 条记录 append(0) 后','6',['6'],'追加一条后条数加 1：5 + 1 = 6。'),
k('B215','len',2,'清点出手次数','出手记录 shots = [2, 0, 3, 0, 2]。输出记录的条数。','shots = [2, 0, 3, 0, 2]\n# 输出条数\n','shots = [2, 0, 3, 0, 2]\nprint(len(shots))','5','len(shots) = 5：0 分也是一次出手。',{cases:[{pre:'shots = [7]',expect:'1'},{pre:'shots = [4, 4]',expect:'2'}],require:{calls:['len']}}),

// ---------- 关卡2 · max / min ----------
c('B221','maxmin',1,'print(max(4, 9, 1)) 输出什么？','print(max(4, 9, 1))',['1','4','9'],2,'max 取最大值：9。',[{code:'print(max(4, 9, 1))',expect:'9'}]),
t('B222','maxmin',2,'print(min(3, 8)) 输出 8。','print(min(3, 8))',1,'min 取最小值：3，不是 8。',[{code:'print(min(3, 8))',expect:'3'}]),
b('B223','maxmin',2,'print(max([2, 6, 4])) 的输出是 ___','print(max([2, 6, 4]))','6',['6'],'最大的是 6。',[{code:'print(max([2, 6, 4]))',expect:'6'}]),
b('B224','maxmin',3,'最高减最低：max([7, 2, 9]) - min([7, 2, 9]) = ___','print(max([7, 2, 9]) - min([7, 2, 9]))','7',['7'],'最高 9，最低 2，相差 7。',[{code:'print(max([7, 2, 9]) - min([7, 2, 9]))',expect:'7'}]),
k('B225','maxmin',2,'最高与最低','积分 scores = [3, 8, 5]。先输出最高分，再输出最低分（两行）。','scores = [3, 8, 5]\n# 先输出最高，再输出最低\n','scores = [3, 8, 5]\nprint(max(scores))\nprint(min(scores))','8\n3','max(scores) = 8，min(scores) = 3，各 print 一行。',{cases:[{pre:'scores = [1, 2]',expect:'2\n1'},{pre:'scores = [9, 0, 3]',expect:'9\n0'}],require:{calls:['max','min']}}),

// ---------- 关卡2 · 平均数 ----------
c('B231','avg',1,'四次训练得分 [2, 4, 4, 2]，平均分是多少？','sum([2, 4, 4, 2]) / len([2, 4, 4, 2])',['2','3','12'],1,'总分 12 ÷ 4 次 = 3。若用 print 输出会显示 3.0（/ 的结果是小数类型）。',[{code:'print(sum([2, 4, 4, 2]) / len([2, 4, 4, 2]))',expect:'3.0'}]),
t('B232','avg',2,'平均数 = 总分 ÷ 次数，写作 sum(scores) / len(scores)。','sum(scores) / len(scores)',0,'平均数就是先求和再除以条数。'),
b('B233','avg',2,'print(sum([5, 7, 3]) / len([5, 7, 3])) 的输出是 ___','print(sum([5, 7, 3]) / len([5, 7, 3]))','5.0',['5.0','5'],'15 ÷ 3 = 5；/ 的结果是小数，输出 5.0（写 5 也认可）。',[{code:'print(sum([5, 7, 3]) / len([5, 7, 3]))',expect:'5.0'}]),
b('B234','avg',3,'总分 21、出手 7 次，平均分 21 / 7 = ___','print(21 / 7)','3.0',['3.0','3'],'21 ÷ 7 = 3，/ 输出小数 3.0（写 3 也认可）。',[{code:'print(21 / 7)',expect:'3.0'}]),
k('B235','avg',3,'计算平均分','scores = [2, 4, 6]。用 sum 和 len 输出平均分（结果是小数）。','scores = [2, 4, 6]\n# 输出平均分\n','scores = [2, 4, 6]\nprint(sum(scores) / len(scores))','4.0','sum = 12，len = 3，12 / 3 = 4.0。',{cases:[{pre:'scores = [3, 3, 3]',expect:'3.0'},{pre:'scores = [2, 3]',expect:'2.5'}],require:{calls:['sum','len']}}),

// ---------- 关卡2 · 列表 [ ] ----------
c('B241','list',1,'三份训练成绩怎么存？下面哪一个是正确的列表写法？','# 想把三份训练成绩存进一个变量',['scores = [3, 1, 4]','scores = (3, 1, 4)','scores = 3, 1, 4'],0,'列表用方括号 [ ] 把数据括起来，数据之间用逗号隔开。'),
t('B242','list',2,'列表 [2, 3, 2] 里的两个 2 是两条独立记录，不能删掉一个。','scores = [2, 3, 2]',0,'统计的是记录条数，不是不同数字的种类；重复的值各有含义。'),
b('B243','list',2,'创建包含 6、1、8 三个成绩的列表：scores = ___','scores = ___','[6, 1, 8]',['[6, 1, 8]','[6,1,8]'],'方括号括住，逗号隔开：[6, 1, 8]。'),
b('B244','list',3,'一条记录都没有的空列表写作 ___','空列表','[]',['[]'],'空列表就是一对空的方括号 []。'),
k('B245','list',2,'建立登记表','创建列表 records，包含 4、0、4、1 四条记录，然后输出它的条数。','# 创建列表并输出条数\n','# 创建列表并输出条数\nrecords = [4, 0, 4, 1]\nprint(len(records))','4','records = [4, 0, 4, 1]，len 输出 4 条。',{require:{calls:['len'],literal:true}}),

// ---------- 关卡2 · round ----------
c('B251','round',1,'print(round(7.692, 2)) 输出什么？','print(round(7.692, 2))',['7.69','7.7','7.692'],0,'round(x, 2) 保留两位小数：7.692 → 7.69。',[{code:'print(round(7.692, 2))',expect:'7.69'}]),
t('B252','round',2,'print(round(3.14159, 2)) 输出 3.14。','print(round(3.14159, 2))',0,'保留两位小数：3.14159 → 3.14。',[{code:'print(round(3.14159, 2))',expect:'3.14'}]),
b('B253','round',2,'print(round(9.987, 2)) 的输出是 ___','print(round(9.987, 2))','9.99',['9.99'],'第三位 7 进位：9.987 → 9.99。',[{code:'print(round(9.987, 2))',expect:'9.99'}]),
b('B254','round',3,'print(round(100 / 13, 2)) 的输出是 ___','print(round(100 / 13, 2))','7.69',['7.69'],'100 / 13 = 7.692…，保留两位是 7.69。',[{code:'print(round(100 / 13, 2))',expect:'7.69'}]),
k('B255','round',3,'报告平均速度','跑了 60 米、用时 9 秒。输出保留两位小数的平均速度。','# 计算 60 / 9 并保留两位小数\n','# 计算 60 / 9 并保留两位小数\nprint(round(60 / 9, 2))','6.67','60 / 9 = 6.666…，round(…, 2) = 6.67。',{require:{calls:['round']}}),

// ---------- 关卡2 · append ----------
c('B261','append',1,'scores = [2, 3] 执行 scores.append(5) 后，列表变为？','scores = [2, 3]\nscores.append(5)',['[2, 3, 5]','[5, 2, 3]','[2, 3]'],0,'append 把新记录追加到列表末尾。'),
t('B262','append',2,'nums = [1, 2] 执行 nums.append(0) 后，len(nums) 变成 3。','nums = [1, 2]\nnums.append(0)\nlen(nums)',0,'追加一条，条数从 2 变 3。',[{code:'nums = [1, 2]\nnums.append(0)\nprint(len(nums))',expect:'3'}]),
b('B263','append',2,'cards = [4, 4] 执行 cards.append(1) 后，print(cards) 输出 ___','cards = [4, 4]\ncards.append(1)\nprint(cards)','[4, 4, 1]',['[4, 4, 1]','[4,4,1]'],'新记录加在末尾，输出 [4, 4, 1]。',[{code:'cards = [4, 4]\ncards.append(1)\nprint(cards)',expect:'[4, 4, 1]'}]),
b('B264','append',3,'nums = [2, 0] 执行 nums.append(3) 后，print(nums) 输出 ___','nums = [2, 0]\nnums.append(3)\nprint(nums)','[2, 0, 3]',['[2, 0, 3]','[2,0,3]'],'append 把 3 加到列表末尾，输出 [2, 0, 3]。',[{code:'nums = [2, 0]\nnums.append(3)\nprint(nums)',expect:'[2, 0, 3]'}]),

// ---------- 关卡3 · while 三要素 ----------
t('B302','while3',2,'更新指令 i += 1 必须写在循环体里面（缩进到 while 之下）。','i = 0\nwhile i < 3:\n    训练\n    i += 1',0,'更新在循环体内执行，下一轮条件才能看到新的进度；放到循环外就无法停止。'),
b('B303','while3',2,'i = 0 / while i < 3: 要让循环体恰好执行 3 轮（i 依次变 1、2、3），每轮要写 i += ___','i = 0\nwhile i < 3:\n    训练\n    i += ___','1',['1'],'每轮把 i 增加 1，三轮后 i = 3，条件不再成立。',undefined,{exprSlot:true}),
k('B305','while3',2,'数 1 到 3','用 while 循环输出 1、2、3（各占一行）：i 从 1 开始，条件 i <= 3，每轮输出 i 再更新。','i = 1\nwhile i <= 3:\n    # 输出 i 并更新\n','i = 1\nwhile i <= 3:\n    print(i)\n    i += 1','1\n2\n3','i 取 1、2、3 时条件成立，输出后 i += 1；到 4 停止。',{require:{kinds:['While']}}),

// ---------- 关卡3 · 边界 < 与 <= ----------
c('B311','bound',1,'i = 1，while i < 4 每轮 i += 1，循环体执行几次？','i = 1\nwhile i < 4:\n    训练\n    i += 1',['3','4','5'],0,'i 取 1、2、3 时条件成立，共 3 次；i = 4 时 4 < 4 为假，停止。',[{code:'i = 1\ncount = 0\nwhile i < 4:\n    count += 1\n    i += 1\nprint(count)',expect:'3'}]),
t('B312','bound',2,'i = 1 时，while i <= 3 与 while i < 3 的执行次数相同。','i = 1\nwhile i <= 3: ...\n# 对比\nwhile i < 3: ...',1,'<= 3 执行 3 次（1、2、3），< 3 只执行 2 次（1、2），差一次。',[{code:'i = 1\ncount = 0\nwhile i <= 3:\n    count += 1\n    i += 1\nprint(count)',expect:'3'},{code:'i = 1\ncount = 0\nwhile i < 3:\n    count += 1\n    i += 1\nprint(count)',expect:'2'}]),
b('B313','bound',2,'i = 0，while i < 5 每轮 i += 1，执行 ___ 次','i = 0\nwhile i < 5:\n    i += 1','5',['5'],'i 取 0 到 4，共 5 次。',[{code:'i = 0\ncount = 0\nwhile i < 5:\n    count += 1\n    i += 1\nprint(count)',expect:'5'}]),
b('B314','bound',3,'i = 1，while i <= 6 每轮 i += 1，执行 ___ 次','i = 1\nwhile i <= 6:\n    i += 1','6',['6'],'i 取 1 到 6，共 6 次；<= 把终点也包含进来。',[{code:'i = 1\ncount = 0\nwhile i <= 6:\n    count += 1\n    i += 1\nprint(count)',expect:'6'}]),
k('B315','bound',2,'数 2 到 4','用 while 输出 2、3、4（各占一行）：i 从 2 开始，条件用 i <= 4。','i = 2\nwhile i <= 4:\n    # 输出 i 并更新\n','i = 2\nwhile i <= 4:\n    print(i)\n    i += 1','2\n3\n4','条件 i <= 4 把 4 也包含：输出 2、3、4。',{require:{kinds:['While']}}),

// ---------- 关卡3 · 死循环排查 ----------
c('B321','inf',1,'i = 0、while i < 3 里忘了写 i += 1，程序会怎样？','i = 0\nwhile i < 3:\n    训练',['一直执行不停','执行 3 次后停止','立即报错'],0,'i 永远是 0，条件永远成立，循环停不下来——这就是死循环。'),
b('B323','inf',2,'忘了更新的死循环。修复方法：在循环体内补上更新量（每轮加 1，让循环恰好执行 3 轮）：i += ___','i = 0\nwhile i < 3:\n    训练\n    i += ___','1',['1'],'空位只填更新量 1，拼成 i += 1：每轮加 1，三轮后停止。这里不要填整条语句——空位前面已经写好 i +=。',undefined,{exprSlot:true}),
k('B325','inf',3,'修复死循环','下面的程序停不下来。修复更新语句，让 distance 从 0 每轮加 5、达到 10 后停止，循环结束后输出 distance。','distance = 0\nwhile distance < 10:\n    distance -= 5\n# 修复上面的更新，循环结束后输出 distance\n','distance = 0\nwhile distance < 10:\n    distance += 5\nprint(distance)','10','0 → 5 → 10，第二轮后 10 < 10 为假，正常停止并输出 10。',{require:{kinds:['While'],ops:['Add'],whileStep:5}}),

// ---------- 关卡3 · 累加器 += ----------
c('B331','acc',1,'total 从 0 开始，每轮加 5，累计 3 轮后 total 是多少？','total = 0\n每轮: total += 5\n共 3 轮',['5','15','10'],1,'5 + 5 + 5 = 15。'),
t('B332','acc',2,'total += per_round 等价于 total = total + per_round。','total += per_round',0,'+= 是"加上再存回去"的简写。'),
b('B333','acc',2,'total = 0，三轮分别加 4、6、8，最后 total = ___','total = 0\ntotal += 4\ntotal += 6\ntotal += 8','18',['18'],'4 + 6 + 8 = 18。',[{code:'total = 0\ntotal += 4\ntotal += 6\ntotal += 8\nprint(total)',expect:'18'}]),
b('B334','acc',3,'total 从 0、每轮加 6，到至少 20 需要 ___ 轮（while total < 20: total += 6）','total = 0\nwhile total < 20:\n    total += 6','4',['4'],'6、12、18 都小于 20，第 4 轮到 24 才停止，共 4 轮。',[{code:'total = 0\nrounds = 0\nwhile total < 20:\n    total += 6\n    rounds += 1\nprint(rounds)',expect:'4'}]),
k('B335','acc',2,'累计训练里程','每轮训练 7 米，累加到至少 21 米为止。循环结束后输出总米数。','total = 0\nwhile total < 21:\n    # 累加 7 米\n','total = 0\nwhile total < 21:\n    total += 7\nprint(total)','21','7、14、21——第 3 轮后 21 < 21 为假，停止，输出 21。',{require:{kinds:['While'],ops:['Add'],whileStep:7}}),

// ---------- 关卡3 · while 遍历列表 ----------
c('B341','wlist',1,'用 while 遍历列表 scores，循环条件应该写？','i = 0\nwhile ___:\n    scores[i]\n    i += 1',['i < len(scores)','i <= len(scores)','i > len(scores)'],0,'下标最大是 len − 1；写 <= 会越界，写 > 一次都不执行。'),
t('B342','wlist',2,'scores = [5, 3]：i 从 0 取到 1 正好取到每个元素，条件 i < len(scores) 刚好合适。','scores = [5, 3]\ni = 0\nwhile i < len(scores):\n    ...\n    i += 1',0,'len = 2，i 取 0、1；i = 2 时停止，正好不越界。'),
b('B344','wlist',3,'scores = [2, 4, 6]，用 while 遍历累加后 total = ___','scores = [2, 4, 6]\ntotal = 0\ni = 0\nwhile i < len(scores):\n    total += scores[i]\n    i += 1','12',['12'],'2 + 4 + 6 = 12。',[{code:'scores = [2, 4, 6]\ntotal = 0\ni = 0\nwhile i < len(scores):\n    total += scores[i]\n    i += 1\nprint(total)',expect:'12'}]),
k('B345','wlist',3,'逐张统计','用 while 遍历 scores = [3, 1, 4, 1]，把每张累加到 total，最后输出 total（用累加，不用 sum）。','scores = [3, 1, 4, 1]\ntotal = 0\ni = 0\n# 补全循环，最后输出 total\n','scores = [3, 1, 4, 1]\ntotal = 0\ni = 0\nwhile i < len(scores):\n    total += scores[i]\n    i += 1\nprint(total)','9','逐张累加：3 + 1 + 4 + 1 = 9。',{cases:[{pre:'scores = [2, 5]\ntotal = 0\ni = 0',expect:'7'},{pre:'scores = [1, 1, 1, 1, 1]\ntotal = 0\ni = 0',expect:'5'}],require:{kinds:['While'],ops:['Add'],bannedCalls:['sum']}}),

// ---------- 关卡3 · for + range ----------
c('B351','forrange',1,'for i in range(1, 4) 里 i 依次取哪些值？','for i in range(1, 4):',['1, 2, 3','1, 2, 3, 4','0, 1, 2, 3'],0,'range 的终点不包含：从 1 取到 3 为止。',[{code:'for i in range(1, 4):\n    print(i)',expect:'1\n2\n3'}]),
t('B352','forrange',2,'for station in range(1, 6) 会经过 5 个训练站。','for station in range(1, 6):',0,'station 取 1 到 5，共 5 站；终点 6 不包含。',[{code:'count = 0\nfor station in range(1, 6):\n    count += 1\nprint(count)',expect:'5'}]),
b('B353','forrange',2,'要数 1 到 10（包含 10），应写 for i in range(1, ___):','for i in range(1, ___):','11',['11'],'终点不包含，要含 10 就得写到 11。',undefined,{exprSlot:true}),
b('B354','forrange',3,'for i in range(2, 9): 循环体执行 ___ 次','for i in range(2, 9):','7',['7'],'i 取 2 到 8，共 7 次。',[{code:'count = 0\nfor i in range(2, 9):\n    count += 1\nprint(count)',expect:'7'}]),
k('B355','forrange',2,'巡完 5 个训练站','训练站编号 1 到 5。用 for 和 range 依次输出每个站号（各占一行）。','# 用 for + range 输出 1 到 5\n','# 用 for + range 输出 1 到 5\nfor station in range(1, 6):\n    print(station)','1\n2\n3\n4\n5','range(1, 6) 取 1、2、3、4、5；终点 6 不包含。',{require:{kinds:['For'],calls:['range']}}),

// ---------- 关卡3 · 缩进归属 ----------
t('B362','indent',2,'while i < 3: 之后没有缩进的那一行，不属于循环体。','while i < 3:\n    训练\n报告()',0,'缩进表示归属：没缩进的"报告"在循环结束后只执行一次。'),
b('B364','indent',3,'循环体执行 3 次；循环体后那一行（不缩进）执行 ___ 次','i = 0\nwhile i < 3:\n    记录()\n    i += 1\n报告()','1',['1'],'报告() 没缩进，属于循环外，只执行 1 次。'),
k('B365','indent',2,'循环后再报数','用 while 输出 0、1、2（各占一行）；循环结束后（不缩进）再输出 99 作为完成标记。','i = 0\nwhile i < 3:\n    # 输出 i 并更新\n# 循环结束后输出 99\n','i = 0\nwhile i < 3:\n    print(i)\n    i += 1\nprint(99)','0\n1\n2\n99','print(i) 缩进在循环内执行 3 次；print(99) 不缩进，只执行 1 次。',{require:{kinds:['While']}}),
];
