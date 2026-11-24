import React, { useEffect, useMemo, useRef, useState } from 'react';
import mux from 'mux-embed';
import { createRoot } from 'react-dom/client';
import { Search, House, Compass, PlaySquare, Clock3, ThumbsUp, Flame, Clapperboard, Menu, Plus, Bell, Mic, MoreHorizontal, Play, X, ChevronDown, Film, Radio, UserRound, Settings, History, Bookmark, ArrowUpRight } from 'lucide-react';
import './styles.css';

const videos = [
  { id:1, title:'Почему современные игры стали такими красивыми?', channel:'Код и пиксели', views:'248 тыс. просмотров', time:'2 дня назад', duration:'18:42', image:'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=900&q=85', avatar:'🎮', category:'Игры' },
  { id:2, title:'Тихое утро в Токио — прогулка без слов', channel:'slowdays', views:'91 тыс. просмотров', time:'5 дней назад', duration:'24:16', image:'https://images.unsplash.com/photo-1540959733332-eab4deabc9e2?w=900&q=85', avatar:'🌆', category:'Путешествия' },
  { id:3, title:'Собрал рабочее место мечты за 30 дней', channel:'Макс делает', views:'512 тыс. просмотров', time:'1 неделю назад', duration:'13:08', image:'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=900&q=85', avatar:'🛠️', category:'Технологии' },
  { id:4, title:'Как звучит город после полуночи', channel:'NO SIGNAL', views:'37 тыс. просмотров', time:'3 дня назад', duration:'09:51', image:'https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=900&q=85', avatar:'🌙', category:'Музыка' },
  { id:5, title:'Готовим идеальную пасту дома', channel:'На вкус', views:'1,2 млн просмотров', time:'2 недели назад', duration:'11:32', image:'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=900&q=85', avatar:'🍝', category:'Еда' },
  { id:6, title:'История одного невероятного путешествия', channel:'За горизонтом', views:'184 тыс. просмотров', time:'6 дней назад', duration:'32:04', image:'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=900&q=85', avatar:'🏔️', category:'Путешествия' },
  { id:7, title:'Новый взгляд на минималистичный дизайн', channel:'form follows', views:'76 тыс. просмотров', time:'1 день назад', duration:'16:27', image:'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=900&q=85', avatar:'◻️', category:'Технологии' },
  { id:8, title:'Лучшие моменты недели — выпуск №08', channel:'Коротко', views:'803 тыс. просмотров', time:'4 дня назад', duration:'08:14', image:'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=900&q=85', avatar:'✨', category:'Развлечения' },
];
const shorts = [
  {id:1,title:'Когда поймал идеальный кадр',views:'1,4 млн',image:'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=600&q=85'},
  {id:2,title:'Маленькие радости большого города',views:'842 тыс.',image:'https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=600&q=85'},
  {id:3,title:'Это выглядит нереально',views:'2,1 млн',image:'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=600&q=85'},
  {id:4,title:'30 секунд спокойствия',views:'326 тыс.',image:'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=85'},
  {id:5,title:'Ночной город с высоты',views:'1 млн',image:'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=600&q=85'},
];
const categories=['Все','Игры','Музыка','Технологии','Путешествия','Еда','Развлечения','Обучение','Спорт'];

function MuxVideoPlayer({ src, videoId, title, channel }) {
 const videoRef = useRef(null);
 useEffect(() => {
  const video = videoRef.current;
  const envKey = import.meta.env.VITE_MUX_ENV_KEY;
  if (!video || !src || !envKey) return;
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
  return () => { video.mux?.destroy?.(); };
 }, [src, videoId, title, channel]);
 return <video ref={videoRef} className="mux-video" src={src} controls playsInline preload="metadata" />;
}

function App(){
 const [active,setActive]=useState('Главная');
 const [category,setCategory]=useState('Все');
 const [query,setQuery]=useState('');
 const [searchOpen,setSearchOpen]=useState(false);
 const [selected,setSelected]=useState(null);
 const [sidebar,setSidebar]=useState(true);
 const [liked,setLiked]=useState([]);
 const filtered=useMemo(()=>videos.filter(v=>(category==='Все'||v.category===category)&& (v.title+' '+v.channel).toLowerCase().includes(query.toLowerCase())),[category,query]);
 const nav=[['Главная',House],['Shorts',Flame],['Подписки',PlaySquare]];
 const library=[['История',History],['Плейлисты',Bookmark],['Понравившиеся',ThumbsUp]];
 return <div className="app">
  <header className="topbar">
   <div className="brand-area"><button className="icon-btn menu-btn" onClick={()=>setSidebar(!sidebar)} aria-label="Меню"><Menu/></button><a className="brand" href="#" onClick={()=>{setActive('Главная');setCategory('Все')}}><span className="brand-mark brand-monogram">M</span><span>MIRVEX<span className="brand-dot">.</span></span></a></div>
   <div className="search-wrap"><div className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск видео и каналов"/>{query&&<button className="clear-search" onClick={()=>setQuery('')}><X size={16}/></button>}</div><button className="icon-btn mic-btn" aria-label="Голосовой поиск"><Mic size={18}/></button></div>
   <div className="top-actions"><button className="create-btn"><Plus size={18}/> <span>Создать</span></button><button className="icon-btn notification-btn" aria-label="Уведомления"><Bell size={19}/></button><button className="profile-avatar">М</button></div>
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
  {selected&&<div className="modal-backdrop" onClick={()=>setSelected(null)}><div className="video-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setSelected(null)}><X/></button><div className="modal-player">{selected.videoUrl ? <MuxVideoPlayer src={selected.videoUrl} videoId={selected.id} title={selected.title} channel={selected.channel}/> : <><img src={selected.image}/><div className="player-overlay"><Play fill="white" size={42}/></div><span className="demo-label">ПРЕВЬЮ · ДЕМО</span></>}</div><div className="modal-details"><h2>{selected.title}</h2><div className="modal-meta">{selected.channel} · {selected.views}</div><p>Это демонстрационный просмотр интерфейса. Подключение настоящего видеоплеера, загрузки и хранения видео добавим следующим этапом.</p><button className={'like-btn '+(liked.includes(selected.id)?'is-liked':'')} onClick={()=>setLiked(x=>x.includes(selected.id)?x.filter(i=>i!==selected.id):[...x,selected.id])}><ThumbsUp size={17}/> {liked.includes(selected.id)?'Нравится':'Нравится'}</button></div></div></div>}
  <footer className="mobile-nav">{[['Главная',House],['Shorts',Flame],['Подписки',PlaySquare],['Вы',UserRound]].map(([n,I])=><button key={n} className={active===n?'mobile-active':''} onClick={()=>setActive(n)}><I size={21}/><span>{n}</span></button>)}</footer>
 </div>
}
createRoot(document.getElementById('root')).render(<App/>);
