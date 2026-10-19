// 考核编程题的代码运行器：与课堂共用 js/py_worker.js（隔离 Worker + 4 秒熔断）。
let worker=null,seq=0;
const dispose=()=>{worker?.terminate();worker=null;};
export function runExamCode(code){
  return new Promise(resolve=>{
    const id=++seq;worker??=new Worker('js/py_worker.js');const w=worker;
    let settled=false;
    const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);resolve(result);};
    const timer=setTimeout(()=>{dispose();finish({ok:false,timeout:true,err:'程序已在安全时限内停止。请检查循环是否会停止。'});},4000);
    w.onmessage=e=>{if(e.data.id===id)finish(e.data.ok?{ok:true,out:e.data.out||'',process:e.data.process,trace:e.data.trace}:{ok:false,out:e.data.out||'',err:e.data.err||'Python执行失败'});};
    w.onerror=e=>{dispose();finish({ok:false,err:e.message||'Python执行失败'});};
    w.postMessage({id,preamble:'',code,suffix:''});
  });
}
// 中文全角标点检查（忽略注释与字符串字面量），提示与课堂工作台一致。
export function fullwidthHint(code){
  const stripped=String(code).replace(/#[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g,'');
  return /[：（）“”‘’，；]/.test(stripped)?'代码中有中文全角符号，请换成英文标点。':null;
}
