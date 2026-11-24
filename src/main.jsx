import React, { useEffect, useMemo, useRef, useState } from 'react';
import mux from 'mux-embed';
import Hls from 'hls.js';
import { createRoot } from 'react-dom/client';
import { Search, House, Compass, PlaySquare, Clock3, ThumbsUp, Flame, Clapperboard, Menu, Plus, Bell, Mic, MoreHorizontal, Play, X, ChevronDown, Film, Radio, UserRound, Settings, History, Bookmark, ArrowUpRight } from 'lucide-react';
import './styles.css';

const videos = [];
const shorts = [];
const categories=['Все','Мои видео'];

function MuxVideoPlayer({ src, videoId, title, channel }) {
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
 return <video ref={videoRef} className="mux-video" src={src} controls playsInline preload="metadata" />;
}

function UploadDialog({ onClose, onUploaded }) {
 const [file,setFile]=useState(null);
 const [title,setTitle]=useState('');
 const [status,setStatus]=useState('idle');
 const [progress,setProgress]=useState(0);
 const [message,setMessage]=useState('');
 const chooseRef=useRef(null);
 async function upload() {
  if (!file) return;
  setStatus('uploading'); setProgress(0); setMessage('Создаём защищённую ссылку...');
  try {
   const created=await fetch('https://mirvex-api.onrender.com/api/uploads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:title||file.name})});
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
    const check=await fetch('https://mirvex-api.onrender.com/api/uploads/'+encodeURIComponent(data.uploadId));
    const result=await check.json();
    if(!check.ok) throw new Error(result.error||'Не удалось проверить обработку');
    if(result.status==='ready'&&result.playbackId){ready=result;break;}
    if(result.status==='errored') throw new Error('Mux не смог обработать это видео');
   }
   if(!ready) throw new Error('Обработка занимает больше обычного. Попробуйте проверить позже.');
   const item={id:'mux-'+ready.assetId,title:title||file.name,channel:'Мой канал',views:'Новое видео',time:'Только что',duration:'',image:'https://images.unsplash.com/photo-1492619375914-88005aa9e8fb?w=900&q=85',avatar:'М',category:'Мои видео',videoUrl:'https://stream.mux.com/'+ready.playbackId+'.m3u8'};
   onUploaded(item);
   setStatus('done'); setMessage('Видео опубликовано и готово к просмотру!');
  } catch(e){setStatus('error');setMessage(e.message||'Не удалось загрузить видео');}
 }
 return <div className="upload-backdrop" onClick={onClose}><div className="upload-dialog" onClick={e=>e.stopPropagation()}>
  <button className="modal-close" onClick={onClose}><X/></button><div className="eyebrow">MIRVEX STUDIO</div><h2>Загрузить видео</h2><p className="upload-hint">Выбери видео с устройства. Файл отправится напрямую в Mux.</p>
  <label className="upload-field">Название видео<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Например, мой первый ролик"/></label>
  <input ref={chooseRef} type="file" accept="video/*" hidden onChange={e=>setFile(e.target.files?.[0]||null)}/>
  <button className="file-picker" onClick={()=>chooseRef.current?.click()} disabled={status==='uploading'}><Film size={20}/><span>{file?file.name:'Выбрать видеофайл'}</span><small>{file?(file.size/1024/1024).toFixed(1)+' МБ':'MP4, MOV и другие форматы'}</small></button>
  {status==='uploading'&&<div className="upload-progress"><div><span>{message}</span><b>{progress}%</b></div><i><span style={{width:progress+'%'}}/></i></div>}
  {message&&status!=='uploading'&&<p className={'upload-message '+status}>{message}</p>}
  <div className="upload-actions"><button className="upload-cancel" onClick={onClose}>Закрыть</button><button className="upload-submit" disabled={!file||status==='uploading'||status==='done'} onClick={upload}>{status==='uploading'?'Загрузка...':status==='done'?'Готово':'Опубликовать'}</button></div>
 </div></div>;
}

