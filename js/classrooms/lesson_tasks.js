// Classroom-only replacement: retain the stable room id and historical stars.
const single=lines=>lines.length===1&&/^-?\d+(?:\.\d+)?$/.test(lines[0].trim())?Number(lines[0]):NaN;
export function lessonOutputMatches(output,expected){const lines=String(output).split('\n').map(s=>s.trim()).filter(Boolean);return lines.length===expected.length&&lines.every((s,i)=>single([s])===Number(expected[i]));}
const swim={
 id:'1-3',step:'swim',title:'泳道折返 · 只算本趟已游',teach:'% 求本趟已游距离；正好在端点时为 0。',
 brief:'一段泳道长 50 米，已经累计游了 137 米。137 里有两个整段（2×50=100），本趟已经游了 37 米。用 % 直接算出这个 remainder：swim % pool，只打印 remainder。先看已知距离，再运行代码；正好在端点时应输出 0。',
 pre:'pool = 50\nswim = 137\n',
 card:'取余 % 把累计距离拆成"完整段 + 本趟零头"：137 % 50 = 37，这个 37 就是本趟已游距离。\n两个完整段不参与取余结果；正好在端点时（如 100 米）余数为 0。\n这里每段是单程，不把往返叫一圈。',
 tiers:['remainder = swim ___ pool\nprint(remainder)','remainder = swim % pool\nprint(___)','# pool 与 swim 已给出。计算本趟已游距离。\n# 到达端点时输出 0；只打印 remainder。\n'],ops:['%','//','/','remainder'],anim:'led',
 check:lines=>{const n=single(lines);if(n===37)return {pass:true,got:n};return {pass:false,got:n,hint:n===87?'87 是 137 − 50，把完整段减掉了。取余直接给出零头：137 % 50 = 37。':n===2?'2 是整段数（137 // 50）。本趟已游是零头部分：137 % 50 = 37。':Number.isFinite(n)?`你输出 ${n}。137 = 2 × 50 + 37，本趟已游是余数 37（用 % 直接得到）。`:'本题只打印一个数字 remainder，不再同时打印乘方结果。'};},
 tests:[0,50,100,137,150,51,249].map(swim=>({pre:`pool = 50\nswim = ${swim}\n`,expected:[String(swim%50)],hint:`累计 ${swim} 米时，本趟已游 ${swim%50} 米（swim % pool）。到达端点应为 0，不能固定输出 37。`}))
};
// 2026-10-17 老师修改意见：整段删除"路线乘方"步，103 只保留泳道取余（单步即整室完成）。
// power 步对象已移除；task_stage_data/task_stage 的 power 分支成为无入口休眠代码，保留防连带。
export const LESSON_STEPS={'1-3':[swim]};
export function classroomLevels(levels){return levels.map(lv=>({...lv,tasks:lv.tasks.map(t=>LESSON_STEPS[t.id]?{...LESSON_STEPS[t.id][0],steps:LESSON_STEPS[t.id]}:t)}));}
export function lessonDraftKey(room,tier){return `fine:${room.id}:${room.task.step?room.task.step+':':''}${tier}`;}
export function lessonProgress(save,id){const steps=LESSON_STEPS[id]||[],stars=steps.map(t=>Number(save.taskSteps?.[id]?.[t.step])||0);return {completed:stars.filter(Boolean).length,total:steps.length,stars};}
export function recordLessonStep(save,id,step,stars){
 save.taskSteps??={};save.taskSteps[id]??={};save.taskSteps[id][step]=Math.max(save.taskSteps[id][step]||0,stars);
 const p=lessonProgress(save,id);if(p.completed===p.total)save.tasks[id]=Math.max(save.tasks[id]||0,Math.min(...p.stars));
 return p;
}
