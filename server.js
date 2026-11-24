import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 10000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://frame-video-platform.onrender.com';

app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === FRONTEND_ORIGIN) return callback(null, true);
    return callback(new Error('Origin not allowed'));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json({ limit: '32kb' }));

const attempts = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const recent = (attempts.get(ip) || []).filter(time => now - time < 60 * 60 * 1000);
  if (recent.length >= 10) return res.status(429).json({ error: 'Слишком много запросов. Попробуйте позже.' });
  recent.push(now);
  attempts.set(ip, recent);
  next();
}

function muxAuth() {
  const id = process.env.MUX_TOKEN_ID;
  const secret = process.env.MUX_TOKEN_SECRET;
  if (!id || !secret) throw new Error('Mux API credentials are not configured');
  return 'Basic ' + Buffer.from(id + ':' + secret).toString('base64');
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'mirvex-api' }));

app.post('/api/uploads', rateLimit, async (req, res) => {
  try {
    const title = String(req.body?.title || 'Новое видео').trim().slice(0, 100);
    const response = await fetch('https://api.mux.com/video/v1/uploads', {
      method: 'POST',
      headers: { Authorization: muxAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cors_origin: FRONTEND_ORIGIN,
        new_asset_settings: {
          playback_policies: ['public'],
          video_quality: 'basic',
          meta: { title }
        }
      })
    });
    const payload = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: payload?.error?.messages?.join(', ') || payload?.message || 'Mux upload creation failed' });
    res.json({ uploadId: payload.data.id, uploadUrl: payload.data.url, status: payload.data.status });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Не удалось создать загрузку' });
  }
});

app.get('/api/uploads/:id', async (req, res) => {
  try {
    const response = await fetch('https://api.mux.com/video/v1/uploads/' + encodeURIComponent(req.params.id), {
      headers: { Authorization: muxAuth() }
    });
    const payload = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: payload?.error?.messages?.join(', ') || 'Не удалось получить статус загрузки' });
    const upload = payload.data;
    if (upload.status !== 'asset_created' || !upload.asset_id) {
      return res.json({ status: upload.status, error: upload.error?.message || null });
    }
    const assetResponse = await fetch('https://api.mux.com/video/v1/assets/' + encodeURIComponent(upload.asset_id), {
      headers: { Authorization: muxAuth() }
    });
    const assetPayload = await assetResponse.json();
    if (!assetResponse.ok) return res.status(assetResponse.status).json({ error: 'Не удалось получить видеофайл' });
    const asset = assetPayload.data;
    res.json({
      status: asset.status,
      assetId: asset.id,
      playbackId: asset.playback_ids?.[0]?.id || null,
      duration: asset.duration || null,
      aspectRatio: asset.aspect_ratio || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Не удалось проверить загрузку' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('MIRVEX API listening on port ' + PORT);
});
