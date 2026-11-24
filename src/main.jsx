import React, { useEffect, useMemo, useRef, useState } from 'react';
import mux from 'mux-embed';
import Hls from 'hls.js';
import { createRoot } from 'react-dom/client';
import { Search, House, Compass, PlaySquare, Clock3, ThumbsUp, Flame, Clapperboard, Menu, Plus, Bell, Mic, MoreHorizontal, Play, X, ChevronDown, Film, Radio, UserRound, Settings, History, Bookmark, ArrowUpRight } from 'lucide-react';
import './styles.css';

const videos = [];
const shorts = [];
const categories=['Для вас','Мои видео'];

function MuxVideoPlayer({ src, videoId, title, channel, autoplay }) {
 const videoRef = useRef(null);
 useEffect(() => {
  const video = videoRef.current;
  const envKey = import.meta.env.VITE_MUX_ENV_KEY;
  if (!video || !src || !envKey) return;
  let hls;
  if (src.endsWith('.m3u8') && !video.canPlayType('application/vnd.apple.mpegurl') && Hls.isSupported()) {
   hls = new Hls({ enableWorker: true });
   hls.loadSource(src);
   hls.attachMedia(video);
  } else {
   video.src = src;
  }
  mux.monitor(video, {
   debug: false,
   respectDoNotTrack: true,
   disableCookies: true,
   data: {
    env_key: envKey,
    player_name: 'MIRVEX HTML5 Player',
    player_version: '1.0.0',
    player_init_time: mux.utils.now(),
    video_id: String(videoId ?? 'unknown'),
    video_title: title || 'Untitled video',
    video_series: channel || 'MIRVEX',
    video_stream_type: 'on-demand'
   }
  });
  return () => { hls?.destroy(); video.mux?.destroy?.(); };
 }, [src, videoId, title, channel]);
 return <video ref={videoRef} className="mux-video" src={src} controls playsInline preload="metadata" autoPlay={autoplay} />;
}

function UploadDialog({ onClose, onUploaded, token }) {
 const [file,setFile]=useState(null);
 const [cover,setCover]=useState(null);
 const [title,setTitle]=useState('');
 const [status,setStatus]=useState('idle');
 const [progress,setProgress]=useState(0);
 const [message,setMessage]=useState('');
 const chooseRef=useRef(null);
 const coverRef=useRef(null);
 async function upload() {
  if (!file) return;
  setStatus('uploading'); setProgress(0); setMessage('Создаём защищённую ссылку...');
  try {
   const created=await fetch('https://mirvex-api.onrender.com/api/uploads',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({title:title||file.name})});
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
   const item={id:'db-'+ready.videoId,title:title||file.name,channel:'Мой канал',views:'Новое видео',time:'Только что',duration:'',image:cover?URL.createObjectURL(cover):'https://image.mux.com/'+ready.playbackId+'/thumbnail.jpg?width=900',avatar:'М',category:'Мои видео',videoUrl:'https://stream.mux.com/'+ready.playbackId+'.m3u8'};
   onUploaded(item);
   setStatus('done'); setMessage('Видео опубликовано и готово к просмотру!');
  } catch(e){setStatus('error');setMessage(e.message||'Не удалось загрузить видео');}
 }
 return <div className="upload-backdrop" onClick={onClose}><div className="upload-dialog" onClick={e=>e.stopPropagation()}>
  <button className="modal-close" onClick={onClose}><X/></button><div className="eyebrow">MIRVEX STUDIO</div><h2>Загрузить видео</h2><p className="upload-hint">Выбери видео с устройства. Файл отправится напрямую в Mux.</p>
  <label className="upload-field">Название видео<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Например, мой первый ролик"/></label>
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