function App(){
 const [active,setActive]=useState('Главная');
 const [uploadOpen,setUploadOpen]=useState(false);
 const [uploaded,setUploaded]=useState(()=>{try{return JSON.parse(localStorage.getItem('mirvex_uploads')||'[]')}catch{return []}});
 const addUploaded=item=>{setUploaded(list=>{const next=[item,...list];try{localStorage.setItem('mirvex_uploads',JSON.stringify(next));}catch{}return next;});setSelected(item);setUploadOpen(false);};
 const [category,setCategory]=useState('Все');
 const [query,setQuery]=useState('');
 const [searchOpen,setSearchOpen]=useState(false);
 const [selected,setSelected]=useState(null);
 const [sidebar,setSidebar]=useState(true);
 const [liked,setLiked]=useState([]);
 const allVideos=[...uploaded,...videos];
 const filtered=useMemo(()=>allVideos.filter(v=>(category==='Все'||v.category===category)&& (v.title+' '+v.channel).toLowerCase().includes(query.toLowerCase())),[category,query,uploaded]);
 const nav=[['Главная',House],['Shorts',Flame],['Подписки',PlaySquare]];
 const library=[['История',History],['Плейлисты',Bookmark],['Понравившиеся',ThumbsUp]];
 return <div className="app">
  <header className="topbar">
   <div className="brand-area"><button className="icon-btn menu-btn" onClick={()=>setSidebar(!sidebar)} aria-label="Меню"><Menu/></button><a className="brand" href="#" onClick={()=>{setActive('Главная');setCategory('Все')}}><span className="brand-mark brand-monogram">M</span><span>MIRVEX<span className="brand-dot">.</span></span></a></div>
   <div className="search-wrap"><div className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск видео и каналов"/>{query&&<button className="clear-search" onClick={()=>setQuery('')}><X size={16}/></button>}</div><button className="icon-btn mic-btn" aria-label="Голосовой поиск"><Mic size={18}/></button></div>
   <div className="top-actions"><button className="create-btn" onClick={()=>setUploadOpen(true)}><Plus size={18}/> <span>Создать</span></button><button className="icon-btn notification-btn" aria-label="Уведомления"><Bell size={19}/></button><button className="profile-avatar">М</button></div>
  </header>
  <div className="layout">
   {sidebar&&<aside className="sidebar">
    <nav>{nav.map(([label,Icon])=><button key={label} className={'nav-item '+(active===label?'active':'')} onClick={()=>{setActive(label);setCategory('Все')}}><Icon size={20}/><span>{label}</span></button>)}</nav>
    <div className="side-divider"/>
    <div className="side-heading">Вы</div>
    {library.map(([label,Icon])=><button key={label} className="nav-item" onClick={()=>setActive(label)}><Icon size={19}/><span>{label}</span></button>)}
    <div className="side-divider"/>
    <div className="side-heading">Ваши подписки</div>
    {['Дизайн без шума','Космос рядом','Точка сборки'].map((n,i)=><button className="subscription" key={n}><span className="sub-avatar">{['◉','✦','△'][i]}</span>{n}<i/></button>)}
    <div className="sidebar-bottom"><Settings size={16}/> Настройки</div>
   </aside>}
   <main className="main">
    {active==='Shorts'?<><div className="page-heading"><div><div className="eyebrow">БЫСТРО И ПО ДЕЛУ</div><h1>Shorts</h1><p>Вертикальные видео, которые затягивают.</p></div></div><div className="shorts-grid">{shorts.map(s=><button className="short-card" key={s.id} onClick={()=>setSelected({title:s.title,channel:'MIRVEX Shorts',views:s.views+' просмотров',time:'Сейчас',duration:'0:32',image:s.image,avatar:'✦'})}><img src={s.image}/><span className="short-play"><Play fill="white"/></span><strong>{s.title}</strong><small>{s.views} просмотров</small></button>)}</div></>:<>
    <section className="welcome"><div><div className="eyebrow">ТВОЯ ВИДЕОПЛАТФОРМА</div><h1>{active==='Главная'?'Смотри. Открывай.':active}</h1><p>Хорошие видео находят тебя сами.</p></div><div className="welcome-art"><div className="art-orb orb-one"/><div className="art-orb orb-two"/><div className="art-play"><Play fill="white" size={25}/></div><span className="art-caption">YOUR NEXT<br/>FAVORITE VIDEO</span></div></section>
    <div className="category-row">{categories.map(c=><button key={c} onClick={()=>setCategory(c)} className={'category '+(category===c?'selected':'')}>{c}</button>)}</div>
    <div className="section-title"><div><h2>Рекомендации</h2><span>Подобрали для тебя</span></div><button className="sort-btn">Для вас <ChevronDown size={16}/></button></div>
    <div className="video-grid">{filtered.map(v=><article className="video-card" key={v.id}><button className="thumb" onClick={()=>setSelected(v)}><img src={v.image} alt=""/><span className="duration">{v.duration}</span><span className="thumb-hover"><Play fill="white"/></span></button><div className="video-info"><div className="channel-avatar">{v.avatar}</div><div className="video-copy"><button className="video-title" onClick={()=>setSelected(v)}>{v.title}</button><div className="channel-name">{v.channel}</div><div className="video-meta">{v.views} · {v.time}</div></div><button className="more-btn" aria-label="Ещё"><MoreHorizontal size={19}/></button></div></article>)}</div>
    {filtered.length===0&&<div className="empty-state"><Search size={30}/><h3>Ничего не нашлось</h3><p>Попробуй изменить запрос или выбрать другую категорию.</p></div>}
    <section className="shorts-shelf"><div className="section-title"><div className="shorts-label"><Flame size={21}/><h2>Shorts</h2><span>· Вертикальные видео</span></div><button className="text-link" onClick={()=>setActive('Shorts')}>Смотреть все <ArrowUpRight size={16}/></button></div><div className="shorts-strip">{shorts.slice(0,4).map(s=><button className="mini-short" key={s.id} onClick={()=>setSelected({title:s.title,channel:'MIRVEX Shorts',views:s.views+' просмотров',time:'Сейчас',duration:'0:32',image:s.image,avatar:'✦'})}><img src={s.image}/><strong>{s.title}</strong><small>{s.views} просмотров</small></button>)}</div></section>
    </>}
   </main>
  </div>
  {uploadOpen&&<UploadDialog onClose={()=>setUploadOpen(false)} onUploaded={addUploaded}/>}
  {selected&&<div className="modal-backdrop" onClick={()=>setSelected(null)}><div className="video-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setSelected(null)}><X/></button><div className="modal-player">{selected.videoUrl ? <MuxVideoPlayer src={selected.videoUrl} videoId={selected.id} title={selected.title} channel={selected.channel}/> : <><img src={selected.image}/><div className="player-overlay"><Play fill="white" size={42}/></div><span className="demo-label">ПРЕВЬЮ · ДЕМО</span></>}</div><div className="modal-details"><h2>{selected.title}</h2><div className="modal-meta">{selected.channel} · {selected.views}</div><p>{selected.videoUrl?'Видео загружено в MIRVEX через Mux.':'Это демонстрационное видео. Загружай собственные ролики через кнопку «Создать».'}</p><button className={'like-btn '+(liked.includes(selected.id)?'is-liked':'')} onClick={()=>setLiked(x=>x.includes(selected.id)?x.filter(i=>i!==selected.id):[...x,selected.id])}><ThumbsUp size={17}/> {liked.includes(selected.id)?'Нравится':'Нравится'}</button></div></div></div>}
  <footer className="mobile-nav">{[['Главная',House],['Shorts',Flame],['Подписки',PlaySquare],['Вы',UserRound]].map(([n,I])=><button key={n} className={active===n?'mobile-active':''} onClick={()=>setActive(n)}><I size={21}/><span>{n}</span></button>)}</footer>
 </div>
}
createRoot(document.getElementById('root')).render(<App/>);
