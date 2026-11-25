import React, { useEffect, useMemo, useRef, useState } from 'react';
import mux from 'mux-embed';
import Hls from 'hls.js';
import { createRoot } from 'react-dom/client';
import { Search, House, Compass, PlaySquare, Clock3, ThumbsUp, Flame, Clapperboard, Menu, Plus, Bell, Mic, MoreHorizontal, Play, X, ChevronDown, Film, Radio, UserRound, Settings, History, Bookmark, ArrowUpRight, Flag, ShieldCheck, Trash2, ExternalLink, Maximize, Eye, Heart, MessageCircle, Users, CheckCheck } from 'lucide-react';
import './styles.css';

const videos = [];
const shorts = [];
const categories=['Для вас','Мои видео'];

function MuxVideoPlayer({ src, videoId, title, channel, autoplay, token, onTheaterChange }) {
 const videoRef=useRef(null), shellRef=useRef(null), hlsRef=useRef(null), hideRef=useRef(null), viewTracked=useRef(false);
 const [playing,setPlaying]=useState(false),[currentTime,setCurrentTime]=useState(0),[duration,setDuration]=useState(0);
 const [volume,setVolume]=useState(1),[muted,setMuted]=useState(false),[speed,setSpeed]=useState(1);
 const [levels,setLevels]=useState([]),[quality,setQuality]=useState(-1),[menu,setMenu]=useState(''),[controls,setControls]=useState(true),[buffering,setBuffering]=useState(true),[theater,setTheater]=useState(false);
 const fmt=t=>{if(!Number.isFinite(t))return '0:00';const n=Math.floor(t);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};
 useEffect(()=>{
  const video=videoRef.current,envKey=import.meta.env.VITE_MUX_ENV_KEY;
  viewTracked.current=false;
  if(!video||!src)return;
  let hls;
  const saved=Number(localStorage.getItem('mirvex_progress_'+videoId)||0);
  const restore=()=>{if(saved>5&&Number.isFinite(video.duration)&&saved<video.duration-10)video.currentTime=saved;};
  const onTime=()=>{setCurrentTime(video.currentTime||0);setDuration(video.duration||0);if(video.currentTime>0){if(video.duration&&video.currentTime>=video.duration-8){localStorage.removeItem('mirvex_progress_'+videoId);localStorage.removeItem('mirvex_duration_'+videoId);}else{localStorage.setItem('mirvex_progress_'+videoId,String(video.currentTime));if(video.duration)localStorage.setItem('mirvex_duration_'+videoId,String(video.duration));}}};
  const onReady=()=>{setDuration(video.duration||0);setBuffering(false);restore();};
  const onWaiting=()=>setBuffering(true),onPlaying=()=>{setPlaying(true);setBuffering(false);if(token&&!viewTracked.current){viewTracked.current=true;fetch('https://mirvex-api.onrender.com/api/videos/'+videoId+'/view',{method:'POST',headers:{Authorization:'Bearer '+token}}).catch(()=>{});}},onPause=()=>setPlaying(false);
  video.addEventListener('loadedmetadata',onReady);video.addEventListener('durationchange',onReady);video.addEventListener('timeupdate',onTime);video.addEventListener('waiting',onWaiting);video.addEventListener('playing',onPlaying);video.addEventListener('pause',onPause);
  if(src.includes('.m3u8')&&!video.canPlayType('application/vnd.apple.mpegurl')&&Hls.isSupported()){
   hls=new Hls({enableWorker:true,capLevelToPlayerSize:true});hlsRef.current=hls;hls.loadSource(src);hls.attachMedia(video);
   hls.on(Hls.Events.MANIFEST_PARSED,()=>setLevels((hls.levels||[]).map((l,i)=>({index:i,label:l.height?l.height+'p':Math.round((l.bitrate||0)/1000)+' kbps'}))));
  }else video.src=src;
  if(envKey)mux.monitor(video,{debug:false,respectDoNotTrack:true,disableCookies:true,data:{env_key:envKey,player_name:'MIRVEX Player 2.0',player_version:'2.0.0',player_init_time:mux.utils.now(),video_id:String(videoId??'unknown'),video_title:title||'Untitled video',video_series:channel||'MIRVEX',video_stream_type:'on-demand'}});
  if(autoplay)video.play().catch(()=>{});
  return ()=>{video.removeEventListener('loadedmetadata',onReady);video.removeEventListener('durationchange',onReady);video.removeEventListener('timeupdate',onTime);video.removeEventListener('waiting',onWaiting);video.removeEventListener('playing',onPlaying);video.removeEventListener('pause',onPause);hls?.destroy();hlsRef.current=null;video.mux?.destroy?.();};
 },[src,videoId,title,channel,token]);
 const reveal=()=>{setControls(true);clearTimeout(hideRef.current);if(playing)hideRef.current=setTimeout(()=>setControls(false),2600);};
 const togglePlay=()=>{const v=videoRef.current;if(!v)return;v.paused?v.play().catch(()=>{}):v.pause();reveal();};
 const seek=delta=>{const v=videoRef.current;if(v)v.currentTime=Math.max(0,Math.min(v.duration||0,v.currentTime+delta));};
 const full=()=>{const el=shellRef.current,v=videoRef.current;if(!el)return; if(document.fullscreenElement){document.exitFullscreen?.().catch?.(()=>{});return;} if(el.requestFullscreen){el.requestFullscreen().catch(()=>{if(v?.webkitEnterFullscreen)v.webkitEnterFullscreen();});return;} if(v?.webkitEnterFullscreen){v.webkitEnterFullscreen();return;} if(v?.webkitEnterFullScreen){v.webkitEnterFullScreen();return;} };
 const chooseQuality=value=>{setQuality(Number(value));if(hlsRef.current)hlsRef.current.currentLevel=Number(value);setMenu('');};
 const chooseSpeed=value=>{setSpeed(Number(value));if(videoRef.current)videoRef.current.playbackRate=Number(value);setMenu('');};
 useEffect(()=>{const key=e=>{const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;if(!shellRef.current)return;const k=e.key.toLowerCase();if(k===' '||k==='k'){e.preventDefault();togglePlay();}else if(k==='arrowleft'){e.preventDefault();seek(-5);}else if(k==='arrowright'){e.preventDefault();seek(5);}else if(k==='m'){const v=videoRef.current;if(v){v.muted=!v.muted;setMuted(v.muted);}}else if(k==='f'){e.preventDefault();full();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);});
 useEffect(()=>()=>clearTimeout(hideRef.current),[]);
 return <div ref={shellRef} className={'mirvex-player '+(theater?'player-theater':'')} onMouseMove={reveal} onMouseLeave={()=>playing&&setControls(false)} onTouchStart={reveal} onDoubleClick={full}>
  <video ref={videoRef} className="mux-video" playsInline preload="metadata" onClick={togglePlay}/>
  {buffering&&<div className="player-loader"><span/></div>}
  {!playing&&<button className="player-big-play" onClick={togglePlay} aria-label="Воспроизвести"><Play fill="currentColor" size={27}/></button>}
  <div className={'player-controls '+(controls?'controls-visible':'')} onClick={e=>e.stopPropagation()}>
   <div className="player-seek"><span>{fmt(currentTime)}</span><input aria-label="Позиция видео" type="range" min="0" max={duration||100} step="0.1" value={Math.min(currentTime,duration||100)} onChange={e=>{if(videoRef.current)videoRef.current.currentTime=Number(e.target.value);}}/><span>{fmt(duration)}</span></div>
   <div className="player-control-row">
    <div className="player-control-group"><button onClick={togglePlay} aria-label={playing?'Пауза':'Воспроизвести'}>{playing?'Ⅱ':<Play size={18}/>}</button><button onClick={()=>seek(-10)} aria-label="Назад на 10 секунд">↶</button><button onClick={()=>seek(10)} aria-label="Вперёд на 10 секунд">↷</button><button onClick={()=>{const v=videoRef.current;if(v){v.muted=!v.muted;setMuted(v.muted);}}} aria-label="Звук">{muted||volume===0?'◖':'◕'}</button><input className="player-volume" aria-label="Громкость" type="range" min="0" max="1" step="0.05" value={muted?0:volume} onChange={e=>{const n=Number(e.target.value);setVolume(n);setMuted(n===0);if(videoRef.current){videoRef.current.volume=n;videoRef.current.muted=n===0;}}}/></div>
    <div className="player-control-group player-right-controls">
     <div className="player-menu-wrap"><button onClick={()=>setMenu(menu==='speed'?'':'speed')}>{speed}×</button>{menu==='speed'&&<div className="player-popover">{[0.5,0.75,1,1.25,1.5,1.75,2].map(n=><button key={n} className={speed===n?'selected':''} onClick={()=>chooseSpeed(n)}>{n===1?'Обычная':n+'×'}</button>)}</div>}</div>
     {levels.length>0&&<div className="player-menu-wrap"><button onClick={()=>setMenu(menu==='quality'?'':'quality')}>HD</button>{menu==='quality'&&<div className="player-popover">{[{index:-1,label:'Авто'},...levels].map(l=><button key={l.index} className={quality===l.index?'selected':''} onClick={()=>chooseQuality(l.index)}>{l.label}</button>)}</div>}</div>}
     <button onClick={()=>setTheater(v=>{onTheaterChange?.(!v);return !v;})} aria-label="Режим кинотеатра" title="Режим кинотеатра">▣</button><button onClick={()=>{const v=videoRef.current;if(v?.requestPictureInPicture)v.requestPictureInPicture().catch(()=>{});}} aria-label="Мини-плеер">▱</button><button onClick={full} aria-label="На весь экран"><Maximize size={17}/></button>
    </div>
   </div>
  </div>
 </div>;
}
function UploadDialog({ onClose, onUploaded, token }) {
 const [file,setFile]=useState(null);
 const [cover,setCover]=useState(null);
 const [title,setTitle]=useState('');
 const [isShort,setIsShort]=useState(false);
 const [status,setStatus]=useState('idle');
 const [progress,setProgress]=useState(0);
 const [message,setMessage]=useState('');
 const chooseRef=useRef(null);
 const coverRef=useRef(null);
 async function upload() {
  if (!file) return;
  setStatus('uploading'); setProgress(0); setMessage('Создаём защищённую ссылку...');
  try {
   const created=await fetch('https://mirvex-api.onrender.com/api/uploads',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({title:title||file.name,isShort})});
   const data=await created.json();
   if(!created.ok) throw new Error(data.error||'Не удалось создать загрузку');
   setMessage('Загружаем видео в Mux...');
   await new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();
    xhr.open('PUT',data.uploadUrl);
    xhr.upload.onprogress=e=>{if(e.lengthComputable)setProgress(Math.round(e.loaded/e.total*100));};
    xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(new Error('Mux отклонил файл ('+xhr.status+')'));
    xhr.onerror=()=>reject(new Error('Ошибка соединения при загрузке'));
    xhr.send(file);
   });
   setMessage('Mux обрабатывает видео. Это может занять несколько минут...');
   let ready=null;
   for(let i=0;i<120;i++){
    await new Promise(r=>setTimeout(r,3000));
    const check=await fetch('https://mirvex-api.onrender.com/api/uploads/'+encodeURIComponent(data.uploadId),{headers:{Authorization:'Bearer '+token}});
    const result=await check.json();
    if(!check.ok) throw new Error(result.error||'Не удалось проверить обработку');
    if(result.status==='ready'&&result.playbackId){ready=result;break;}
    if(result.status==='errored') throw new Error('Mux не смог обработать это видео');
   }
   if(!ready) throw new Error('Обработка занимает больше обычного. Попробуйте проверить позже.');
   if(cover){const fd=new FormData();fd.append('cover',cover);const cr=await fetch('https://mirvex-api.onrender.com/api/videos/'+ready.videoId+'/cover',{method:'POST',headers:{Authorization:'Bearer '+token},body:fd});const cd=await cr.json();if(!cr.ok)throw new Error(cd.error||'Не удалось сохранить обложку');}
   const item={id:'db-'+ready.videoId,title:title||file.name,channel:'Мой канал',views:'Новое видео',time:'Только что',duration:ready.duration?new Date(ready.duration*1000).toISOString().slice(14,19):'',image:cover?URL.createObjectURL(cover):'https://image.mux.com/'+ready.playbackId+'/thumbnail.jpg?width=900',avatar:'М',category:'Мои видео',videoUrl:'https://stream.mux.com/'+ready.playbackId+'.m3u8',isShort:!!ready.isShort,isPublic:true};
   onUploaded(item);
   setStatus('done'); setMessage('Видео опубликовано и готово к просмотру!');
  } catch(e){setStatus('error');setMessage(e.message||'Не удалось загрузить видео');}
 }
 return <div className="upload-backdrop" onClick={onClose}><div className="upload-dialog" onClick={e=>e.stopPropagation()}>
  <button className="modal-close" onClick={onClose}><X/></button><div className="eyebrow">MIRVEX STUDIO</div><h2>Загрузить видео</h2><p className="upload-hint">Выбери видео с устройства. Файл отправится напрямую в Mux.</p>
  <label className="upload-field">Название видео<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Например, мой первый ролик"/></label>
  <label className="upload-short-toggle"><input type="checkbox" checked={isShort} onChange={e=>setIsShort(e.target.checked)}/><span><b>Опубликовать как MIRVEX Short</b><small>Вертикальный ролик до 3 минут. После обработки он автоматически появится в Shorts для всех.</small></span></label>
  <input ref={chooseRef} type="file" accept="video/*" hidden onChange={e=>setFile(e.target.files?.[0]||null)}/>
  <button className="file-picker" onClick={()=>chooseRef.current?.click()} disabled={status==='uploading'}><Film size={20}/><span>{file?file.name:'Выбрать видеофайл'}</span><small>{file?(file.size/1024/1024).toFixed(1)+' МБ':'MP4, MOV и другие форматы'}</small></button>
  <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>setCover(e.target.files?.[0]||null)}/>
  <button className="file-picker cover-picker" onClick={()=>coverRef.current?.click()} disabled={status==='uploading'}>{cover?<img src={URL.createObjectURL(cover)} alt="Обложка"/>:<Film size={20}/>}<span>{cover?cover.name:'Выбрать обложку (превью)'}</span><small>JPG, PNG, WebP · до 5 МБ</small></button>
  {status==='uploading'&&<div className="upload-progress"><div><span>{message}</span><b>{progress}%</b></div><i><span style={{width:progress+'%'}}/></i></div>}
  {message&&status!=='uploading'&&<p className={'upload-message '+status}>{message}</p>}
  <div className="upload-actions"><button className="upload-cancel" onClick={onClose}>Закрыть</button><button className="upload-submit" disabled={!file||status==='uploading'||status==='done'} onClick={upload}>{status==='uploading'?'Загрузка...':status==='done'?'Готово':'Загрузить видео'}</button></div>
 </div></div>;
}