function SettingsDialog({settings,onChange,onClose,user,onLogout}) {
 const [section,setSection]=useState('Внешний вид');
 const sections=[['Внешний вид','◐'],['Воспроизведение','▷'],['Аккаунт','○']];
 const update=(key,value)=>onChange({...settings,[key]:value});
 return <div className="settings-backdrop" onClick={onClose}><section className="settings-dialog" onClick={e=>e.stopPropagation()}>
  <header className="settings-header"><div><div className="eyebrow">MIRVEX PERSONAL</div><h2>Настройки</h2><p>Настрой платформу под себя.</p></div><button className="settings-close" onClick={onClose}><X/></button></header>
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
    {section==='Аккаунт'&&<><div className="settings-section-title">Твой аккаунт</div>
     <div className="account-settings-card"><div className="account-settings-avatar">{(user?.username?.[0]||'M').toUpperCase()}</div><div><b>{user?.username||'Гость'}</b><small>{user?.email||'Войди, чтобы синхронизировать библиотеку'}</small></div></div>
     {user&&<button className="settings-logout" onClick={onLogout}>Выйти из аккаунта</button>}
     <p className="settings-note">Параметры интерфейса сохраняются на этом устройстве.</p>
    </>}
   </div>
  </div>
  <footer className="settings-footer"><span>Изменения сохраняются автоматически</span><button onClick={onClose}>Готово</button></footer>
 </section></div>;
}


function ProfileDialog({profile,onClose,onSubscribe,own}) {
 if(!profile)return null;
 return <div className="profile-backdrop" onClick={onClose}><section className="profile-dialog" onClick={e=>e.stopPropagation()}><button className="profile-close" onClick={onClose}><X/></button><div className="profile-cover"><span>MIRVEX CREATOR</span></div><div className="profile-main"><div className="profile-large-avatar">{(profile.user.username?.[0]||'M').toUpperCase()}</div><div className="profile-identity"><h2>{profile.user.username}</h2><small>@{profile.user.username} · MIRVEX</small></div>{!own&&<button className="profile-follow" onClick={()=>onSubscribe(!profile.isFollowing)}>{profile.isFollowing?'Вы подписаны':'Подписаться'}</button>}</div><div className="profile-stats"><div><b>{Number(profile.followers||0).toLocaleString('ru-RU')}</b><span>Подписчики</span></div><div><b>{Number(profile.likes||0).toLocaleString('ru-RU')}</b><span>Лайки</span></div><div><b>{Number(profile.videos||0).toLocaleString('ru-RU')}</b><span>Видео</span></div></div><div className="profile-video-heading">Публичные видео</div><div className="profile-videos">{profile.videosList?.length?profile.videosList.map(v=><div key={v.id} className="profile-video-item"><img src={v.image}/><span>{v.title}</span></div>):<p>Пока нет опубликованных видео</p>}</div></section></div>;
}


function AmbientEffect({type,density=35,speed='normal'}) {
 if(!type||type==='none') return null;
 const count=Math.max(8,Math.min(90,Math.round(Number(density)*0.9)));
 const glyph=type==='snow'?'❄':'✿';
 return <div className={'ambient-effect ambient-'+type+' speed-'+speed} aria-hidden="true">{Array.from({length:count},(_,i)=><span key={i} style={{left:((i*37)%100)+'%',animationDelay:('-'+((i*13)%24))+'s',animationDuration:(speed==='slow'?24:speed==='fast'?9:16)+((i*7)%12)+'s',fontSize:(type==='snow'?8+(i*5)%12:10+(i*7)%13)+'px',opacity:.25+((i*11)%65)/100}}>{glyph}</span>)}</div>;
}

