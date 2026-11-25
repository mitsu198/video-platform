import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 10000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://frame-video-platform.onrender.com';
const JWT_SECRET = process.env.JWT_SECRET;
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : undefined
}) : null;
const uploadImage = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req,file,cb) => {
  if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) cb(null,true);
  else cb(new Error('Обложка должна быть JPG, PNG или WebP'));
}});

app.use(cors({ origin(origin, callback) {
  if (!origin || origin === FRONTEND_ORIGIN) return callback(null, true);
  return callback(new Error('Origin not allowed'));
}, methods: ['GET','POST','PUT','DELETE'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '32kb' }));

async function initDb() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS videos (
      id BIGSERIAL PRIMARY KEY,
      owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      upload_id TEXT UNIQUE NOT NULL,
      asset_id TEXT,
      playback_id TEXT,
      title TEXT NOT NULL,
      cover BYTEA,
      cover_type TEXT,
      status TEXT NOT NULL DEFAULT 'processing',
      duration REAL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_short BOOLEAN NOT NULL DEFAULT FALSE;
    CREATE INDEX IF NOT EXISTS videos_shorts_idx ON videos(is_short,is_public,status,created_at DESC);
    CREATE TABLE IF NOT EXISTS video_reactions (video_id BIGINT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,reaction TEXT NOT NULL CHECK(reaction IN ('like','dislike')),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(video_id,user_id));
    CREATE TABLE IF NOT EXISTS video_comments (id BIGSERIAL PRIMARY KEY,video_id BIGINT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL CHECK(char_length(body) BETWEEN 1 AND 1000),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE INDEX IF NOT EXISTS video_comments_video_created_idx ON video_comments(video_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS user_subscriptions (follower_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,followed_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(follower_id,followed_id),CHECK(follower_id<>followed_id));
    CREATE INDEX IF NOT EXISTS videos_owner_created_idx ON videos(owner_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS videos_public_created_idx ON videos(is_public, status, created_at DESC);
    CREATE TABLE IF NOT EXISTS video_favorites (user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,video_id BIGINT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,video_id));
    CREATE TABLE IF NOT EXISTS playlists (id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,title TEXT NOT NULL CHECK(char_length(title) BETWEEN 1 AND 60),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS playlist_videos (playlist_id BIGINT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,video_id BIGINT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(playlist_id,video_id));
    CREATE TABLE IF NOT EXISTS video_reports (
      id BIGSERIAL PRIMARY KEY,
      video_id BIGINT REFERENCES videos(id) ON DELETE SET NULL,
      video_title TEXT NOT NULL,
      video_url TEXT NOT NULL,
      reporter_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      reporter_name TEXT NOT NULL,
      reason TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewed','rejected')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS video_reports_status_created_idx ON video_reports(status,created_at DESC);
    CREATE INDEX IF NOT EXISTS playlist_videos_added_idx ON playlist_videos(playlist_id,added_at DESC);
    CREATE TABLE IF NOT EXISTS video_views (id BIGSERIAL PRIMARY KEY,video_id BIGINT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,viewer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE INDEX IF NOT EXISTS video_views_video_created_idx ON video_views(video_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS video_views_owner_viewer_idx ON video_views(viewer_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS notifications (id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,actor_name TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('subscriber','like','comment')),video_id BIGINT REFERENCES videos(id) ON DELETE CASCADE,video_title TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),read_at TIMESTAMPTZ);
    CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_id,created_at DESC);
  `);
}

function muxAuth() {
  const id = process.env.MUX_TOKEN_ID, secret = process.env.MUX_TOKEN_SECRET;
  if (!id || !secret) throw new Error('Mux API credentials are not configured');
  return 'Basic ' + Buffer.from(id + ':' + secret).toString('base64');
}
function requireDb(_req,res,next) {
  if (!pool) return res.status(503).json({ error: 'База данных ещё не подключена. Добавьте DATABASE_URL в MIRVEX API.' });
  next();
}
function auth(req,res,next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i,'');
    if (!token || !JWT_SECRET) return res.status(401).json({ error: 'Войдите в аккаунт' });
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Сессия истекла. Войдите снова.' }); }
}
app.get('/health', (_req,res) => res.json({ ok:true, service:'mirvex-api', database:!!pool }));

app.post('/api/auth/register', requireDb, async (req,res) => {
  try {
    const email=String(req.body?.email||'').trim().toLowerCase();
    const username=String(req.body?.username||'').trim().slice(0,32);
    const password=String(req.body?.password||'');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({error:'Укажи корректную почту'});
    if (username.length<2) return res.status(400).json({error:'Имя должно содержать минимум 2 символа'});
    if (password.length<8) return res.status(400).json({error:'Пароль должен быть не короче 8 символов'});
    const hash=await bcrypt.hash(password,12);
    const result=await pool.query('INSERT INTO users(email,username,password_hash) VALUES($1,$2,$3) RETURNING id,email,username',[email,username,hash]);
    const user=result.rows[0], token=jwt.sign({id:user.id,email:user.email,username:user.username},JWT_SECRET,{expiresIn:'90d'});
    res.status(201).json({token,user});
  } catch(e) {
    if(e.code==='23505') return res.status(409).json({error:'Аккаунт с такой почтой уже существует'});
    res.status(500).json({error:'Не удалось создать аккаунт'});
  }
});
app.post('/api/auth/login', requireDb, async (req,res) => {
  try {
    const email=String(req.body?.email||'').trim().toLowerCase(), password=String(req.body?.password||'');
    const result=await pool.query('SELECT id,email,username,password_hash FROM users WHERE email=$1',[email]);
    const user=result.rows[0];
    if(!user || !(await bcrypt.compare(password,user.password_hash))) return res.status(401).json({error:'Неверная почта или пароль'});
    const token=jwt.sign({id:user.id,email:user.email,username:user.username},JWT_SECRET,{expiresIn:'90d'});
    res.json({token,user:{id:user.id,email:user.email,username:user.username,isAdmin:isAdminEmail(user.email)}});
  } catch { res.status(500).json({error:'Не удалось войти'}); }
});
app.get('/api/auth/me', requireDb, auth, async (req,res) => {
  const r=await pool.query('SELECT id,email,username FROM users WHERE id=$1',[req.user.id]);
  if(!r.rowCount) return res.status(401).json({error:'Аккаунт не найден'});
  res.json({user:{...r.rows[0],isAdmin:isAdminEmail(r.rows[0].email)}});
});

app.post('/api/uploads', requireDb, auth, async (req,res) => {
  try {
    const title=String(req.body?.title||'Новое видео').trim().slice(0,120);
    const isShort=req.body?.isShort===true;
    const response=await fetch('https://api.mux.com/video/v1/uploads',{method:'POST',headers:{Authorization:muxAuth(),'Content-Type':'application/json'},body:JSON.stringify({
      cors_origin:FRONTEND_ORIGIN,
      new_asset_settings:{playback_policies:['public'],video_quality:'basic',meta:{title}}
    })});
    const payload=await response.json();
    if(!response.ok) return res.status(response.status).json({error:payload?.error?.messages?.join(', ')||payload?.message||'Mux upload creation failed'});
    await pool.query('INSERT INTO videos(owner_id,upload_id,title,status,is_short) VALUES($1,$2,$3,$4,$5)',[req.user.id,payload.data.id,title,'processing',isShort]);
    res.json({uploadId:payload.data.id,uploadUrl:payload.data.url,status:payload.data.status});
  } catch(e) { res.status(500).json({error:e.message||'Не удалось создать загрузку'}); }
});
app.get('/api/uploads/:id', requireDb, auth, async (req,res) => {
  try {
    const owned=await pool.query('SELECT id,is_short FROM videos WHERE upload_id=$1 AND owner_id=$2',[req.params.id,req.user.id]);
    if(!owned.rowCount) return res.status(404).json({error:'Загрузка не найдена'});
    const response=await fetch('https://api.mux.com/video/v1/uploads/'+encodeURIComponent(req.params.id),{headers:{Authorization:muxAuth()}});
    const payload=await response.json();
    if(!response.ok) return res.status(response.status).json({error:payload?.error?.messages?.join(', ')||'Не удалось получить статус загрузки'});
    const upload=payload.data;
    if(upload.status!=='asset_created'||!upload.asset_id) return res.json({status:upload.status,error:upload.error?.message||null});
    const ar=await fetch('https://api.mux.com/video/v1/assets/'+encodeURIComponent(upload.asset_id),{headers:{Authorization:muxAuth()}});
    const ap=await ar.json();
    if(!ar.ok) return res.status(ar.status).json({error:'Не удалось получить видеофайл'});
    const asset=ap.data, playbackId=asset.playback_ids?.[0]?.id||null;
    await pool.query('UPDATE videos SET asset_id=$1,playback_id=$2,status=$3,is_public=TRUE,duration=$4::real,is_short=($5::boolean AND COALESCE($4::real,999999::real)<=180) WHERE upload_id=$6 AND owner_id=$7',[asset.id,playbackId,asset.status,asset.duration||null,owned.rows[0].is_short,req.params.id,req.user.id]);
    res.json({status:asset.status,assetId:asset.id,playbackId,duration:asset.duration||null,isShort:!!owned.rows[0].is_short&&Number(asset.duration||999999)<=180,videoId:owned.rows[0].id});
  } catch(e) { res.status(500).json({error:e.message||'Не удалось проверить загрузку'}); }
});
app.post('/api/videos/:id/cover', requireDb, auth, uploadImage.single('cover'), async (req,res) => {
  if(!req.file) return res.status(400).json({error:'Выбери изображение обложки'});
  const r=await pool.query('UPDATE videos SET cover=$1,cover_type=$2 WHERE id=$3 AND owner_id=$4 RETURNING id',[req.file.buffer,req.file.mimetype,req.params.id,req.user.id]);
  if(!r.rowCount) return res.status(404).json({error:'Видео не найдено'});
  res.json({ok:true,coverUrl:'/api/videos/'+req.params.id+'/cover'});
});
app.get('/api/videos/:id/cover', requireDb, async (req,res) => {
  const r=await pool.query('SELECT cover,cover_type FROM videos WHERE id=$1',[req.params.id]);
  if(!r.rowCount||!r.rows[0].cover) return res.status(404).end();
  res.set('Content-Type',r.rows[0].cover_type||'image/jpeg').set('Cache-Control','public, max-age=3600').send(r.rows[0].cover);
});

app.get('/api/search', requireDb, async (req,res) => {
  const q=String(req.query.q||'').trim().slice(0,80);
  if(q.length<2) return res.json({videos:[],users:[]});
  const pattern='%'+q+'%';
  const [videos,users]=await Promise.all([
    pool.query(`SELECT v.id,v.owner_id,v.title,v.playback_id,v.duration,v.created_at,v.cover,u.username
      FROM videos v JOIN users u ON u.id=v.owner_id
      WHERE v.is_public=TRUE AND v.status='ready' AND v.playback_id IS NOT NULL
        AND (v.title ILIKE $1 OR u.username ILIKE $1)
      ORDER BY CASE WHEN v.title ILIKE $2 THEN 0 ELSE 1 END,v.created_at DESC LIMIT 12`,[pattern,q+'%']),
    pool.query(`SELECT id,username FROM users WHERE username ILIKE $1
      ORDER BY CASE WHEN username ILIKE $2 THEN 0 ELSE 1 END,username LIMIT 8`,[pattern,q+'%'])
  ]);
  res.json({
    videos:videos.rows.map(v=>({
      id:'db-'+v.id,ownerId:String(v.owner_id),title:v.title,channel:v.username,
      views:'Публичное видео',time:new Date(v.created_at).toLocaleDateString('ru-RU'),
      duration:v.duration?new Date(v.duration*1000).toISOString().slice(14,19):'',
      image:v.cover?'https://mirvex-api.onrender.com/api/videos/'+v.id+'/cover':'https://image.mux.com/'+v.playback_id+'/thumbnail.jpg?width=900',
      avatar:(v.username||'M').slice(0,1).toUpperCase(),category:'Для вас',
      videoUrl:'https://stream.mux.com/'+v.playback_id+'.m3u8',isPublic:true
    })),
    users:users.rows.map(u=>({id:String(u.id),username:u.username}))
  });
});
app.get('/api/public/videos', requireDb, async (_req,res) => {
  const r=await pool.query(`SELECT v.id,v.owner_id,v.title,v.playback_id,v.duration,v.created_at,v.cover,
    u.username
    FROM videos v JOIN users u ON u.id=v.owner_id
    WHERE v.is_public=TRUE AND v.status='ready' AND v.playback_id IS NOT NULL
    ORDER BY v.created_at DESC LIMIT 100`);
  res.json({videos:r.rows.map(v=>({
    id:'db-'+v.id, ownerId:String(v.owner_id), title:v.title, channel:v.username,
    views:'Публичное видео', time:new Date(v.created_at).toLocaleDateString('ru-RU'),
    duration:v.duration?new Date(v.duration*1000).toISOString().slice(14,19):'',
    image:v.cover?'https://mirvex-api.onrender.com/api/videos/'+v.id+'/cover':'https://image.mux.com/'+v.playback_id+'/thumbnail.jpg?width=900',
    avatar:(v.username||'M').slice(0,1).toUpperCase(), category:'Для вас',
    videoUrl:'https://stream.mux.com/'+v.playback_id+'.m3u8', isPublic:true
  }))});
});
app.put('/api/videos/:id/title',requireDb,auth,async(req,res)=>{
 const id=numericVideoId(req.params.id),title=String(req.body?.title||'').trim();
 if(!id)return res.status(400).json({error:'Некорректное видео'});
 if(!title||title.length>120)return res.status(400).json({error:'Название должно содержать от 1 до 120 символов'});
 const r=await pool.query('UPDATE videos SET title=$1 WHERE id=$2 AND owner_id=$3 AND status=\'ready\' RETURNING id,title,is_public',[title,id,req.user.id]);
 if(!r.rowCount)return res.status(404).json({error:'Видео не найдено'});
 res.json({ok:true,video:{id:'db-'+r.rows[0].id,title:r.rows[0].title,isPublic:r.rows[0].is_public}});
});
app.delete('/api/videos/:id',requireDb,auth,async(req,res)=>{
 const id=numericVideoId(req.params.id);
 if(!id)return res.status(400).json({error:'Некорректное видео'});
 const r=await pool.query('SELECT id,asset_id FROM videos WHERE id=$1 AND owner_id=$2',[id,req.user.id]);
 if(!r.rowCount)return res.status(404).json({error:'Видео не найдено'});
 if(r.rows[0].asset_id){try{const muxResponse=await fetch('https://api.mux.com/video/v1/assets/'+encodeURIComponent(r.rows[0].asset_id),{method:'DELETE',headers:{Authorization:muxAuth()}});if(!muxResponse.ok)console.error('Mux asset deletion failed:',muxResponse.status);}catch(e){console.error('Mux asset deletion failed:',e.message);}}
 await pool.query('DELETE FROM videos WHERE id=$1 AND owner_id=$2',[id,req.user.id]);
 res.json({ok:true});
});

app.post('/api/videos/:id/publish', requireDb, auth, async (req,res) => {
  const isPublic=req.body?.isPublic;
  if(typeof isPublic!=='boolean') return res.status(400).json({error:'Укажи статус публикации'});
  const r=await pool.query('UPDATE videos SET is_public=$1 WHERE id=$2 AND owner_id=$3 AND status=\'ready\' RETURNING id,is_public',[isPublic,req.params.id,req.user.id]);
  if(!r.rowCount) return res.status(404).json({error:'Видео не найдено'});
  res.json({ok:true,isPublic:r.rows[0].is_public});
});

app.get('/api/videos', requireDb, auth, async (req,res) => {
  const r=await pool.query(`SELECT id,owner_id,title,upload_id,asset_id,playback_id,status,duration,created_at,is_public,
    CASE WHEN cover IS NOT NULL THEN '/api/videos/'||id||'/cover' ELSE NULL END AS cover_url
    FROM videos WHERE owner_id=$1 AND playback_id IS NOT NULL AND status='ready' ORDER BY created_at DESC`,[req.user.id]);
  res.json({videos:r.rows.map(v=>({...v,id:'db-'+v.id,ownerId:String(v.owner_id),isPublic:v.is_public,videoUrl:v.playback_id?'https://stream.mux.com/'+v.playback_id+'.m3u8':null,image:v.cover_url?'https://mirvex-api.onrender.com'+v.cover_url:'https://image.mux.com/'+v.playback_id+'/thumbnail.jpg?width=900',channel:'Мой канал',views:'Ваше видео',time:new Date(v.created_at).toLocaleDateString('ru-RU'),category:'Мои видео',avatar:'М'}))});
});


function isAdminEmail(email){const allowed=(process.env.ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);return allowed.includes(String(email||'').toLowerCase());}
function adminOnly(req,res,next){if(!isAdminEmail(req.user?.email))return res.status(403).json({error:'Доступ только для администратора'});next();}

function numericVideoId(value){const id=String(value||'').replace(/^db-/,'');return /^\d+$/.test(id)?id:null;}
app.get('/api/videos/:id/social',requireDb,async(req,res)=>{const id=numericVideoId(req.params.id);if(!id)return res.status(400).json({error:'Некорректное видео'});const v=await pool.query("SELECT id,owner_id,is_public,status FROM videos WHERE id=$1",[id]);if(!v.rowCount||v.rows[0].status!=='ready')return res.status(404).json({error:'Видео не найдено'});let viewerId=null;try{const t=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');if(t)viewerId=jwt.verify(t,JWT_SECRET).id;}catch{}if(!v.rows[0].is_public&&String(v.rows[0].owner_id)!==String(viewerId))return res.status(404).json({error:'Видео недоступно'});const [counts,comments]=await Promise.all([pool.query('SELECT reaction,COUNT(*)::int AS count FROM video_reactions WHERE video_id=$1 GROUP BY reaction',[id]),pool.query('SELECT c.id,c.body,c.created_at,u.id AS user_id,u.username FROM video_comments c JOIN users u ON u.id=c.user_id WHERE c.video_id=$1 ORDER BY c.created_at DESC LIMIT 50',[id])]);let userReaction=null;if(viewerId){const rr=await pool.query('SELECT reaction FROM video_reactions WHERE video_id=$1 AND user_id=$2',[id,viewerId]);userReaction=rr.rows[0]?.reaction||null;}const stats={likes:0,dislikes:0};counts.rows.forEach(x=>stats[x.reaction==='like'?'likes':'dislikes']=x.count);res.json({...stats,userReaction,comments:comments.rows.map(c=>({id:c.id,body:c.body,username:c.username,userId:String(c.user_id),createdAt:c.created_at}))});});
app.post('/api/videos/:id/reaction',requireDb,auth,async(req,res)=>{const id=numericVideoId(req.params.id),reaction=req.body?.reaction;if(!id||![null,'like','dislike'].includes(reaction))return res.status(400).json({error:'Некорректная реакция'});const v=await pool.query("SELECT id FROM videos WHERE id=$1 AND status='ready' AND (is_public=TRUE OR owner_id=$2)",[id,req.user.id]);if(!v.rowCount)return res.status(404).json({error:'Видео не найдено'});const prior=await pool.query('SELECT reaction FROM video_reactions WHERE video_id=$1 AND user_id=$2',[id,req.user.id]);if(reaction===null)await pool.query('DELETE FROM video_reactions WHERE video_id=$1 AND user_id=$2',[id,req.user.id]);else await pool.query('INSERT INTO video_reactions(video_id,user_id,reaction) VALUES($1,$2,$3) ON CONFLICT(video_id,user_id) DO UPDATE SET reaction=EXCLUDED.reaction,created_at=NOW()',[id,req.user.id,reaction]);if(reaction==='like'&&prior.rows[0]?.reaction!=='like'){const owner=await pool.query('SELECT owner_id,title FROM videos WHERE id=$1',[id]);if(owner.rowCount&&String(owner.rows[0].owner_id)!==String(req.user.id))await pool.query("INSERT INTO notifications(user_id,actor_id,actor_name,kind,video_id,video_title) VALUES($1,$2,$3,'like',$4,$5)",[owner.rows[0].owner_id,req.user.id,req.user.username,id,owner.rows[0].title]);}const r=await pool.query('SELECT reaction,COUNT(*)::int AS count FROM video_reactions WHERE video_id=$1 GROUP BY reaction',[id]);const stats={likes:0,dislikes:0};r.rows.forEach(x=>stats[x.reaction==='like'?'likes':'dislikes']=x.count);res.json({...stats,userReaction:reaction});});
app.post('/api/videos/:id/comments',requireDb,auth,async(req,res)=>{const id=numericVideoId(req.params.id),body=String(req.body?.body||'').trim();if(!id||!body||body.length>1000)return res.status(400).json({error:'Комментарий должен содержать от 1 до 1000 символов'});const v=await pool.query("SELECT id FROM videos WHERE id=$1 AND status='ready' AND (is_public=TRUE OR owner_id=$2)",[id,req.user.id]);if(!v.rowCount)return res.status(404).json({error:'Видео не найдено'});const r=await pool.query('INSERT INTO video_comments(video_id,user_id,body) VALUES($1,$2,$3) RETURNING id,body,created_at',[id,req.user.id,body]);const owner=await pool.query('SELECT owner_id,title FROM videos WHERE id=$1',[id]);if(owner.rowCount&&String(owner.rows[0].owner_id)!==String(req.user.id))await pool.query("INSERT INTO notifications(user_id,actor_id,actor_name,kind,video_id,video_title) VALUES($1,$2,$3,'comment',$4,$5)",[owner.rows[0].owner_id,req.user.id,req.user.username,id,owner.rows[0].title]);res.status(201).json({comment:{...r.rows[0],username:req.user.username,userId:String(req.user.id)}});});
app.get('/api/users/:id/profile',requireDb,async(req,res)=>{
 const id=String(req.params.id);
 if(!/^\d+$/.test(id))return res.status(400).json({error:'Некорректный профиль'});
 const u=await pool.query('SELECT id,username,created_at FROM users WHERE id=$1',[id]);
 if(!u.rowCount)return res.status(404).json({error:'Профиль не найден'});
 let viewerId=null;
 try{const t=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');if(t)viewerId=String(jwt.verify(t,JWT_SECRET).id);}catch{}
 const [stats,vids]=await Promise.all([
  pool.query("SELECT (SELECT COUNT(*) FROM user_subscriptions WHERE followed_id=$1)::int AS followers,(SELECT COUNT(*) FROM user_subscriptions WHERE follower_id=$1)::int AS following,(SELECT COUNT(*) FROM video_reactions r JOIN videos v ON v.id=r.video_id WHERE v.owner_id=$1 AND r.reaction='like')::int AS likes,(SELECT COUNT(*) FROM videos WHERE owner_id=$1 AND is_public=TRUE AND status='ready')::int AS videos",[id]),
  pool.query("SELECT id,title,playback_id,duration,created_at,cover,is_public FROM videos WHERE owner_id=$1 AND status='ready' AND (is_public=TRUE OR $2::text=$1::text) ORDER BY created_at DESC LIMIT 30",[id,viewerId])
 ]);
 let isFollowing=false;
 if(viewerId&&viewerId!==id){const q=await pool.query('SELECT 1 FROM user_subscriptions WHERE follower_id=$1 AND followed_id=$2',[viewerId,id]);isFollowing=!!q.rowCount;}
 res.json({user:{id:String(u.rows[0].id),username:u.rows[0].username,createdAt:u.rows[0].created_at},...stats.rows[0],isFollowing,videos:vids.rows.map(v=>({id:'db-'+v.id,title:v.title,ownerId:id,channel:u.rows[0].username,isPublic:v.is_public,image:v.cover?'https://mirvex-api.onrender.com/api/videos/'+v.id+'/cover':'https://image.mux.com/'+v.playback_id+'/thumbnail.jpg?width=900',avatar:u.rows[0].username.slice(0,1).toUpperCase(),videoUrl:'https://stream.mux.com/'+v.playback_id+'.m3u8'}))});
});
app.post('/api/users/:id/subscribe',requireDb,auth,async(req,res)=>{const id=String(req.params.id);if(!/^\d+$/.test(id)||String(req.user.id)===id)return res.status(400).json({error:'Нельзя подписаться на этот профиль'});const exists=await pool.query('SELECT id FROM users WHERE id=$1',[id]);if(!exists.rowCount)return res.status(404).json({error:'Профиль не найден'});const subscribed=req.body?.subscribed===true;if(subscribed){const inserted=await pool.query('INSERT INTO user_subscriptions(follower_id,followed_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING follower_id',[req.user.id,id]);if(inserted.rowCount)await pool.query("INSERT INTO notifications(user_id,actor_id,actor_name,kind) VALUES($1,$2,$3,'subscriber')",[id,req.user.id,req.user.username]);}else await pool.query('DELETE FROM user_subscriptions WHERE follower_id=$1 AND followed_id=$2',[req.user.id,id]);const count=await pool.query('SELECT COUNT(*)::int AS followers FROM user_subscriptions WHERE followed_id=$1',[id]);res.json({isFollowing:subscribed,followers:count.rows[0].followers});});

app.get('/api/library/favorites',requireDb,auth,async(req,res)=>{
 const r=await pool.query("SELECT v.id,v.owner_id,v.title,v.playback_id,v.duration,v.created_at,v.cover,v.is_public,u.username FROM video_favorites f JOIN videos v ON v.id=f.video_id JOIN users u ON u.id=v.owner_id WHERE f.user_id=$1 AND v.status='ready' AND v.playback_id IS NOT NULL ORDER BY f.created_at DESC",[req.user.id]);
 res.json({videos:r.rows.map(v=>({id:'db-'+v.id,ownerId:String(v.owner_id),title:v.title,channel:v.username,views:'В избранном',time:new Date(v.created_at).toLocaleDateString('ru-RU'),duration:v.duration?new Date(v.duration*1000).toISOString().slice(14,19):'',image:v.cover?'https://mirvex-api.onrender.com/api/videos/'+v.id+'/cover':'https://image.mux.com/'+v.playback_id+'/thumbnail.jpg?width=900',avatar:(v.username||'M').slice(0,1).toUpperCase(),videoUrl:'https://stream.mux.com/'+v.playback_id+'.m3u8',isPublic:v.is_public}))});
});
app.post('/api/videos/:id/favorite',requireDb,auth,async(req,res)=>{
 const id=numericVideoId(req.params.id),favorite=req.body?.favorite;
 if(!id||typeof favorite!=='boolean')return res.status(400).json({error:'Некорректный запрос'});
 const v=await pool.query("SELECT id FROM videos WHERE id=$1 AND status='ready' AND (is_public=TRUE OR owner_id=$2)",[id,req.user.id]);
 if(!v.rowCount)return res.status(404).json({error:'Видео не найдено'});
 if(favorite)await pool.query('INSERT INTO video_favorites(user_id,video_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.user.id,id]);
 else await pool.query('DELETE FROM video_favorites WHERE user_id=$1 AND video_id=$2',[req.user.id,id]);
 res.json({ok:true,isFavorite:favorite});
});
app.get('/api/library/playlists',requireDb,auth,async(req,res)=>{
 const p=await pool.query('SELECT id,title,created_at FROM playlists WHERE user_id=$1 ORDER BY created_at DESC',[req.user.id]);
 const v=await pool.query("SELECT pv.playlist_id,v.id,v.owner_id,v.title,v.playback_id,v.duration,v.created_at,v.cover,v.is_public,u.username FROM playlist_videos pv JOIN videos v ON v.id=pv.video_id JOIN users u ON u.id=v.owner_id JOIN playlists p ON p.id=pv.playlist_id WHERE p.user_id=$1 AND v.status='ready' ORDER BY pv.added_at DESC",[req.user.id]);
 const videos=v.rows.map(x=>({id:'db-'+x.id,ownerId:String(x.owner_id),title:x.title,channel:x.username,views:'В плейлисте',time:new Date(x.created_at).toLocaleDateString('ru-RU'),duration:x.duration?new Date(x.duration*1000).toISOString().slice(14,19):'',image:x.cover?'https://mirvex-api.onrender.com/api/videos/'+x.id+'/cover':'https://image.mux.com/'+x.playback_id+'/thumbnail.jpg?width=900',avatar:(x.username||'M').slice(0,1).toUpperCase(),videoUrl:'https://stream.mux.com/'+x.playback_id+'.m3u8',isPublic:x.is_public}));
 res.json({playlists:p.rows.map(x=>({id:String(x.id),title:x.title,createdAt:x.created_at,videos:v.rows.filter(vv=>String(vv.playlist_id)===String(x.id)).map(vv=>videos.find(z=>z.id==='db-'+vv.id))}))});
});
app.post('/api/library/playlists',requireDb,auth,async(req,res)=>{
 const title=String(req.body?.title||'').trim().slice(0,60);
 if(title.length<1)return res.status(400).json({error:'Название плейлиста не может быть пустым'});
 const r=await pool.query('INSERT INTO playlists(user_id,title) VALUES($1,$2) RETURNING id,title,created_at',[req.user.id,title]);
 res.status(201).json({playlist:{id:String(r.rows[0].id),title:r.rows[0].title,createdAt:r.rows[0].created_at,videos:[]}});
});
app.post('/api/library/playlists/:id/videos',requireDb,auth,async(req,res)=>{
 const playlistId=String(req.params.id),videoId=numericVideoId(req.body?.videoId);
 if(!/^\d+$/.test(playlistId)||!videoId)return res.status(400).json({error:'Некорректный плейлист или видео'});
 const p=await pool.query('SELECT id FROM playlists WHERE id=$1 AND user_id=$2',[playlistId,req.user.id]);
 if(!p.rowCount)return res.status(404).json({error:'Плейлист не найден'});
 const v=await pool.query("SELECT id FROM videos WHERE id=$1 AND status='ready' AND (is_public=TRUE OR owner_id=$2)",[videoId,req.user.id]);
 if(!v.rowCount)return res.status(404).json({error:'Видео недоступно'});
 await pool.query('INSERT INTO playlist_videos(playlist_id,video_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[playlistId,videoId]);
 res.json({ok:true});
});
app.delete('/api/library/playlists/:id/videos/:videoId',requireDb,auth,async(req,res)=>{
 const p=await pool.query('SELECT id FROM playlists WHERE id=$1 AND user_id=$2',[req.params.id,req.user.id]);
 if(!p.rowCount)return res.status(404).json({error:'Плейлист не найден'});
 const id=numericVideoId(req.params.videoId);if(!id)return res.status(400).json({error:'Некорректное видео'});
 await pool.query('DELETE FROM playlist_videos WHERE playlist_id=$1 AND video_id=$2',[req.params.id,id]);res.json({ok:true});
});
app.delete('/api/library/playlists/:id',requireDb,auth,async(req,res)=>{
 const r=await pool.query('DELETE FROM playlists WHERE id=$1 AND user_id=$2 RETURNING id',[req.params.id,req.user.id]);
 if(!r.rowCount)return res.status(404).json({error:'Плейлист не найден'});
 res.json({ok:true});
});

app.post('/api/videos/:id/report',requireDb,auth,async(req,res)=>{
 const id=numericVideoId(req.params.id),reason=String(req.body?.reason||'').trim(),details=String(req.body?.details||'').trim().slice(0,1000);
 const allowed=['Спам или мошенничество','Насилие или опасный контент','Ненависть или травля','Нарушение авторских прав','Сексуальный контент','Другое'];
 if(!id||!allowed.includes(reason))return res.status(400).json({error:'Выбери причину жалобы'});
 const v=await pool.query("SELECT v.id,v.title,v.playback_id,v.is_public,v.owner_id,u.username FROM videos v JOIN users u ON u.id=v.owner_id WHERE v.id=$1 AND v.status='ready'",[id]);
 if(!v.rowCount||!v.rows[0].is_public)return res.status(404).json({error:'Публичное видео не найдено'});
 if(String(v.rows[0].owner_id)===String(req.user.id))return res.status(400).json({error:'Нельзя пожаловаться на собственное видео'});
 const duplicate=await pool.query("SELECT id FROM video_reports WHERE video_id=$1 AND reporter_id=$2 AND status='new'",[id,req.user.id]);
 if(duplicate.rowCount)return res.status(409).json({error:'Ты уже отправил жалобу на это видео'});
 const videoUrl='https://frame-video-platform.onrender.com/?video=db-'+id;
 const r=await pool.query('INSERT INTO video_reports(video_id,video_title,video_url,reporter_id,reporter_name,reason,details) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,created_at',[id,v.rows[0].title,videoUrl,req.user.id,req.user.username,reason,details]);
 res.status(201).json({ok:true,report:r.rows[0]});
});
app.get('/api/admin/reports',requireDb,auth,adminOnly,async(req,res)=>{
 const r=await pool.query(`SELECT r.id,r.video_id,r.video_title,r.video_url,r.reporter_name,r.reason,r.details,r.status,r.created_at,
 v.playback_id,v.cover,v.owner_id,u.username AS video_owner
 FROM video_reports r LEFT JOIN videos v ON v.id=r.video_id LEFT JOIN users u ON u.id=v.owner_id
 ORDER BY CASE r.status WHEN 'new' THEN 0 WHEN 'reviewed' THEN 1 ELSE 2 END,r.created_at DESC LIMIT 200`);
 res.json({reports:r.rows.map(x=>({...x,id:String(x.id),videoId:x.video_id?'db-'+x.video_id:null,videoOwner:x.video_owner||'Аккаунт удалён',image:x.cover&&x.video_id?'https://mirvex-api.onrender.com/api/videos/'+x.video_id+'/cover':x.playback_id?'https://image.mux.com/'+x.playback_id+'/thumbnail.jpg?width=600':null,streamUrl:x.playback_id?'https://stream.mux.com/'+x.playback_id+'.m3u8':null}))});
});
app.post('/api/admin/reports/:id/status',requireDb,auth,adminOnly,async(req,res)=>{
 const status=req.body?.status;if(!['reviewed','rejected'].includes(status))return res.status(400).json({error:'Некорректный статус'});
 const r=await pool.query('UPDATE video_reports SET status=$1,reviewed_at=NOW() WHERE id=$2 RETURNING id,status',[status,req.params.id]);
 if(!r.rowCount)return res.status(404).json({error:'Жалоба не найдена'});res.json({ok:true,report:r.rows[0]});
});
app.get('/api/admin/videos',requireDb,auth,adminOnly,async(req,res)=>{
 const r=await pool.query(`SELECT v.id,v.title,v.playback_id,v.created_at,v.owner_id,v.is_public,v.cover,u.username AS owner_name
 FROM videos v JOIN users u ON u.id=v.owner_id
 WHERE v.status='ready' AND v.playback_id IS NOT NULL
 ORDER BY v.created_at DESC LIMIT 300`);
 res.json({videos:r.rows.map(v=>({id:'db-'+v.id,title:v.title,ownerId:String(v.owner_id),ownerName:v.owner_name,isPublic:v.is_public,createdAt:v.created_at,image:v.cover?'https://mirvex-api.onrender.com/api/videos/'+v.id+'/cover':'https://image.mux.com/'+v.playback_id+'/thumbnail.jpg?width=600',streamUrl:'https://stream.mux.com/'+v.playback_id+'.m3u8'}))});
});
app.delete('/api/admin/videos/:id',requireDb,auth,adminOnly,async(req,res)=>{
 const id=numericVideoId(req.params.id);if(!id)return res.status(400).json({error:'Некорректное видео'});
 const r=await pool.query('SELECT id,asset_id FROM videos WHERE id=$1',[id]);if(!r.rowCount)return res.status(404).json({error:'Видео не найдено'});
 if(r.rows[0].asset_id){try{await fetch('https://api.mux.com/video/v1/assets/'+encodeURIComponent(r.rows[0].asset_id),{method:'DELETE',headers:{Authorization:muxAuth()}});}catch(e){console.error('Mux asset deletion failed:',e.message);}}
 await pool.query('DELETE FROM videos WHERE id=$1',[id]);res.json({ok:true});
});


app.post('/api/videos/:id/view',requireDb,auth,async(req,res)=>{
 const id=numericVideoId(req.params.id);if(!id)return res.status(400).json({error:'Некорректное видео'});
 const v=await pool.query("SELECT id,owner_id,is_public FROM videos WHERE id=$1 AND status='ready'",[id]);
 if(!v.rowCount||(!v.rows[0].is_public&&String(v.rows[0].owner_id)!==String(req.user.id)))return res.status(404).json({error:'Видео недоступно'});
 if(String(v.rows[0].owner_id)!==String(req.user.id)){
  const recent=await pool.query("SELECT id FROM video_views WHERE video_id=$1 AND viewer_id=$2 AND created_at>NOW()-INTERVAL '30 minutes' LIMIT 1",[id,req.user.id]);
  if(!recent.rowCount)await pool.query('INSERT INTO video_views(video_id,viewer_id) VALUES($1,$2)',[id,req.user.id]);
 }
 const count=await pool.query('SELECT COUNT(*)::int AS views FROM video_views WHERE video_id=$1',[id]);
 res.json({views:count.rows[0].views});
});
app.get('/api/shorts',requireDb,async(_req,res)=>{
 const r=await pool.query(`SELECT v.id,v.owner_id,v.title,v.playback_id,v.duration,v.created_at,v.cover,u.username,
  (SELECT COUNT(*)::int FROM video_reactions vr WHERE vr.video_id=v.id AND vr.reaction='like') AS likes,
  (SELECT COUNT(*)::int FROM video_views vv WHERE vv.video_id=v.id) AS views
  FROM videos v JOIN users u ON u.id=v.owner_id
  WHERE v.is_short=TRUE AND v.is_public=TRUE AND v.status='ready' AND v.playback_id IS NOT NULL
  ORDER BY v.created_at DESC LIMIT 100`);
 res.json({videos:r.rows.map(v=>({id:'db-'+v.id,ownerId:String(v.owner_id),title:v.title,channel:v.username,
  views:Number(v.views||0),likes:Number(v.likes||0),time:new Date(v.created_at).toLocaleDateString('ru-RU'),
  duration:v.duration||0,image:v.cover?'https://mirvex-api.onrender.com/api/videos/'+v.id+'/cover':'https://image.mux.com/'+v.playback_id+'/thumbnail.jpg?width=720',
  avatar:(v.username||'M').slice(0,1).toUpperCase(),videoUrl:'https://stream.mux.com/'+v.playback_id+'.m3u8',isPublic:true,isShort:true
 }))});
});

app.get('/api/trending/videos',requireDb,async(_req,res)=>{
 const r=await pool.query(`SELECT v.id,v.owner_id,v.title,v.playback_id,v.duration,v.created_at,v.cover,u.username,
  COUNT(DISTINCT vv.id) FILTER(WHERE vv.created_at>NOW()-INTERVAL '7 days')::int AS views,
  COUNT(DISTINCT vr.user_id) FILTER(WHERE vr.reaction='like')::int AS likes
  FROM videos v JOIN users u ON u.id=v.owner_id
  LEFT JOIN video_views vv ON vv.video_id=v.id
  LEFT JOIN video_reactions vr ON vr.video_id=v.id
  WHERE v.is_public=TRUE AND v.status='ready' AND v.playback_id IS NOT NULL
  GROUP BY v.id,u.username ORDER BY (COUNT(DISTINCT vv.id) FILTER(WHERE vv.created_at>NOW()-INTERVAL '7 days')*2+COUNT(DISTINCT vr.user_id) FILTER(WHERE vr.reaction='like')) DESC,v.created_at DESC LIMIT 100`);
 res.json({videos:r.rows.map(v=>({id:'db-'+v.id,ownerId:String(v.owner_id),title:v.title,channel:v.username,views:Number(v.views||0)+' просмотров за 7 дней',viewCount:Number(v.views||0),likes:Number(v.likes||0),time:new Date(v.created_at).toLocaleDateString('ru-RU'),duration:v.duration?new Date(v.duration*1000).toISOString().slice(14,19):'',image:v.cover?'https://mirvex-api.onrender.com/api/videos/'+v.id+'/cover':'https://image.mux.com/'+v.playback_id+'/thumbnail.jpg?width=900',avatar:(v.username||'M').slice(0,1).toUpperCase(),videoUrl:'https://stream.mux.com/'+v.playback_id+'.m3u8',isPublic:true}))});
});
app.get('/api/studio/overview',requireDb,auth,async(req,res)=>{
 const [totals,daily,videos]=await Promise.all([
  pool.query(`SELECT COUNT(*) FILTER(WHERE status='ready')::int AS videos,COUNT(DISTINCT vv.id)::int AS views,COUNT(DISTINCT (vr.video_id,vr.user_id)) FILTER(WHERE vr.reaction='like')::int AS likes,COUNT(DISTINCT c.id)::int AS comments FROM videos v LEFT JOIN video_views vv ON vv.video_id=v.id LEFT JOIN video_reactions vr ON vr.video_id=v.id LEFT JOIN video_comments c ON c.video_id=v.id WHERE v.owner_id=$1`,[req.user.id]),
  pool.query(`SELECT d.day::date AS day,COUNT(vv.id) FILTER(WHERE v.id IS NOT NULL)::int AS views FROM generate_series(CURRENT_DATE-6,CURRENT_DATE,INTERVAL '1 day') d(day) LEFT JOIN video_views vv ON vv.created_at>=d.day AND vv.created_at<d.day+INTERVAL '1 day' LEFT JOIN videos v ON v.id=vv.video_id AND v.owner_id=$1 GROUP BY d.day ORDER BY d.day`,[req.user.id]),
  pool.query(`SELECT v.id,v.title,v.created_at,COUNT(DISTINCT vv.id)::int AS views,COUNT(DISTINCT vr.user_id) FILTER(WHERE vr.reaction='like')::int AS likes,COUNT(DISTINCT c.id)::int AS comments FROM videos v LEFT JOIN video_views vv ON vv.video_id=v.id LEFT JOIN video_reactions vr ON vr.video_id=v.id LEFT JOIN video_comments c ON c.video_id=v.id WHERE v.owner_id=$1 AND v.status='ready' GROUP BY v.id ORDER BY v.created_at DESC LIMIT 20`,[req.user.id])
 ]);
 res.json({totals:totals.rows[0],daily:daily.rows.map(x=>({day:new Date(x.day).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'}),views:x.views})),videos:videos.rows.map(x=>({...x,id:'db-'+x.id}))});
});
app.get('/api/notifications',requireDb,auth,async(req,res)=>{
 const r=await pool.query('SELECT id,actor_name,kind,video_id,video_title,created_at,read_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',[req.user.id]);
 const unread=await pool.query('SELECT COUNT(*)::int AS count FROM notifications WHERE user_id=$1 AND read_at IS NULL',[req.user.id]);
 res.json({notifications:r.rows.map(x=>({...x,id:String(x.id),videoId:x.video_id?'db-'+x.video_id:null})),unread:unread.rows[0].count});
});
app.post('/api/notifications/read',requireDb,auth,async(req,res)=>{
 await pool.query('UPDATE notifications SET read_at=NOW() WHERE user_id=$1 AND read_at IS NULL',[req.user.id]);
 res.json({ok:true});
});

app.use((err,_req,res,_next)=>res.status(400).json({error:err.message||'Ошибка запроса'}));
initDb().then(()=>app.listen(PORT,'0.0.0.0',()=>console.log('MIRVEX API listening on '+PORT))).catch(e=>{console.error('Database initialization failed:',e);process.exit(1);});