function AuthDialog({onClose,onAuth}) {
 const [mode,setMode]=useState('login'),[email,setEmail]=useState(''),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function submit(){
  setBusy(true);setError('');
  try{
   const r=await fetch('https://mirvex-api.onrender.com/api/auth/'+(mode==='login'?'login':'register'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,username,password})});
   const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось выполнить вход');
   onAuth(d);onClose();
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <div className="upload-backdrop" onClick={onClose}><div className="upload-dialog" onClick={e=>e.stopPropagation()}>
  <button className="modal-close" onClick={onClose}><X/></button><div className="eyebrow">MIRVEX ACCOUNT</div><h2>{mode==='login'?'Войти в MIRVEX':'Создать аккаунт'}</h2>
  <label className="upload-field">Электронная почта<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></label>
  {mode==='register'&&<label className="upload-field">Имя пользователя<input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Как тебя показывать"/></label>}
  <label className="upload-field">Пароль<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Минимум 8 символов"/></label>
  {error&&<p className="upload-message error">{error}</p>}
  <div className="upload-actions"><button className="upload-cancel" onClick={()=>setMode(mode==='login'?'register':'login')}>{mode==='login'?'Регистрация':'Уже есть аккаунт?'}</button><button className="upload-submit" disabled={busy||!email||!password||(mode==='register'&&!username)} onClick={submit}>{busy?'Подождите...':mode==='login'?'Войти':'Зарегистрироваться'}</button></div>
 </div></div>;
}



function ReportDialog({video,token,onClose}){
 const [reason,setReason]=useState('Спам или мошенничество'),[details,setDetails]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function submit(){setBusy(true);setMessage('');try{const r=await fetch('https://mirvex-api.onrender.com/api/videos/'+video.id+'/report',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({reason,details})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось отправить жалобу');setMessage('Жалоба отправлена. Спасибо, мы рассмотрим её.');setTimeout(onClose,1100);}catch(e){setMessage(e.message);}finally{setBusy(false);}}
 return <div className="settings-backdrop" onClick={onClose}><section className="report-dialog" onClick={e=>e.stopPropagation()}><button className="settings-close report-close" onClick={onClose}><X/></button><div className="eyebrow">MIRVEX SAFETY</div><h2>Пожаловаться на видео</h2><p>Жалоба попадёт в очередь модерации. Администратор проверит её вручную.</p><label className="upload-field">Причина жалобы<select value={reason} onChange={e=>setReason(e.target.value)}><option>Спам или мошенничество</option><option>Насилие или опасный контент</option><option>Ненависть или травля</option><option>Нарушение авторских прав</option><option>Сексуальный контент</option><option>Другое</option></select></label><label className="upload-field">Дополнительная информация<textarea value={details} maxLength={1000} onChange={e=>setDetails(e.target.value)} placeholder="Расскажи подробнее (необязательно)"/></label>{message&&<p className="upload-message">{message}</p>}<div className="upload-actions"><button className="upload-cancel" onClick={onClose}>Отмена</button><button className="upload-submit" disabled={busy} onClick={submit}>{busy?'Отправка...':'Отправить жалобу'}</button></div></section></div>;
}
function AdminDialog({token,onClose,onDelete,onOpenVideo}){
 const [reports,setReports]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=async()=>{try{const r=await fetch('https://mirvex-api.onrender.com/api/admin/reports',{headers:{Authorization:'Bearer '+token}});const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось загрузить жалобы');setReports(d.reports||[]);}catch(e){setError(e.message);}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 const setStatus=async(id,status)=>{try{const r=await fetch('https://mirvex-api.onrender.com/api/admin/reports/'+id+'/status',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({status})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось обновить жалобу');setReports(items=>items.map(x=>x.id===id?{...x,status}:x));}catch(e){alert(e.message);}};
 const remove=async report=>{if(!report.videoId||!confirm('Удалить это видео с MIRVEX? Действие нельзя отменить.'))return;try{const r=await fetch('https://mirvex-api.onrender.com/api/admin/videos/'+report.videoId,{method:'DELETE',headers:{Authorization:'Bearer '+token}});const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось удалить видео');setReports(items=>items.map(x=>x.videoId===report.videoId?{...x,videoId:null,streamUrl:null,status:'reviewed'}:x));onDelete(report.videoId);}catch(e){alert(e.message);}};
 return <div className="settings-backdrop admin-backdrop" onClick={onClose}><section className="admin-dialog" onClick={e=>e.stopPropagation()}><header className="settings-header"><div><div className="eyebrow">MIRVEX CONTROL</div><h2><ShieldCheck size={23}/> Админ-панель</h2><p>Проверяй жалобы и принимай решение по каждому видео.</p></div><button className="settings-close" onClick={onClose}><X/></button></header><div className="admin-report-list">{loading?<p>Загружаем жалобы...</p>:error?<p className="upload-message error">{error}</p>:reports.length===0?<p>Жалоб пока нет. Всё спокойно.</p>:reports.map(r=><article className="admin-report" key={r.id}><div className="admin-report-top"><span className={'report-status status-'+r.status}>{r.status==='new'?'Новая':r.status==='reviewed'?'Рассмотрена':'Отклонена'}</span><small>{new Date(r.created_at).toLocaleString('ru-RU')}</small></div><h3>{r.video_title}</h3><div className="admin-report-meta">Автор видео: <b>{r.videoOwner}</b> · Жалоба от: <b>{r.reporter_name}</b></div><p><b>Причина:</b> {r.reason}</p>{r.details&&<p className="report-details">{r.details}</p>}<div className="admin-report-actions">{r.video_url&&<a className="report-link" href={r.video_url} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Ссылка на видео</a>}{r.streamUrl&&<button onClick={()=>onOpenVideo({id:r.videoId,ownerId:String(r.owner_id||''),title:r.video_title,channel:r.videoOwner,views:'Жалоба',time:'',image:r.image,videoUrl:r.streamUrl,isPublic:true})}><ExternalLink size={15}/> Открыть видео</button>}{r.videoId&&<button className="danger-action" onClick={()=>remove(r)}><Trash2 size={15}/> Удалить видео</button>}{r.status==='new'&&<><button onClick={()=>setStatus(r.id,'reviewed')}>Рассмотрена</button><button onClick={()=>setStatus(r.id,'rejected')}>Отклонить жалобу</button></>}</div></article>)}</div></section></div>;
}

function SettingsPage({settings,onChange,user,onLogout}) {
 const [section,setSection]=useState('Внешний вид');
 const sections=[['Внешний вид','◐'],['Воспроизведение','▷'],['Уведомления','♧'],['Конфиденциальность','◇'],['Аккаунт','○']];
 const update=(key,value)=>onChange({...settings,[key]:value});
 return <section className="settings-dialog settings-page page-transition">
  <header className="settings-header"><div><div className="eyebrow">MIRVEX PERSONAL</div><h2>Настройки</h2><p>Настрой платформу под себя.</p></div></header>
  <div className="settings-body"><nav className="settings-tabs">{sections.map(([name,mark])=><button key={name} className={section===name?'current':''} onClick={()=>setSection(name)}><span>{mark}</span>{name}</button>)}</nav>
   <div className="settings-content">
    {section==='Внешний вид'&&<><div className="settings-section-title">Интерфейс</div>
     <div className="setting-row"><div><b>Оформление</b><small>Выбери оттенок интерфейса</small></div><div className="setting-choice"><button className={settings.theme==='dark'?'chosen':''} onClick={()=>update('theme','dark')}>Тёмное</button><button className={settings.theme==='black'?'chosen':''} onClick={()=>update('theme','black')}>Чёрное</button></div></div>
     <div className="setting-row"><div><b>Цвет акцента</b><small>Цвет активных элементов и кнопок</small></div><div className="accent-options">{[["violet","Фиолетовый"],["blue","Синий"],["green","Зелёный"],["orange","Оранжевый"]].map(([v,n])=><button key={v} title={n} aria-label={n} className={settings.accent===v?"picked "+v:v} onClick={()=>update("accent",v)}/>)}</div></div>
     <div className="setting-row"><div><b>Размер текста</b><small>Масштаб подписей и заголовков</small></div><select value={settings.fontSize} onChange={e=>update('fontSize',e.target.value)}><option value="small">Маленький</option><option value="normal">Обычный</option><option value="large">Крупный</option></select></div>
     <div className="setting-row"><div><b>Плотность карточек</b><small>Больше видео на одном экране</small></div><div className="setting-choice"><button className={!settings.compact?'chosen':''} onClick={()=>update('compact',false)}>Обычная</button><button className={settings.compact?'chosen':''} onClick={()=>update('compact',true)}>Компактная</button></div></div>
     <div className="setting-row"><div><b>Уменьшить анимации</b><small>Меньше движения и переходов</small></div><input type="checkbox" checked={settings.reduceMotion} onChange={e=>update('reduceMotion',e.target.checked)}/></div>
     <div className="settings-section-title ambient-title">Атмосфера</div>
     <div className="setting-row"><div><b>Эффект на фоне</b><small>Снег или падающие лепестки сакуры</small></div><select value={settings.effect||'none'} onChange={e=>update('effect',e.target.value)}><option value="none">Выключено</option><option value="snow">Снег ❄</option><option value="sakura">Сакура 🌸</option></select></div>
     {(settings.effect||'none')!=='none'&&<>
      <div className="setting-row"><div><b>Количество частиц</b><small>{settings.effectDensity||38}% · меньше или больше эффекта</small></div><input aria-label="Количество частиц" type="range" min="10" max="100" value={settings.effectDensity||38} onChange={e=>update('effectDensity',Number(e.target.value))}/></div>
      <div className="setting-row"><div><b>Скорость</b><small>Темп движения частиц</small></div><select value={settings.effectSpeed||'normal'} onChange={e=>update('effectSpeed',e.target.value)}><option value="slow">Медленно</option><option value="normal">Обычно</option><option value="fast">Быстро</option></select></div>
     </>}
    </>}
    {section==='Воспроизведение'&&<><div className="settings-section-title">Плеер</div>
     <div className="setting-row"><div><b>Автовоспроизведение</b><small>Запускать видео автоматически при открытии</small></div><input type="checkbox" checked={settings.autoplay} onChange={e=>update('autoplay',e.target.checked)}/></div>
     <p className="settings-note">Настройки плеера применяются к просмотру на этом устройстве.</p>
    </>}
    {section==='Уведомления'&&<><div className="settings-section-title">Уведомления</div>
     <div className="setting-row"><div><b>Новые подписчики</b><small>Показывать уведомления о подписках</small></div><input type="checkbox" checked={settings.notifySubscribers!==false} onChange={e=>update('notifySubscribers',e.target.checked)}/></div>
     <div className="setting-row"><div><b>Активность видео</b><small>Новости о лайках и комментариях</small></div><input type="checkbox" checked={settings.notifyActivity!==false} onChange={e=>update('notifyActivity',e.target.checked)}/></div>
     <div className="setting-row"><div><b>Рекомендации</b><small>Подборки и новые видео</small></div><input type="checkbox" checked={settings.notifyRecommendations!==false} onChange={e=>update('notifyRecommendations',e.target.checked)}/></div>
     <p className="settings-note">Настройки сохраняются на этом устройстве. Системная отправка push-уведомлений пока не подключена.</p>
    </>}
    {section==='Конфиденциальность'&&<><div className="settings-section-title">Твоя приватность</div>
     <div className="setting-row"><div><b>Показывать историю просмотров</b><small>Сохранять недавно просмотренные видео</small></div><input type="checkbox" checked={settings.saveHistory!==false} onChange={e=>update('saveHistory',e.target.checked)}/></div>
     <div className="setting-row"><div><b>Персональные рекомендации</b><small>Учитывать историю для подбора видео</small></div><input type="checkbox" checked={settings.personalRecommendations!==false} onChange={e=>update('personalRecommendations',e.target.checked)}/></div>
     <button className="settings-logout privacy-clear" onClick={()=>{if(confirm('Очистить историю просмотров на этом устройстве?')){localStorage.removeItem('mirvex_watch_history');window.dispatchEvent(new Event('mirvex:clear-history'));}}}>Очистить историю просмотров</button>
     <p className="settings-note">Публичные видео и профиль управляются отдельно от этих параметров.</p>
    </>}
    {section==='Аккаунт'&&<><div className="settings-section-title">Твой аккаунт</div>
     <div className="account-settings-card"><div className="account-settings-avatar">{(user?.username?.[0]||'M').toUpperCase()}</div><div><b>{user?.username||'Гость'}</b><small>{user?.email||'Войди, чтобы синхронизировать библиотеку'}</small></div></div>
     {user&&<button className="settings-logout" onClick={onLogout}>Выйти из аккаунта</button>}
     <p className="settings-note">Параметры интерфейса сохраняются на этом устройстве.</p>
    </>}
   </div>
  </div>
  <footer className="settings-footer"><span>Изменения сохраняются автоматически</span><span className="settings-saved">Сохранено</span></footer>
 </section>;
}


function ProfilePage({profile,onSubscribe,own,onOpenVideo}) {
 const [tab,setTab]=useState('Видео');
 if(!profile)return null;
 return <section className="profile-dialog profile-page page-transition"><div className="profile-cover"><span>MIRVEX CREATOR CHANNEL</span><strong>{profile.user.username}</strong></div><div className="profile-main"><div className="profile-large-avatar">{(profile.user.username?.[0]||'M').toUpperCase()}</div><div className="profile-identity"><h2>{profile.user.username}</h2><small>@{profile.user.username} · Канал MIRVEX</small></div>{!own&&<button className="profile-follow" onClick={()=>onSubscribe(!profile.isFollowing)}>{profile.isFollowing?'Вы подписаны':'Подписаться'}</button>}</div><div className="profile-stats"><div><b>{Number(profile.followers||0).toLocaleString('ru-RU')}</b><span>Подписчики</span></div><div><b>{Number(profile.likes||0).toLocaleString('ru-RU')}</b><span>Лайки</span></div><div><b>{Number(profile.videos||0).toLocaleString('ru-RU')}</b><span>Видео</span></div></div><nav className="channel-tabs">{['Видео','О канале'].map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</nav>{tab==='Видео'?<><div className="profile-video-heading">Видео канала</div><div className="profile-videos">{profile.videosList?.length?profile.videosList.map(v=><button key={v.id} className="profile-video-item" onClick={()=>onOpenVideo(v)}><img src={v.image} alt=""/><span>{v.title}</span><small>Смотреть видео</small></button>):<p>Пока нет опубликованных видео</p>}</div></>:<div className="channel-about"><h3>О канале</h3><p>Канал <b>{profile.user.username}</b> на MIRVEX.</p><div><span>На MIRVEX с</span><b>{profile.user.createdAt?new Date(profile.user.createdAt).toLocaleDateString('ru-RU',{month:'long',year:'numeric'}):'Недавно'}</b></div><div className="channel-video-count"><b>{Number(profile.videos||0).toLocaleString('ru-RU')}</b><span>Опубликовано видео</span></div></div>}</section>;
}


function AmbientEffect({type,density=35,speed='normal'}) {
 if(!type||type==='none') return null;
 const count=Math.max(8,Math.min(90,Math.round(Number(density)*0.9)));
 const glyph=type==='snow'?'❄':'✿';
 return <div className={'ambient-effect ambient-'+type+' speed-'+speed} aria-hidden="true">{Array.from({length:count},(_,i)=><span key={i} style={{left:((i*37)%100)+'%',animationDelay:('-'+((i*13)%24))+'s',animationDuration:(speed==='slow'?24:speed==='fast'?9:16)+((i*7)%12)+'s',fontSize:(type==='snow'?8+(i*5)%12:10+(i*7)%13)+'px',opacity:.25+((i*11)%65)/100}}>{glyph}</span>)}</div>;
}


function StudioPage({token,onLogin}){
 const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let live=true;fetch('https://mirvex-api.onrender.com/api/studio/overview',{headers:{Authorization:'Bearer '+token}}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось загрузить статистику');return d;}).then(d=>{if(live)setData(d);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[token]);
 if(!token)return <section className="studio-empty"><div className="eyebrow">MIRVEX CREATOR STUDIO</div><h1>Студия автора</h1><p>Войди в аккаунт, чтобы видеть статистику своих видео.</p><button className="upload-submit" onClick={onLogin}>Войти в аккаунт</button></section>;
 if(loading)return <section className="studio-empty"><div className="eyebrow">MIRVEX CREATOR STUDIO</div><h1>Загружаем статистику…</h1></section>;
 if(error)return <section className="studio-empty"><div className="eyebrow">MIRVEX CREATOR STUDIO</div><h1>Не удалось открыть студию</h1><p>{error}</p></section>;
 const totals=data?.totals||{},daily=data?.daily||[],videos=data?.videos||[],max=Math.max(1,...daily.map(x=>Number(x.views||0)));
 return <section className="studio-page"><div className="page-heading"><div><div className="eyebrow">MIRVEX CREATOR STUDIO</div><h1>Студия автора</h1><p>Реальная статистика твоего канала и опубликованных видео.</p></div></div>
  <div className="studio-stats"><article><span><Eye size={18}/> Просмотры</span><b>{Number(totals.views||0).toLocaleString('ru-RU')}</b><small>За всё время</small></article><article><span><Film size={18}/> Видео</span><b>{Number(totals.videos||0).toLocaleString('ru-RU')}</b><small>Готовые ролики</small></article><article><span><Heart size={18}/> Лайки</span><b>{Number(totals.likes||0).toLocaleString('ru-RU')}</b><small>На твоих видео</small></article><article><span><MessageCircle size={18}/> Комментарии</span><b>{Number(totals.comments||0).toLocaleString('ru-RU')}</b><small>От зрителей</small></article></div>
  <div className="studio-panel"><div className="section-title"><div><h2>Просмотры за 7 дней</h2><span>Статистика обновляется при просмотре авторизованными пользователями</span></div></div><div className="studio-chart">{daily.map((d,i)=><div className="studio-chart-col" key={d.day+'-'+i}><b>{d.views}</b><i><span style={{height:Math.max(4,Number(d.views||0)/max*100)+'%'}}/></i><small>{d.day}</small></div>)}</div></div>
  <div className="studio-panel"><div className="section-title"><div><h2>Твои видео</h2><span>Показатели по каждому ролику</span></div></div>{videos.length?<div className="studio-video-list">{videos.map(v=><article key={v.id}><div><b>{v.title}</b><small>{new Date(v.created_at).toLocaleDateString('ru-RU')}</small></div><span><Eye size={14}/>{v.views}</span><span><Heart size={14}/>{v.likes}</span><span><MessageCircle size={14}/>{v.comments}</span></article>)}</div>:<p className="studio-note">Загрузи и опубликуй первое видео — здесь появится статистика.</p>}</div>
 </section>;
}
function NotificationPanel({token,onClose,onUnread}){
 const [items,setItems]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let live=true;fetch('https://mirvex-api.onrender.com/api/notifications',{headers:{Authorization:'Bearer '+token}}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось загрузить уведомления');return d;}).then(d=>{if(live){setItems(d.notifications||[]);onUnread(d.unread||0);}}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[token]);
 const markRead=async()=>{try{const r=await fetch('https://mirvex-api.onrender.com/api/notifications/read',{method:'POST',headers:{Authorization:'Bearer '+token}});if(!r.ok)throw new Error('Не удалось отметить уведомления');setItems(list=>list.map(x=>({...x,read_at:x.read_at||new Date().toISOString()})));onUnread(0);}catch(e){setError(e.message);}};
 const label=n=>n.kind==='subscriber'?'подписался на твой канал':n.kind==='like'?'поставил лайк твоему видео':'оставил комментарий к видео';
 return <><button className="notification-dismiss" aria-label="Закрыть уведомления" onClick={onClose}/><section className="notification-panel"><header><div><b>Уведомления</b><small>Активность твоего канала</small></div><button onClick={markRead}><CheckCheck size={15}/> Прочитать всё</button><button className="notification-x" onClick={onClose}><X size={17}/></button></header><div className="notification-list">{loading?<p>Загружаем…</p>:error?<p className="studio-note">{error}</p>:items.length?items.map(n=><article className={!n.read_at?'unread':''} key={n.id}><span className="notification-icon">{n.kind==='subscriber'?<Users size={17}/>:n.kind==='like'?<Heart size={17}/>:<MessageCircle size={17}/>}</span><div><p><b>{n.actor_name}</b> {label(n)}</p>{n.video_title&&<small>{n.video_title}</small>}<time>{new Date(n.created_at).toLocaleString('ru-RU')}</time></div></article>):<p className="studio-note">Пока нет уведомлений. Новые подписки, лайки и комментарии появятся здесь.</p>}</div></section></>;
}


function ShortsVideo({src,active}) {
 const videoRef=useRef(null),hlsRef=useRef(null);
 const [playing,setPlaying]=useState(false);
 useEffect(()=>{
  const video=videoRef.current;if(!video||!src)return;
  let hls;
  video.muted=true;video.loop=true;video.playsInline=true;
  if(src.includes('.m3u8')&&!video.canPlayType('application/vnd.apple.mpegurl')&&Hls.isSupported()){
   hls=new Hls({enableWorker:true,capLevelToPlayerSize:true});hlsRef.current=hls;hls.loadSource(src);hls.attachMedia(video);
  }else video.src=src;
  const play=()=>{if(active)video.play().then(()=>setPlaying(true)).catch(()=>setPlaying(false));else{video.pause();setPlaying(false);}};
  video.addEventListener('playing',()=>setPlaying(true));video.addEventListener('pause',()=>setPlaying(false));
  if(hls)hls.on(Hls.Events.MANIFEST_PARSED,play);else if(video.readyState>=2)play();else video.addEventListener('loadeddata',play,{once:true});
  if(!hls)play();
  return()=>{video.pause();video.removeAttribute('src');video.load();hls?.destroy();hlsRef.current=null;};
 },[src,active]);
 const toggle=()=>{const v=videoRef.current;if(!v)return;if(v.paused)v.play().catch(()=>{});else v.pause();};
 return <video ref={videoRef} className="short-video" playsInline muted loop preload={active?'auto':'none'} onClick={toggle} aria-label={playing?'Пауза видео':'Воспроизвести видео'}/>;
}
function ShortsFeed({items,onOpen,onProfile,onLike}) {
 const [activeIndex,setActiveIndex]=useState(0);
 const feedRef=useRef(null);
 const onScroll=()=>{const el=feedRef.current;if(el)setActiveIndex(Math.max(0,Math.min(items.length-1,Math.round(el.scrollTop/Math.max(1,el.clientHeight)))));};
 if(!items.length)return <div className="shorts-empty"><div className="shorts-empty-icon"><PlaySquare size={30}/></div><h2>Пока нет Shorts</h2><p>Загрузи вертикальное видео до 3 минут и опубликуй его для всех — оно появится здесь.</p></div>;
 return <div className="shorts-feed" ref={feedRef} onScroll={onScroll}>
  {items.map((v,i)=><article className="shorts-slide" key={v.id}>
   <ShortsVideo src={v.videoUrl} active={i===activeIndex}/>
   <div className="shorts-shade"/>
   <div className="shorts-topline"><span className="shorts-brand-mark">M</span><b>MIRVEX <i>SHORTS</i></b><span className="shorts-counter">{i+1} / {items.length}</span></div>
   <div className="shorts-caption"><button className="shorts-author" onClick={()=>onProfile(v.ownerId)}><span>{v.avatar}</span>@{v.channel}</button><h2>{v.title}</h2><p>{v.views.toLocaleString('ru-RU')} просмотров</p></div>
   <div className="shorts-actions">
    <button onClick={()=>onLike(v)} aria-label="Поставить лайк"><Heart size={23}/><b>{Number(v.likes||0).toLocaleString('ru-RU')}</b></button>
    <button onClick={()=>onOpen(v)} aria-label="Комментарии"><MessageCircle size={23}/><b>Обсудить</b></button>
    <button onClick={()=>onProfile(v.ownerId)} aria-label="Открыть автора"><UserRound size={22}/><b>Автор</b></button>
    <button onClick={async()=>{const url=window.location.origin+'/?video='+encodeURIComponent(v.id);try{if(navigator.share)await navigator.share({title:v.title,url});else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);alert('Ссылка скопирована');}}catch{}}} aria-label="Поделиться"><ArrowUpRight size={22}/><b>Поделиться</b></button>
   </div>
  </article>)}
 </div>;
}

const ROUTE_PATHS={'Главная':'/','В тренде':'/trending','Shorts':'/shorts','Подписки':'/subscriptions','Студия':'/studio','История':'/history','Смотреть позже':'/watch-later','Плейлисты':'/playlists','Избранное':'/favorites','Профиль':'/profile','Настройки':'/settings'};
function readMirvexRoute(){
 let path=decodeURIComponent(window.location.pathname||'/');
 while(path.length>1&&path.endsWith('/'))path=path.slice(0,-1);
 if(path==='/profile'||path.startsWith('/profile/'))return {page:'Профиль',profileId:path==='/profile'?null:path.slice('/profile/'.length),playlistId:null};
 if(path.startsWith('/playlists/'))return {page:'Плейлисты',profileId:null,playlistId:path.slice('/playlists/'.length)};
 const found=Object.entries(ROUTE_PATHS).find(([,url])=>url===path);
 return {page:found?found[0]:'Главная',profileId:null,playlistId:null};
}
function App(){
 const [route,setRoute]=useState(()=>readMirvexRoute());
 const active=route.page;
 const displayedActive=route.page;
 const pageLeaving=false;
 const [uploadOpen,setUploadOpen]=useState(false);
 const [authOpen,setAuthOpen]=useState(false);
 const [reportOpen,setReportOpen]=useState(false);
 const [adminOpen,setAdminOpen]=useState(false);
 const [notificationsOpen,setNotificationsOpen]=useState(false);
 const [notificationUnread,setNotificationUnread]=useState(0);
 const [trendingVideos,setTrendingVideos]=useState([]);
 const [shortVideos,setShortVideos]=useState([]);
 const [profile,setProfile]=useState(null);
 const [social,setSocial]=useState({likes:0,dislikes:0,userReaction:null,comments:[]});
 const [commentText,setCommentText]=useState('');
 const [settings,setSettings]=useState(()=>{try{return {...{theme:'dark',accent:'violet',fontSize:'normal',compact:false,reduceMotion:false,autoplay:false,effect:'none',effectDensity:38,effectSpeed:'normal'},...JSON.parse(localStorage.getItem('mirvex_settings')||'{}')}}catch{return {theme:'dark',accent:'violet',fontSize:'normal',compact:false,reduceMotion:false,autoplay:false,effect:'none',effectDensity:38,effectSpeed:'normal'}}});
 useEffect(()=>{localStorage.setItem('mirvex_settings',JSON.stringify(settings));},[settings]);
 const [token,setToken]=useState(()=>localStorage.getItem('mirvex_token')||'');
 const [user,setUser]=useState(null);
 const [uploaded,setUploaded]=useState([]);
 const [publicVideos,setPublicVideos]=useState([]);
 const [favoriteVideos,setFavoriteVideos]=useState([]);
 const [playlists,setPlaylists]=useState([]);
 const [playlistName,setPlaylistName]=useState('');
 const [selectedPlaylistId,setSelectedPlaylistId]=useState(()=>readMirvexRoute().playlistId);
 const navigate=(page,params={})=>{
  const path=params.profileId?'/profile/'+encodeURIComponent(String(params.profileId)):params.playlistId?'/playlists/'+encodeURIComponent(String(params.playlistId)):(ROUTE_PATHS[page]||'/');
  if(window.location.pathname!==path)window.history.pushState({},'',path);
  setRoute(readMirvexRoute());setSelectedPlaylistId(params.playlistId||null);setNotificationsOpen(false);
 };
 useEffect(()=>{const onPopState=()=>{const next=readMirvexRoute();setRoute(next);setSelectedPlaylistId(next.playlistId||null);};window.addEventListener('popstate',onPopState);return()=>window.removeEventListener('popstate',onPopState);},[]);
 useEffect(()=>{if(token&&['Избранное','Плейлисты'].includes(active))loadLibrary(token);},[active,token]);
 useEffect(()=>{
  if(active!=='Профиль')return;
  const id=route.profileId||user?.id;if(!id){if(token)return;setProfile(null);setAuthOpen(true);return;}
  let live=true;
  fetch('https://mirvex-api.onrender.com/api/users/'+id+'/profile',{headers:token?{Authorization:'Bearer '+token}:{}})
   .then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось открыть профиль');return d;})
   .then(d=>{if(live)setProfile({...d,videosList:d.videos||[]});}).catch(e=>{if(live)alert(e.message);});
  return()=>{live=false;};
 },[active,route.profileId,token,user?.id]);
 const [favoriteIds,setFavoriteIds]=useState([]);
 const [watchLaterIds,setWatchLaterIds]=useState(()=>{try{return JSON.parse(localStorage.getItem('mirvex_watch_later')||'[]')}catch{return []}});
 const [watchHistory,setWatchHistory]=useState(()=>{try{return JSON.parse(localStorage.getItem('mirvex_watch_history')||'[]')}catch{return []}});
 useEffect(()=>{localStorage.setItem('mirvex_watch_later',JSON.stringify(watchLaterIds));},[watchLaterIds]);
 useEffect(()=>{localStorage.setItem('mirvex_watch_history',JSON.stringify(watchHistory.slice(0,30)));},[watchHistory]);
 useEffect(()=>{const clear=()=>setWatchHistory([]);window.addEventListener('mirvex:clear-history',clear);return()=>window.removeEventListener('mirvex:clear-history',clear);},[]);
 const loadPublicVideos=async()=>{const r=await fetch('https://mirvex-api.onrender.com/api/public/videos');const d=await r.json();if(r.ok)setPublicVideos(d.videos||[]);};
 const loadShortVideos=async()=>{try{const r=await fetch('https://mirvex-api.onrender.com/api/shorts');const d=await r.json();if(r.ok)setShortVideos(d.videos||[]);}catch{}};
 const loadVideos=async t=>{const r=await fetch('https://mirvex-api.onrender.com/api/videos',{headers:{Authorization:'Bearer '+t}});const d=await r.json();if(r.ok)setUploaded(d.videos||[]);};
 const loadLibrary=async t=>{try{const h={Authorization:'Bearer '+t};const [f,p]=await Promise.all([fetch('https://mirvex-api.onrender.com/api/library/favorites',{headers:h}),fetch('https://mirvex-api.onrender.com/api/library/playlists',{headers:h})]);const [fd,pd]=await Promise.all([f.json(),p.json()]);if(f.ok){setFavoriteVideos(fd.videos||[]);setFavoriteIds((fd.videos||[]).map(v=>v.id));}if(p.ok)setPlaylists(pd.playlists||[]);}catch{}};
 const createPlaylist=async()=>{if(!user){setAuthOpen(true);return;}const title=playlistName.trim();if(!title)return;try{const r=await fetch('https://mirvex-api.onrender.com/api/library/playlists',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({title})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось создать плейлист');setPlaylists(p=>[d.playlist,...p]);setPlaylistName('');}catch(e){alert(e.message);}};
 const toggleFavorite=async video=>{if(!user){setAuthOpen(true);return;}const next=!favoriteIds.includes(video.id);try{const r=await fetch('https://mirvex-api.onrender.com/api/videos/'+video.id+'/favorite',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({favorite:next})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось обновить избранное');setFavoriteIds(ids=>next?[...ids,video.id]:ids.filter(id=>id!==video.id));await loadLibrary(token);}catch(e){alert(e.message);}};
 const addToPlaylist=async playlistId=>{if(!user){setAuthOpen(true);return;}if(!selected)return;try{const r=await fetch('https://mirvex-api.onrender.com/api/library/playlists/'+playlistId+'/videos',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({videoId:selected.id})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось добавить видео');await loadLibrary(token);alert('Видео добавлено в плейлист');}catch(e){alert(e.message);}};
 const deletePlaylist=async id=>{if(!confirm('Удалить плейлист?'))return;try{const r=await fetch('https://mirvex-api.onrender.com/api/library/playlists/'+id,{method:'DELETE',headers:{Authorization:'Bearer '+token}});if(!r.ok)throw new Error('Не удалось удалить плейлист');setPlaylists(p=>p.filter(x=>x.id!==id));if(selectedPlaylistId===id)setSelectedPlaylistId(null);}catch(e){alert(e.message);}};
 const onAuth=d=>{localStorage.setItem('mirvex_token',d.token);setToken(d.token);setUser(d.user);loadVideos(d.token);loadPublicVideos();loadShortVideos();loadLibrary(d.token);};
 const logout=()=>{localStorage.removeItem('mirvex_token');setToken('');setUser(null);setUploaded([]);setFavoriteVideos([]);setFavoriteIds([]);setPlaylists([]);};
 useEffect(()=>{loadPublicVideos();loadShortVideos();fetch('https://mirvex-api.onrender.com/api/trending/videos').then(r=>r.ok?r.json():Promise.reject()).then(d=>setTrendingVideos(d.videos||[])).catch(()=>{});},[]);
 useEffect(()=>{const id=new URLSearchParams(window.location.search).get('video');if(id&&publicVideos.length){const v=publicVideos.find(x=>x.id===id);if(v)setSelected(v);}},[publicVideos]);
 useEffect(()=>{
   if(!token)return;
   let cancelled=false,attempt=0,timer;
   const restore=async()=>{
    try{
     const response=await fetch('https://mirvex-api.onrender.com/api/auth/me',{headers:{Authorization:'Bearer '+token}});
     if(response.status===401){if(!cancelled)logout();return;}
     if(!response.ok)throw new Error('Temporary API error: '+response.status);
     const data=await response.json();
     if(cancelled)return;
     setUser(data.user);loadVideos(token);loadLibrary(token);
    }catch(error){
     if(cancelled)return;
     // Keep the saved session through network errors, Render cold starts, and temporary 5xx responses.
     if(attempt<5){const delay=Math.min(15000,1500*Math.pow(2,attempt++));timer=setTimeout(restore,delay);}
    }
   };
   const onOnline=()=>{clearTimeout(timer);restore();};
   restore();
   window.addEventListener('online',onOnline);
   return()=>{cancelled=true;clearTimeout(timer);window.removeEventListener('online',onOnline);};
  },[token]);
 const removeAdminVideo=id=>{setPublicVideos(items=>items.filter(v=>v.id!==id));setUploaded(items=>items.filter(v=>v.id!==id));if(selected?.id===id)setSelected(null);};
 const addUploaded=item=>{const owned={...item,ownerId:String(user?.id||''),isPublic:true};setUploaded(list=>[owned,...list]);setPublicVideos(list=>[owned,...list.filter(v=>v.id!==owned.id)]);setCategory('Для вас');setSelected(owned);setUploadOpen(false);loadVideos(token);loadPublicVideos();loadShortVideos();};
 const togglePublish=async video=>{try{const next=!video.isPublic;const r=await fetch('https://mirvex-api.onrender.com/api/videos/'+video.id.replace('db-','')+'/publish',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({isPublic:next})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось изменить публикацию');setUploaded(items=>items.map(v=>v.id===video.id?{...v,isPublic:next}:v));setSelected(v=>v?.id===video.id?{...v,isPublic:next}:v);await loadPublicVideos();await loadShortVideos();}catch(e){alert(e.message);}};
 const [category,setCategory]=useState('Для вас');
 const [query,setQuery]=useState('');
 const [searchOpen,setSearchOpen]=useState(false);
 const [searchResults,setSearchResults]=useState({videos:[],users:[]});
 const [searchLoading,setSearchLoading]=useState(false);
 const [selected,setSelected]=useState(null);
 useEffect(()=>{
  const term=query.trim();
  if(!term){setSearchResults({videos:[],users:[]});setSearchLoading(false);return;}
  let cancelled=false;
  const timer=setTimeout(async()=>{
   setSearchLoading(true);
   try{
    const response=await fetch('https://mirvex-api.onrender.com/api/search?q='+encodeURIComponent(term));
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Поиск недоступен');
    if(!cancelled)setSearchResults({videos:data.videos||[],users:data.users||[]});
   }catch{if(!cancelled)setSearchResults({videos:[],users:[]});}
   finally{if(!cancelled)setSearchLoading(false);}
  },250);
  return()=>{cancelled=true;clearTimeout(timer);};
 },[query]);
 const [theaterOpen,setTheaterOpen]=useState(false);
 const [sidebar,setSidebar]=useState(true);
 const [liked,setLiked]=useState([]);
 const loadSocial=async video=>{if(!video?.id)return;try{const r=await fetch('https://mirvex-api.onrender.com/api/videos/'+video.id+'/social',{headers:token?{Authorization:'Bearer '+token}:{}});const d=await r.json();if(r.ok)setSocial(d);}catch{}};
 const openProfile=async id=>{if(!id){if(user)id=user.id;else{setAuthOpen(true);return;}}navigate('Профиль',{profileId:id});};
 const reactToVideo=async reaction=>{if(!user){setAuthOpen(true);return;}try{const next=social.userReaction===reaction?null:reaction;const r=await fetch('https://mirvex-api.onrender.com/api/videos/'+selected.id+'/reaction',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({reaction:next})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось сохранить реакцию');setSocial(x=>({...x,...d}));}catch(e){alert(e.message);}};
 const likeShort=async video=>{if(!user){setAuthOpen(true);return;}try{const r=await fetch('https://mirvex-api.onrender.com/api/videos/'+video.id+'/reaction',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({reaction:'like'})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось поставить лайк');setShortVideos(items=>items.map(v=>v.id===video.id?{...v,...d}:v));}catch(e){alert(e.message);}};
 const postComment=async()=>{if(!user){setAuthOpen(true);return;}const body=commentText.trim();if(!body)return;try{const r=await fetch('https://mirvex-api.onrender.com/api/videos/'+selected.id+'/comments',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({body})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось отправить комментарий');setSocial(x=>({...x,comments:[d.comment,...x.comments]}));setCommentText('');}catch(e){alert(e.message);}};
 const subscribe=async subscribed=>{if(!user){setAuthOpen(true);return;}try{const r=await fetch('https://mirvex-api.onrender.com/api/users/'+profile.user.id+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({subscribed})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось изменить подписку');setProfile(p=>({...p,...d}));}catch(e){alert(e.message);}};
 useEffect(()=>{if(selected)loadSocial(selected);},[selected?.id,token]);
 useEffect(()=>{if(selected?.id&&settings.saveHistory!==false)setWatchHistory(items=>[{id:selected.id,watchedAt:Date.now()},...items.filter(x=>x.id!==selected.id)].slice(0,30));},[selected?.id,settings.saveHistory]);
 const currentPlaylist=playlists.find(p=>p.id===selectedPlaylistId);
 const libraryVideos=[...publicVideos,...uploaded];
 const affinity={};if(settings.personalRecommendations!==false){watchHistory.forEach(h=>{const v=libraryVideos.find(x=>x.id===h.id);if(v)affinity[v.channel]=(affinity[v.channel]||0)+3;});favoriteVideos.forEach(v=>{affinity[v.channel]=(affinity[v.channel]||0)+2;});}
 const personalizedVideos=[...publicVideos].sort((a,b)=>(affinity[b.channel]||0)-(affinity[a.channel]||0));
 const allVideos=displayedActive==='В тренде'?trendingVideos:displayedActive==='Избранное'?favoriteVideos:displayedActive==='Смотреть позже'?libraryVideos.filter(v=>watchLaterIds.includes(v.id)):displayedActive==='История'?libraryVideos.filter(v=>watchHistory.some(h=>h.id===v.id)):displayedActive==='Плейлисты'?(currentPlaylist?.videos||[]):category==='Мои видео'?uploaded:personalizedVideos;
 const continueVideos=watchHistory.map(h=>libraryVideos.find(v=>v.id===h.id)).filter(Boolean).slice(0,6);
 const toggleWatchLater=video=>setWatchLaterIds(ids=>ids.includes(video.id)?ids.filter(id=>id!==video.id):[video.id,...ids]);
 const filtered=useMemo(()=>allVideos.filter(v=> (v.title+' '+v.channel).toLowerCase().includes(query.toLowerCase())),[allVideos,category,query]);
 const nav=[['Главная',House],['В тренде',Flame],['Shorts',PlaySquare],['Подписки',Users],...(user?[['Студия',Clapperboard]]:[])];
 const library=[['История',History],['Смотреть позже',Clock3],['Плейлисты',Bookmark],['Избранное',ThumbsUp]];
 return <div className={"app theme-"+settings.theme+" accent-"+(settings.accent||"violet")+" font-"+settings.fontSize+(settings.compact?" compact-grid":"")+(settings.reduceMotion?" reduce-motion":"")}>
  <header className="topbar">
   <div className="brand-area"><button className="icon-btn menu-btn" onClick={()=>setSidebar(!sidebar)} aria-label="Меню"><Menu/></button><a className="brand" href="/" onClick={e=>{e.preventDefault();navigate('Главная');setCategory('Для вас')}}><span className="brand-mark brand-monogram">M</span><span>MIRVEX<span className="brand-dot">.</span></span></a></div>
   <div className="search-wrap"><div className="search-box"><Search size={18}/><input value={query} onFocus={()=>setSearchOpen(true)} onChange={e=>{setQuery(e.target.value);setSearchOpen(true);}} onKeyDown={e=>{if(e.key==='Enter'&&searchResults.videos[0]){setSelected(searchResults.videos[0]);setSearchOpen(false);}}} placeholder="Поиск видео и каналов"/>{query&&<button className="clear-search" onClick={()=>setQuery('')}><X size={16}/></button>}</div>{searchOpen&&query.trim()&&<div className="search-results">{searchLoading?<div className="search-result-empty">Ищем…</div>:<>{searchResults.videos.map(v=><button className="search-result-item" key={"video-"+v.id} onClick={()=>{setSelected(v);setSearchOpen(false);}}><span className="search-result-icon"><Play size={15}/></span><span><b>{v.title}</b><small>Видео · {v.channel}</small></span></button>)}{searchResults.users.map(u=><button className="search-result-item" key={"user-"+u.id} onClick={()=>{setSearchOpen(false);setQuery('');openProfile(u.id);}}><span className="search-result-avatar">{(u.username||"M").slice(0,1).toUpperCase()}</span><span><b>{u.username}</b><small>Канал пользователя</small></span></button>)}{!searchResults.videos.length&&!searchResults.users.length&&<div className="search-result-empty">Ничего не найдено</div>}</>}</div>}<button className="icon-btn mic-btn" aria-label="Голосовой поиск"><Mic size={18}/></button></div>
   <div className="top-actions"><button className="create-btn" onClick={()=>user?setUploadOpen(true):setAuthOpen(true)}><Plus size={18}/> <span>Создать</span></button><button className="icon-btn notification-btn" aria-label="Уведомления" onClick={()=>user?setNotificationsOpen(v=>!v):setAuthOpen(true)}><Bell size={19}/>{notificationUnread>0&&<i className="notification-dot">{notificationUnread>9?'9+':notificationUnread}</i>}</button><button className="profile-avatar" onClick={()=>user?openProfile(user.id):setAuthOpen(true)} title={user?'Профиль':'Войти'}>{user?(user.username?.[0]||'М').toUpperCase():'Войти'}</button></div>
  </header>
  <div className="layout">
   {sidebar&&<aside className="sidebar">
    <nav>{nav.map(([label,Icon])=><button key={label} className={'nav-item '+(active===label?'active':'')} onClick={()=>{navigate(label);setCategory('Все')}}><Icon size={20}/><span>{label}</span></button>)}</nav>
    <div className="side-divider"/>
    <div className="side-heading">Вы</div>
    {library.map(([label,Icon])=><button key={label} className={'nav-item '+(active===label?'active':'')} onClick={()=>navigate(label)}><Icon size={19}/><span>{label}</span></button>)}
    <div className="side-divider"/>
    <div className="side-heading">Ваши подписки</div>
    {['Дизайн без шума','Космос рядом','Точка сборки'].map((n,i)=><button className="subscription" key={n}><span className="sub-avatar">{['◉','✦','△'][i]}</span>{n}<i/></button>)}
    {user?.isAdmin&&<button className="nav-item admin-nav" onClick={()=>setAdminOpen(true)}><ShieldCheck size={19}/><span>Админка</span></button>}
    <button className={'sidebar-bottom '+(active==='Настройки'?'active':'')} onClick={()=>navigate('Настройки')}><Settings size={16}/> Настройки</button>
   </aside>}
   <main className={'main page-transition '+(pageLeaving?'page-leaving':'')} key={displayedActive}>
    {displayedActive==='Настройки'?<SettingsPage settings={settings} onChange={setSettings} user={user} onLogout={logout}/>:displayedActive==='Профиль'?(profile?<ProfilePage profile={profile} own={String(profile?.user?.id)===String(user?.id)} onSubscribe={subscribe} onOpenVideo={v=>setSelected(v)}/>:<section className="profile-page-loading"><div className="eyebrow">MIRVEX CREATOR</div><h2>Загружаем профиль…</h2></section>):displayedActive==='Студия'?<StudioPage token={token} onLogin={()=>setAuthOpen(true)}/>:displayedActive==='Shorts'?<section className="shorts-page"><div className="shorts-page-heading"><div><div className="eyebrow">MIRVEX · VERTICAL VIDEO</div><h1>Shorts<span>.</span></h1><p>Короткие видео. Большие впечатления.</p></div><button className="shorts-upload-button" onClick={()=>user?setUploadOpen(true):setAuthOpen(true)}><Plus size={17}/> Создать Short</button></div><ShortsFeed items={shortVideos} onOpen={v=>setSelected(v)} onProfile={openProfile} onLike={likeShort}/></section>:<>
    {displayedActive==='Главная'?<section className="welcome"><div><div className="eyebrow">MIRVEX</div><h1>Главная</h1><p>Видео, которые хочется смотреть.</p></div><div className="welcome-art"><div className="art-orb orb-one"/><div className="art-orb orb-two"/><div className="art-play"><Play fill="white" size={25}/></div><span className="art-caption">YOUR NEXT<br/>FAVORITE VIDEO</span></div></section>:<section className="page-heading"><h1>{displayedActive}</h1>{displayedActive==='В тренде'&&<p>Самые популярные видео за последние 7 дней.</p>}{displayedActive==='Плейлисты'&&<p>Твои сохранённые подборки.</p>}</section>}
    {displayedActive==='Главная'&&<div className="category-row">{categories.map(c=><button key={c} onClick={()=>setCategory(c)} className={'category '+(category===c?'selected':'')}>{c}</button>)}</div>}
    {displayedActive==='Главная'&&continueVideos.length>0&&<section className="continue-section"><div className="section-title"><div><h2>Продолжить просмотр</h2><span>Недавно открытые видео</span></div></div><div className="continue-strip">{continueVideos.map(v=>{const progress=Math.max(0,Math.min(100,Number(localStorage.getItem('mirvex_progress_'+v.id)||0)/(Number(localStorage.getItem('mirvex_duration_'+v.id)||0)||1)*100));return <button className="continue-card" key={v.id} onClick={()=>setSelected(v)}><img loading="lazy" src={v.image} alt=""/><span><b>{v.title}</b><small>{progress>0?'Продолжить просмотр':'Недавно просмотрено'} · {v.channel}</small><i className="continue-progress"><i style={{width:progress+'%'}}/></i></span></button>;})}</div></section>}{displayedActive==='Плейлисты'&&<section className="playlist-panel">
      <div className="playlist-create"><input value={playlistName} maxLength={60} onChange={e=>setPlaylistName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&createPlaylist()} placeholder="Название нового плейлиста"/><button onClick={createPlaylist} disabled={!playlistName.trim()}>Создать</button></div>
      {currentPlaylist?<div className="playlist-current"><button className="playlist-back" onClick={()=>navigate('Плейлисты')}>← Все плейлисты</button><button className="playlist-delete" onClick={()=>deletePlaylist(currentPlaylist.id)}>Удалить плейлист</button><h2>{currentPlaylist.title}</h2></div>:<div className="playlist-list">{playlists.map(p=><button className="playlist-card" key={p.id} onClick={()=>navigate('Плейлисты',{playlistId:p.id})}><span className="playlist-art"><Bookmark size={23}/></span><b>{p.title}</b><small>{p.videos?.length||0} видео</small></button>)}{playlists.length===0&&<p className="playlist-empty">Плейлистов пока нет. Создай первый!</p>}</div>}
    </section>}
    <div className="section-title"><div><h2>{displayedActive==='Избранное'?'Избранное':displayedActive==='Смотреть позже'?'Смотреть позже':displayedActive==='История'?'История просмотров':displayedActive==='Плейлисты'?(currentPlaylist?'Видео в плейлисте':'Твои плейлисты'):category==='Мои видео'?'Мои видео':'Свежие видео'}</h2><span>{displayedActive==='Избранное'?'Видео, которые ты сохранил':displayedActive==='Смотреть позже'?'Твоя очередь просмотра':displayedActive==='История'?'Недавно просмотренные видео на этом устройстве':displayedActive==='Плейлисты'?'Твоя личная коллекция':category==='Мои видео'?'Видишь только ты':'Видео, опубликованные для всех'}</span></div><button className="sort-btn">Для вас <ChevronDown size={16}/></button></div>
    <div className="video-grid">{filtered.map(v=><article className="video-card" key={v.id}><button className="thumb" onClick={()=>setSelected(v)}><img src={v.image} alt=""/><span className="duration">{v.duration}</span><span className="thumb-hover"><Play fill="white"/></span></button><div className="video-info"><div className="channel-avatar">{v.avatar}</div><div className="video-copy"><button className="video-title" onClick={()=>setSelected(v)}>{v.title}</button><button className="channel-name channel-link" onClick={()=>openProfile(v.ownerId)}>{v.channel}</button><div className="video-meta">{v.views} · {v.time}</div></div><button className="more-btn" aria-label="Ещё"><MoreHorizontal size={19}/></button></div></article>)}</div>
    {filtered.length===0&&displayedActive!=='Плейлисты'&&<div className="empty-state"><Film size={30}/><h3>{category==='Мои видео'?(user?'Пока нет загруженных видео':'Войди в аккаунт'):'Пока нет публичных видео'}</h3><p>{category==='Мои видео'?(user?'Загружай ролики — они появятся здесь.':'Создай аккаунт или войди, чтобы пользоваться библиотекой.'):'Стань первым, кто опубликует видео в MIRVEX.'}</p>{!user&&category==='Мои видео'&&<button className="upload-submit" onClick={()=>setAuthOpen(true)}>Войти / Регистрация</button>}</div>}

    </>}
   </main>
  </div>
  {notificationsOpen&&user&&<NotificationPanel token={token} onClose={()=>setNotificationsOpen(false)} onUnread={setNotificationUnread}/>}
  {adminOpen&&<AdminDialog token={token} onClose={()=>setAdminOpen(false)} onDelete={removeAdminVideo} onOpenVideo={v=>{setAdminOpen(false);setSelected(v);}}/>}{reportOpen&&selected&&<ReportDialog video={selected} token={token} onClose={()=>setReportOpen(false)}/>}
  {uploadOpen&&<UploadDialog token={token} onClose={()=>setUploadOpen(false)} onUploaded={addUploaded}/>}{authOpen&&<AuthDialog onClose={()=>setAuthOpen(false)} onAuth={onAuth}/>}
  {selected&&<div className={'modal-backdrop '+(theaterOpen?'theater-backdrop':'')} onClick={()=>{setSelected(null);setTheaterOpen(false);}}><div className={'video-modal '+(theaterOpen?'theater-modal':'')} onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>{setSelected(null);setTheaterOpen(false);}}><X/></button><div className="modal-player">{selected.videoUrl&&<MuxVideoPlayer src={selected.videoUrl} videoId={selected.id} title={selected.title} channel={selected.channel} autoplay={settings.autoplay} token={token} onTheaterChange={setTheaterOpen}/>}</div><div className="modal-details"><h2>{selected.title}</h2><div className="modal-meta"><button className="modal-channel-link" onClick={()=>openProfile(selected.ownerId)}>{selected.channel}</button> · {selected.views}</div><p>{selected.isPublic?'Публичное видео MIRVEX.':'Это видео доступно только тебе, пока ты его не опубликуешь.'}</p><div className="video-library-actions"><button className={'favorite-action '+(favoriteIds.includes(selected.id)?'saved':'')} onClick={()=>toggleFavorite(selected)}><Bookmark size={16}/>{favoriteIds.includes(selected.id)?'В избранном':'В избранное'}</button><button className={'favorite-action '+(watchLaterIds.includes(selected.id)?'saved':'')} onClick={()=>toggleWatchLater(selected)}><Clock3 size={16}/>{watchLaterIds.includes(selected.id)?'В списке «Смотреть позже»':'Смотреть позже'}</button>{playlists.length>0&&<div className="add-playlist"><select aria-label="Выбрать плейлист" id="mirvex-playlist-select">{playlists.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select><button onClick={()=>{const el=document.getElementById('mirvex-playlist-select');if(el?.value)addToPlaylist(el.value);}}>В плейлист</button></div>}</div>{selected.ownerId&&user&&String(selected.ownerId)===String(user.id)&&<button className="publish-btn" onClick={()=>togglePublish(selected)}>{selected.isPublic?'Скрыть из общей ленты':'Опубликовать для всех'}</button>}{user&&selected.isPublic&&String(selected.ownerId)!==String(user.id)&&<button className="report-video-btn" onClick={()=>setReportOpen(true)}><Flag size={15}/> Пожаловаться</button>}<div className="video-reactions"><button className={social.userReaction==='like'?'reaction-active':''} onClick={()=>reactToVideo('like')}><ThumbsUp size={18}/><b>{social.likes||0}</b></button><button className={social.userReaction==='dislike'?'reaction-active':''} onClick={()=>reactToVideo('dislike')}><ThumbsUp className="dislike-icon" size={18}/><b>{social.dislikes||0}</b></button><span>{social.comments?.length||0} комментариев</span></div><div className="comments-area"><h3>Комментарии</h3><div className="comment-compose"><input value={commentText} maxLength={1000} onChange={e=>setCommentText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&postComment()} placeholder={user?'Написать комментарий...':'Войди, чтобы комментировать'}/><button onClick={postComment} disabled={!commentText.trim()}>Отправить</button></div><div className="comment-list">{(social.comments||[]).map(c=><article className="comment-item" key={c.id}><div className="comment-avatar">{c.username?.[0]?.toUpperCase()||'M'}</div><div><b>{c.username}</b><p>{c.body}</p></div></article>)}</div></div></div></div></div>}
  <AmbientEffect type={settings.reduceMotion?"none":settings.effect} density={settings.effectDensity} speed={settings.effectSpeed}/>
  <footer className="mobile-nav">{[['Главная',House],['Shorts',Flame],['В тренде',Flame],['Избранное',ThumbsUp],['Плейлисты',Bookmark],['Профиль',UserRound],['Настройки',Settings]].map(([n,I])=><button key={n} className={active===n?'mobile-active':''} onClick={()=>{if(n==='Профиль')openProfile(user?.id);else navigate(n);setCategory('Для вас');}}><I size={19}/><span>{n}</span></button>)}</footer>
 </div>
}
createRoot(document.getElementById('root')).render(<App/>);