function App(){
 const [active,setActive]=useState('Главная');
 const [uploadOpen,setUploadOpen]=useState(false);
 const [authOpen,setAuthOpen]=useState(false);
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [profileOpen,setProfileOpen]=useState(false);
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
 const [selectedPlaylistId,setSelectedPlaylistId]=useState(null);
 const [favoriteIds,setFavoriteIds]=useState([]);
 const loadPublicVideos=async()=>{const r=await fetch('https://mirvex-api.onrender.com/api/public/videos');const d=await r.json();if(r.ok)setPublicVideos(d.videos||[]);};
 const loadVideos=async t=>{const r=await fetch('https://mirvex-api.onrender.com/api/videos',{headers:{Authorization:'Bearer '+t}});const d=await r.json();if(r.ok)setUploaded(d.videos||[]);};
 const loadLibrary=async t=>{try{const h={Authorization:'Bearer '+t};const [f,p]=await Promise.all([fetch('https://mirvex-api.onrender.com/api/library/favorites',{headers:h}),fetch('https://mirvex-api.onrender.com/api/library/playlists',{headers:h})]);const [fd,pd]=await Promise.all([f.json(),p.json()]);if(f.ok){setFavoriteVideos(fd.videos||[]);setFavoriteIds((fd.videos||[]).map(v=>v.id));}if(p.ok)setPlaylists(pd.playlists||[]);}catch{}};
 const createPlaylist=async()=>{if(!user){setAuthOpen(true);return;}const title=playlistName.trim();if(!title)return;try{const r=await fetch('https://mirvex-api.onrender.com/api/library/playlists',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({title})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось создать плейлист');setPlaylists(p=>[d.playlist,...p]);setPlaylistName('');}catch(e){alert(e.message);}};
 const toggleFavorite=async video=>{if(!user){setAuthOpen(true);return;}const next=!favoriteIds.includes(video.id);try{const r=await fetch('https://mirvex-api.onrender.com/api/videos/'+video.id+'/favorite',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({favorite:next})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось обновить избранное');setFavoriteIds(ids=>next?[...ids,video.id]:ids.filter(id=>id!==video.id));await loadLibrary(token);}catch(e){alert(e.message);}};
 const addToPlaylist=async playlistId=>{if(!user){setAuthOpen(true);return;}if(!selected)return;try{const r=await fetch('https://mirvex-api.onrender.com/api/library/playlists/'+playlistId+'/videos',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({videoId:selected.id})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось добавить видео');await loadLibrary(token);alert('Видео добавлено в плейлист');}catch(e){alert(e.message);}};
 const deletePlaylist=async id=>{if(!confirm('Удалить плейлист?'))return;try{const r=await fetch('https://mirvex-api.onrender.com/api/library/playlists/'+id,{method:'DELETE',headers:{Authorization:'Bearer '+token}});if(!r.ok)throw new Error('Не удалось удалить плейлист');setPlaylists(p=>p.filter(x=>x.id!==id));if(selectedPlaylistId===id)setSelectedPlaylistId(null);}catch(e){alert(e.message);}};
 const onAuth=d=>{localStorage.setItem('mirvex_token',d.token);setToken(d.token);setUser(d.user);loadVideos(d.token);loadPublicVideos();loadLibrary(d.token);};
 const logout=()=>{localStorage.removeItem('mirvex_token');setToken('');setUser(null);setUploaded([]);setFavoriteVideos([]);setFavoriteIds([]);setPlaylists([]);};
 useEffect(()=>{loadPublicVideos();},[]);
 useEffect(()=>{if(!token)return;fetch('https://mirvex-api.onrender.com/api/auth/me',{headers:{Authorization:'Bearer '+token}}).then(r=>r.ok?r.json():Promise.reject()).then(d=>{setUser(d.user);loadVideos(token);loadLibrary(token)}).catch(()=>logout());},[]);
 const addUploaded=item=>{const owned={...item,ownerId:String(user?.id||''),isPublic:false};setUploaded(list=>[owned,...list]);setCategory('Мои видео');setSelected(owned);setUploadOpen(false);loadVideos(token);};
 const togglePublish=async video=>{try{const next=!video.isPublic;const r=await fetch('https://mirvex-api.onrender.com/api/videos/'+video.id.replace('db-','')+'/publish',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({isPublic:next})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось изменить публикацию');setUploaded(items=>items.map(v=>v.id===video.id?{...v,isPublic:next}:v));setSelected(v=>v?.id===video.id?{...v,isPublic:next}:v);await loadPublicVideos();}catch(e){alert(e.message);}};
 const [category,setCategory]=useState('Для вас');
 const [query,setQuery]=useState('');
 const [searchOpen,setSearchOpen]=useState(false);
 const [selected,setSelected]=useState(null);
 const [sidebar,setSidebar]=useState(true);
 const [liked,setLiked]=useState([]);
 const loadSocial=async video=>{if(!video?.id)return;try{const r=await fetch('https://mirvex-api.onrender.com/api/videos/'+video.id+'/social',{headers:token?{Authorization:'Bearer '+token}:{}});const d=await r.json();if(r.ok)setSocial(d);}catch{}};
 const openProfile=async id=>{if(!id){if(user)id=user.id;else{setAuthOpen(true);return;}}try{const r=await fetch('https://mirvex-api.onrender.com/api/users/'+id+'/profile',{headers:token?{Authorization:'Bearer '+token}:{}});const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось открыть профиль');setProfile({...d,videosList:d.videos||[]});setProfileOpen(true);}catch(e){alert(e.message);}};
 const reactToVideo=async reaction=>{if(!user){setAuthOpen(true);return;}try{const next=social.userReaction===reaction?null:reaction;const r=await fetch('https://mirvex-api.onrender.com/api/videos/'+selected.id+'/reaction',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({reaction:next})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось сохранить реакцию');setSocial(x=>({...x,...d}));}catch(e){alert(e.message);}};
 const postComment=async()=>{if(!user){setAuthOpen(true);return;}const body=commentText.trim();if(!body)return;try{const r=await fetch('https://mirvex-api.onrender.com/api/videos/'+selected.id+'/comments',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({body})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось отправить комментарий');setSocial(x=>({...x,comments:[d.comment,...x.comments]}));setCommentText('');}catch(e){alert(e.message);}};
 const subscribe=async subscribed=>{if(!user){setAuthOpen(true);return;}try{const r=await fetch('https://mirvex-api.onrender.com/api/users/'+profile.user.id+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({subscribed})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось изменить подписку');setProfile(p=>({...p,...d}));}catch(e){alert(e.message);}};
 useEffect(()=>{if(selected)loadSocial(selected);},[selected?.id,token]);
 const currentPlaylist=playlists.find(p=>p.id===selectedPlaylistId);\n const allVideos=active==='Избранное'?favoriteVideos:active==='Плейлисты'?(currentPlaylist?.videos||[]):category==='Мои видео'?uploaded:publicVideos;
 const filtered=useMemo(()=>allVideos.filter(v=> (v.title+' '+v.channel).toLowerCase().includes(query.toLowerCase())),[category,query,uploaded,publicVideos]);
 const nav=[['Главная',House],['Shorts',Flame],['Подписки',PlaySquare]];
 const library=[['История',History],['Плейлисты',Bookmark],['Избранное',ThumbsUp]];
 return <div className={"app theme-"+settings.theme+" accent-"+(settings.accent||"violet")+" font-"+settings.fontSize+(settings.compact?" compact-grid":"")+(settings.reduceMotion?" reduce-motion":"")}>
  <header className="topbar">
   <div className="brand-area"><button className="icon-btn menu-btn" onClick={()=>setSidebar(!sidebar)} aria-label="Меню"><Menu/></button><a className="brand" href="#" onClick={()=>{setActive('Главная');setCategory('Для вас')}}><span className="brand-mark brand-monogram">M</span><span>MIRVEX<span className="brand-dot">.</span></span></a></div>
   <div className="search-wrap"><div className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск видео и каналов"/>{query&&<button className="clear-search" onClick={()=>setQuery('')}><X size={16}/></button>}</div><button className="icon-btn mic-btn" aria-label="Голосовой поиск"><Mic size={18}/></button></div>
   <div className="top-actions"><button className="create-btn" onClick={()=>user?setUploadOpen(true):setAuthOpen(true)}><Plus size={18}/> <span>Создать</span></button><button className="icon-btn notification-btn" aria-label="Уведомления"><Bell size={19}/></button><button className="profile-avatar" onClick={()=>user?openProfile(user.id):setAuthOpen(true)} title={user?'Профиль':'Войти'}>{user?(user.username?.[0]||'М').toUpperCase():'Войти'}</button></div>
  </header>
  <div className="layout">
   {sidebar&&<aside className="sidebar">
    <nav>{nav.map(([label,Icon])=><button key={label} className={'nav-item '+(active===label?'active':'')} onClick={()=>{setActive(label);setCategory('Все')}}><Icon size={20}/><span>{label}</span></button>)}</nav>
    <div className="side-divider"/>
    <div className="side-heading">Вы</div>
    {library.map(([label,Icon])=><button key={label} className={'nav-item '+(active===label?'active':'')} onClick={()=>{setActive(label);setSelectedPlaylistId(null);if(label==='Избранное'&&token)loadLibrary(token);}}><Icon size={19}/><span>{label}</span></button>)}
    <div className="side-divider"/>
    <div className="side-heading">Ваши подписки</div>
    {['Дизайн без шума','Космос рядом','Точка сборки'].map((n,i)=><button className="subscription" key={n}><span className="sub-avatar">{['◉','✦','△'][i]}</span>{n}<i/></button>)}
    <button className="sidebar-bottom" onClick={()=>setSettingsOpen(true)}><Settings size={16}/> Настройки</button>
   </aside>}
   <main className="main">
    {active==='Shorts'?<><div className="page-heading"><div><div className="eyebrow">БЫСТРО И ПО ДЕЛУ</div><h1>Shorts</h1><p>Вертикальные видео, которые затягивают.</p></div></div><div className="shorts-grid">{shorts.map(s=><button className="short-card" key={s.id} onClick={()=>setSelected({title:s.title,channel:'MIRVEX Shorts',views:s.views+' просмотров',time:'Сейчас',duration:'0:32',image:s.image,avatar:'✦'})}><img src={s.image}/><span className="short-play"><Play fill="white"/></span><strong>{s.title}</strong><small>{s.views} просмотров</small></button>)}</div></>:<>
    <section className="welcome"><div><div className="eyebrow">ТВОЯ ВИДЕОПЛАТФОРМА</div><h1>{active==='Главная'?'Смотри новое':active}</h1><p>{category==='Мои видео'?'Твоя личная видеотека.':'Публичные видео сообщества MIRVEX.'}</p></div><div className="welcome-art"><div className="art-orb orb-one"/><div className="art-orb orb-two"/><div className="art-play"><Play fill="white" size={25}/></div><span className="art-caption">YOUR NEXT<br/>FAVORITE VIDEO</span></div></section>
    {active==='Главная'&&<div className="category-row">{categories.map(c=><button key={c} onClick={()=>setCategory(c)} className={'category '+(category===c?'selected':'')}>{c}</button>)}</div>}
    {active==='Плейлисты'&&<section className="playlist-panel">
      <div className="playlist-create"><input value={playlistName} maxLength={60} onChange={e=>setPlaylistName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&createPlaylist()} placeholder="Название нового плейлиста"/><button onClick={createPlaylist} disabled={!playlistName.trim()}>Создать</button></div>
      {currentPlaylist?<div className="playlist-current"><button className="playlist-back" onClick={()=>setSelectedPlaylistId(null)}>← Все плейлисты</button><button className="playlist-delete" onClick={()=>deletePlaylist(currentPlaylist.id)}>Удалить плейлист</button><h2>{currentPlaylist.title}</h2></div>:<div className="playlist-list">{playlists.map(p=><button className="playlist-card" key={p.id} onClick={()=>setSelectedPlaylistId(p.id)}><span className="playlist-art"><Bookmark size={23}/></span><b>{p.title}</b><small>{p.videos?.length||0} видео</small></button>)}{playlists.length===0&&<p className="playlist-empty">Плейлистов пока нет. Создай первый!</p>}</div>}
    </section>}
    <div className="section-title"><div><h2>{active==='Избранное'?'Избранное':active==='Плейлисты'?(currentPlaylist?'Видео в плейлисте':'Твои плейлисты'):category==='Мои видео'?'Мои видео':'Свежие видео'}</h2><span>{active==='Избранное'?'Видео, которые ты сохранил':active==='Плейлисты'?'Твоя личная коллекция':category==='Мои видео'?'Видишь только ты':'Видео, опубликованные для всех'}</span></div><button className="sort-btn">Для вас <ChevronDown size={16}/></button></div>
    <div className="video-grid">{filtered.map(v=><article className="video-card" key={v.id}><button className="thumb" onClick={()=>setSelected(v)}><img src={v.image} alt=""/><span className="duration">{v.duration}</span><span className="thumb-hover"><Play fill="white"/></span></button><div className="video-info"><div className="channel-avatar">{v.avatar}</div><div className="video-copy"><button className="video-title" onClick={()=>setSelected(v)}>{v.title}</button><button className="channel-name channel-link" onClick={()=>openProfile(v.ownerId)}>{v.channel}</button><div className="video-meta">{v.views} · {v.time}</div></div><button className="more-btn" aria-label="Ещё"><MoreHorizontal size={19}/></button></div></article>)}</div>
    {filtered.length===0&&active!=='Плейлисты'&&<div className="empty-state"><Film size={30}/><h3>{category==='Мои видео'?(user?'Пока нет загруженных видео':'Войди в аккаунт'):'Пока нет публичных видео'}</h3><p>{category==='Мои видео'?(user?'Загружай ролики — они появятся здесь.':'Создай аккаунт или войди, чтобы пользоваться библиотекой.'):'Стань первым, кто опубликует видео в MIRVEX.'}</p>{!user&&category==='Мои видео'&&<button className="upload-submit" onClick={()=>setAuthOpen(true)}>Войти / Регистрация</button>}</div>}

    </>}
   </main>
  </div>
  {profileOpen&&<ProfileDialog profile={profile} own={String(profile?.user?.id)===String(user?.id)} onClose={()=>setProfileOpen(false)} onSubscribe={subscribe}/ >}{settingsOpen&&<SettingsDialog settings={settings} onChange={setSettings} onClose={()=>setSettingsOpen(false)} user={user} onLogout={()=>{logout();setSettingsOpen(false)}}/>}{uploadOpen&&<UploadDialog token={token} onClose={()=>setUploadOpen(false)} onUploaded={addUploaded}/>}{authOpen&&<AuthDialog onClose={()=>setAuthOpen(false)} onAuth={onAuth}/>}
  {selected&&<div className="modal-backdrop" onClick={()=>setSelected(null)}><div className="video-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setSelected(null)}><X/></button><div className="modal-player">{selected.videoUrl&&<MuxVideoPlayer src={selected.videoUrl} videoId={selected.id} title={selected.title} channel={selected.channel} autoplay={settings.autoplay}/>}</div><div className="modal-details"><h2>{selected.title}</h2><div className="modal-meta"><button className="modal-channel-link" onClick={()=>openProfile(selected.ownerId)}>{selected.channel}</button> · {selected.views}</div><p>{selected.isPublic?'Публичное видео MIRVEX.':'Это видео доступно только тебе, пока ты его не опубликуешь.'}</p><div className="video-library-actions"><button className={'favorite-action '+(favoriteIds.includes(selected.id)?'saved':'')} onClick={()=>toggleFavorite(selected)}><Bookmark size={16}/>{favoriteIds.includes(selected.id)?'В избранном':'В избранное'}</button>{playlists.length>0&&<div className="add-playlist"><select aria-label="Выбрать плейлист" id="mirvex-playlist-select">{playlists.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select><button onClick={()=>{const el=document.getElementById('mirvex-playlist-select');if(el?.value)addToPlaylist(el.value);}}>В плейлист</button></div>}</div>{selected.ownerId&&user&&String(selected.ownerId)===String(user.id)&&<button className="publish-btn" onClick={()=>togglePublish(selected)}>{selected.isPublic?'Скрыть из общей ленты':'Опубликовать для всех'}</button>}<div className="video-reactions"><button className={social.userReaction==='like'?'reaction-active':''} onClick={()=>reactToVideo('like')}><ThumbsUp size={18}/><b>{social.likes||0}</b></button><button className={social.userReaction==='dislike'?'reaction-active':''} onClick={()=>reactToVideo('dislike')}><ThumbsUp className="dislike-icon" size={18}/><b>{social.dislikes||0}</b></button><span>{social.comments?.length||0} комментариев</span></div><div className="comments-area"><h3>Комментарии</h3><div className="comment-compose"><input value={commentText} maxLength={1000} onChange={e=>setCommentText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&postComment()} placeholder={user?'Написать комментарий...':'Войди, чтобы комментировать'}/><button onClick={postComment} disabled={!commentText.trim()}>Отправить</button></div><div className="comment-list">{(social.comments||[]).map(c=><article className="comment-item" key={c.id}><div className="comment-avatar">{c.username?.[0]?.toUpperCase()||'M'}</div><div><b>{c.username}</b><p>{c.body}</p></div></article>)}</div></div></div></div></div>}
  <AmbientEffect type={settings.reduceMotion?"none":settings.effect} density={settings.effectDensity} speed={settings.effectSpeed}/>
  <footer className="mobile-nav">{[['Главная',House],['Shorts',Flame],['Избранное',ThumbsUp],['Плейлисты',Bookmark],['Профиль',UserRound],['Настройки',Settings]].map(([n,I])=><button key={n} className={active===n?'mobile-active':''} onClick={()=>n==='Профиль'?openProfile(user?.id):n==='Настройки'?setSettingsOpen(true):(setActive(n),setCategory('Для вас'),setSelectedPlaylistId(null))}><I size={19}/><span>{n}</span></button>)}</footer>
 </div>
}
createRoot(document.getElementById('root')).render(<App/>);
