import {GUIDES,lessonGuideIds,examGuideId} from './guide_data.js';
import {campusMusic} from '../campus_music.js';
export {lessonGuideIds,examGuideId};
let active=null;
export function stopGuideVoice(){active?.stop();}
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopGuideVoice();});
window.addEventListener('pagehide',stopGuideVoice);

const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
// Version the media URL from the exact narration, so a changed prompt cannot replay cached words.
export function voiceURL(id){let hash=0;for(const c of GUIDES[id].steps.join(''))hash=(Math.imul(hash,31)+c.codePointAt(0))|0;return new URL(`../../assets/audio/lesson-guide/${id}.m4a?v=${hash>>>0}`,import.meta.url).href;}
export function mountGuide(parent,ids,{title='怎么做 · 跟着这几步',before=null}={}){
  ids=ids.filter(id=>GUIDES[id]);if(!ids.length)return null;
  // 文稿与已录制音频不一致的条目（voice:false，如待重录的 g103swim）不再播放旧音频，只显示文字。
  const playable=ids.map((id,i)=>({id,chunkIndex:i})).filter(x=>GUIDES[x.id].voice!==false);
  const root=node('section',null,'voiceGuide');root.dataset.guides=ids.join(',');root.setAttribute('aria-label',title);
  const head=node('div',null,'voiceGuideHead'),heading=node('strong',title),button=node('button','▶ 听怎么做','voiceGuidePlay');
  button.type='button';button.setAttribute('aria-pressed','false');head.append(heading,button);root.append(head);
  const chunks=ids.map((id,index)=>{
    const g=GUIDES[id],chunk=node('div',null,'voiceGuideChunk');chunk.dataset.guide=id;
    if(g.voice===false)chunk.append(node('p','这段语音正在按最新文字重新录制，请先以下方文字为准。','voiceGuidePending'));
    if(index===0){const list=node('ol');g.steps.forEach(text=>list.append(node('li',text)));chunk.append(list);}
    else chunk.append(node('p',g.steps.join(''),'voiceGuideTier'));
    root.append(chunk);if(g.code)root.append(node('p',g.code,'voiceGuideCode'));return chunk;
  });
  const status=node('span',playable.length?'可反复听，不影响成绩。':'本条语音待重录，请按文字操作；不影响成绩。','voiceGuideStatus');status.setAttribute('role','status');root.append(status);
  if(!playable.length)button.hidden=true;
  const audio=document.createElement('audio');audio.preload='none';audio.dataset.lessonVoice='true';root.append(audio);
  parent.insertBefore(root,before);
  let serial=0,disposed=false,timer=null,started=false;
  const clear=()=>{clearTimeout(timer);chunks.forEach(c=>c.classList.remove('isReading'));};
  const api={root,stop(message='已停止，可从头再听。'){
    serial++;clear();audio.onended=audio.onerror=audio.onplaying=null;audio.pause();audio.removeAttribute('src');audio.load();
    if(active===api){active=null;campusMusic.duck('lesson-voice',false);}
    button.textContent=started?'▶ 再听一遍':'▶ 听怎么做';button.setAttribute('aria-pressed','false');root.dataset.playing='false';status.textContent=message;
  },dispose(){if(disposed)return;api.stop();disposed=true;root.remove();}};
  button.onclick=()=>{
    if(!playable.length||active===api){if(!playable.length)return;api.stop();return;}
    stopGuideVoice();active=api;started=true;const token=++serial;let index=0;
    button.textContent='■ 停止语音';button.setAttribute('aria-pressed','true');root.dataset.playing='true';campusMusic.duck('lesson-voice',true);
    const valid=()=>!disposed&&token===serial&&active===api;
    const failure=()=>{if(valid())api.stop('语音暂时不可用，请按上面的文字操作，或点重试。');};
    const playNext=()=>{
      if(!valid())return;clear();
      if(index===playable.length){api.stop('已讲完，可以动手试试。');return;}
      const entry=playable[index];
      chunks[entry.chunkIndex].classList.add('isReading');status.textContent='正在加载语音…';
      audio.src=voiceURL(entry.id);audio.onplaying=()=>{if(valid()){clearTimeout(timer);status.textContent=index===0?'正在讲解步骤…':'正在讲解本级操作…';}};
      audio.onerror=failure;audio.onended=()=>{if(valid()){index++;playNext();}};
      timer=setTimeout(failure,5000);audio.play().catch(failure);
    };
    playNext();
  };
  return api;
}
