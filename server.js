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
}, methods: ['GET','POST','PUT'], allowedHeaders: ['Content-Type','Authorization'] }));
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
    CREATE INDEX IF NOT EXISTS videos_owner_created_idx ON videos(owner_id, created_at DESC);
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
    const user=result.rows[0], token=jwt.sign({id:user.id,email:user.email,username:user.username},JWT_SECRET,{expiresIn:'30d'});
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
    const token=jwt.sign({id:user.id,email:user.email,username:user.username},JWT_SECRET,{expiresIn:'30d'});
    res.json({token,user:{id:user.id,email:user.email,username:user.username}});
  } catch { res.status(500).json({error:'Не удалось войти'}); }
});
app.get('/api/auth/me', requireDb, auth, async (req,res) => {
  const r=await pool.query('SELECT id,email,username FROM users WHERE id=$1',[req.user.id]);
  if(!r.rowCount) return res.status(401).json({error:'Аккаунт не найден'});
  res.json({user:r.rows[0]});
});

app.post('/api/uploads', requireDb, auth, async (req,res) => {
  try {
    const title=String(req.body?.title||'Новое видео').trim().slice(0,120);
    const response=await fetch('https://api.mux.com/video/v1/uploads',{method:'POST',headers:{Authorization:muxAuth(),'Content-Type':'application/json'},body:JSON.stringify({
      cors_origin:FRONTEND_ORIGIN,
      new_asset_settings:{playback_policies:['public'],video_quality:'basic',meta:{title}}
    })});
    const payload=await response.json();
    if(!response.ok) return res.status(response.status).json({error:payload?.error?.messages?.join(', ')||payload?.message||'Mux upload creation failed'});
    await pool.query('INSERT INTO videos(owner_id,upload_id,title,status) VALUES($1,$2,$3,$4)',[req.user.id,payload.data.id,title,'processing']);
    res.json({uploadId:payload.data.id,uploadUrl:payload.data.url,status:payload.data.status});
  } catch(e) { res.status(500).json({error:e.message||'Не удалось создать загрузку'}); }
});
app.get('/api/uploads/:id', requireDb, auth, async (req,res) => {
  try {
    const owned=await pool.query('SELECT id FROM videos WHERE upload_id=$1 AND owner_id=$2',[req.params.id,req.user.id]);
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
    await pool.query('UPDATE videos SET asset_id=$1,playback_id=$2,status=$3,duration=$4 WHERE upload_id=$5 AND owner_id=$6',[asset.id,playbackId,asset.status,asset.duration||null,req.params.id,req.user.id]);
    res.json({status:asset.status,assetId:asset.id,playbackId,duration:asset.duration||null});
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
app.get('/api/videos', requireDb, auth, async (req,res) => {
  const r=await pool.query(`SELECT id,title,upload_id,asset_id,playback_id,status,duration,created_at,
    CASE WHEN cover IS NOT NULL THEN '/api/videos/'||id||'/cover' ELSE NULL END AS cover_url
    FROM videos WHERE owner_id=$1 AND playback_id IS NOT NULL AND status='ready' ORDER BY created_at DESC`,[req.user.id]);
  res.json({videos:r.rows.map(v=>({...v,id:'db-'+v.id,videoUrl:v.playback_id?'https://stream.mux.com/'+v.playback_id+'.m3u8':null,image:v.cover_url?'https://mirvex-api.onrender.com'+v.cover_url:'https://image.mux.com/'+v.playback_id+'/thumbnail.jpg?width=900',channel:'Мой канал',views:'Ваше видео',time:new Date(v.created_at).toLocaleDateString('ru-RU'),category:'Мои видео',avatar:'М'}))});
});

app.use((err,_req,res,_next)=>res.status(400).json({error:err.message||'Ошибка запроса'}));
initDb().then(()=>app.listen(PORT,'0.0.0.0',()=>console.log('MIRVEX API listening on '+PORT))).catch(e=>{console.error('Database initialization failed:',e);process.exit(1);});
