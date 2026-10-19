/* Python executes in an isolated Worker. Debug snapshots observe actual Skulpt
 * execution without rewriting student code. The caller also keeps its 4s kill switch.
 * {id,preamble,code,suffix} -> {id,ok,out,process,trace} or {id,ok:false,out,err,trace} */
importScripts('../vendor/skulpt/skulpt.min.js', '../vendor/skulpt/skulpt-stdlib.js', 'py_process.js');
let out = '', recorder = null;
Sk.configure({
  __future__: Sk.python3,
  debugging: true,
  breakpoints: file => file === 'student.py',
  output: s => {if(out.length<16000){const text=s.slice(0,16000-out.length);out+=text;recorder?.output(text);}},
  read: f => {
    if (Sk.builtinFiles && Sk.builtinFiles.files[f] !== undefined) return Sk.builtinFiles.files[f];
    throw new Error('读不到内置模块：' + f);
  },
});
onmessage = ev => {
  const {id,preamble='',code='',suffix=''}=ev.data;
  out='';recorder=null;
  const full=preamble+'\n'+code+'\n'+suffix,first=preamble.split('\n').length+1,last=first+code.split('\n').length-1;
  const started=Date.now();
  function resume(result) {
    while(result?.$isSuspension&&['Sk.debug','Sk.delay'].includes(result.data.type)) {
      if(Date.now()-started>3500){const e=new Error('程序运行超时，请检查循环是否会停止。');e.lessonTimeout=true;throw e;}
      recorder.capture(result);result=result.resume();
    }
    return result;
  }
  try {recorder=createPythonProcessRecorder(Sk,full,first,last);}catch(e){postMessage({id,ok:false,out,err:String(e).slice(0,300)});return;}
  Sk.misceval.asyncToPromise(()=>resume(Sk.importMainWithBody('student',false,full,true)),{
    'Sk.debug':s=>Promise.resolve(resume(s)),
    'Sk.delay':s=>Promise.resolve(resume(s)),
  }).then(module=>postMessage({id,ok:true,out,...recorder.finish(module)}))
    .catch(e=>postMessage({id,ok:false,out,timeout:!!e.lessonTimeout,err:String(e?.message||e).slice(0,300),...recorder.fail(e.lessonTimeout?'timeout':'runtime-error')}));
};
