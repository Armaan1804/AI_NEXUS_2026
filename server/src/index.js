import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { schedule } from './data.js';
import { connectDatabase, loadSnapshot, saveSnapshot } from './persistence.js';
import { awardPoints, broadcast, getFullState, subscribeClient, updateScore, deductPoints } from './state.js';
import {
  createGame,
  getGames,
  reviewGameSubmission,
  setGameEntryStatus,
  submitGameEntry,
  deleteGame
} from './games.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}


const port = Number(process.env.PORT ?? 4000);
const clientDistPath = path.resolve(__dirname, '../../client/dist');
const uploadsDirPath = path.resolve(__dirname, '../uploads');

fs.mkdirSync(uploadsDirPath, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDirPath),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image uploads are allowed'));
    }
  },
  limits: { fileSize: 8 * 1024 * 1024 }
});

const adminUsername = String(process.env.ADMIN_USERNAME ?? '').trim();
const adminPassword = String(process.env.ADMIN_PASSWORD ?? '').trim();
const adminSessions = new Map();

function normalizeText(value) {
  return String(value ?? '').trim();
}

function authenticateAdmin(request, response, next) {
  const authorization = request.headers.authorization ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

  if (!token || !adminSessions.has(token)) {
    response.status(401).json({ error: 'Unauthorized admin access' });
    return;
  }

  request.adminUser = adminSessions.get(token);
  next();
}

async function buildAppState() {
  const games = await getGames();
  return await getFullState(games);
}

async function commitAndBroadcast() {
  const state = await buildAppState();
  broadcast(state);
  return state;
}

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDirPath));
app.use('/api/uploads', express.static(uploadsDirPath));

app.get('/api/event', async (request, response) => {
  try {
    const snapshot = await loadSnapshot();
    response.json(snapshot.event);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

app.get('/api/judges', async (request, response) => {
  try {
    const snapshot = await loadSnapshot();
    response.json({ judges: snapshot.judges });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

app.get('/api/schedule', (request, response) => {
  response.json({ schedule });
});

app.get('/api/leaderboard', async (request, response) => {
  try {
    const state = await buildAppState();
    response.json({ teams: state.teams, rounds: state.rounds, leaderboard: state.leaderboard });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

app.get('/api/games', async (request, response) => {
  try {
    const games = await getGames();
    response.json({ games });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/login', (request, response) => {
  if (!adminUsername || !adminPassword) {
    response.status(500).json({ error: 'Admin credentials are not configured' });
    return;
  }

  const username = normalizeText(request.body?.username);
  const password = normalizeText(request.body?.password);

  if (username !== adminUsername || password !== adminPassword) {
    response.status(401).json({ error: 'Invalid admin credentials' });
    return;
  }

  const token = crypto.randomBytes(24).toString('hex');
  adminSessions.set(token, username);
  response.json({ token, username });
});

app.get('/api/admin/session', authenticateAdmin, (request, response) => {
  response.json({ authenticated: true, username: request.adminUser });
});

app.post('/api/admin/logout', authenticateAdmin, (request, response) => {
  const authorization = request.headers.authorization ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  adminSessions.delete(token);
  response.status(204).send();
});

app.put('/api/admin/content', authenticateAdmin, async (request, response) => {
  try {
    const { tracks, contacts, photos } = request.body ?? {};
    const snapshot = await loadSnapshot();
    
    const updatedEvent = {
      ...snapshot.event,
      tracks: Array.isArray(tracks) ? tracks : snapshot.event.tracks,
      contacts: Array.isArray(contacts) ? contacts : snapshot.event.contacts,
      photos: Array.isArray(photos) ? photos : snapshot.event.photos
    };

    await saveSnapshot({ event: updatedEvent });
    await commitAndBroadcast();
    response.json({ event: updatedEvent, judges: snapshot.judges });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/games', authenticateAdmin, async (request, response) => {
  try {
    await createGame(request.body);
    const state = await commitAndBroadcast();
    response.json(state);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.patch('/api/admin/games/:gameId', authenticateAdmin, async (request, response) => {
  try {
    const { gameId } = request.params;
    await setGameEntryStatus(gameId, request.body?.acceptingEntries);
    const state = await commitAndBroadcast();
    response.json(state);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.delete('/api/admin/games/:gameId', authenticateAdmin, async (request, response) => {
  try {
    await deleteGame(request.params.gameId);
    const state = await commitAndBroadcast();
    response.json(state);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.post('/api/games/:gameId/entries', async (request, response) => {
  try {
    const { gameId } = request.params;
    const { teamId, entry } = request.body ?? {};
    const stateBefore = await buildAppState();
    const team = stateBefore.teams.find((t) => t.id === teamId);

    if (!team) throw new Error('Team not found');

    await submitGameEntry({
      gameId,
      teamId,
      teamName: team.name,
      college: team.college,
      entry
    });

    const state = await commitAndBroadcast();
    response.json(state);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.patch('/api/admin/games/:gameId/submissions/:submissionId', authenticateAdmin, async (request, response) => {
  try {
    const { gameId, submissionId } = request.params;
    const decision = normalizeText(request.body?.decision).toLowerCase();

    await reviewGameSubmission({ gameId, submissionId, decision }, awardPoints);
    const state = await commitAndBroadcast();
    response.json(state);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.get('/api/stream', async (request, response) => {
  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('Connection', 'keep-alive');
  response.flushHeaders();

  subscribeClient(response);
  try {
    const state = await buildAppState();
    response.write(`data: ${JSON.stringify(state)}\n\n`);
  } catch (error) {
    console.error('Stream initial state error:', error.message);
  }
});

app.post('/api/rounds/:roundId/scores', async (request, response) => {
  try {
    const { roundId } = request.params;
    const { teamId, score } = request.body;
    await updateScore(teamId, roundId, Number(score));
    const state = await commitAndBroadcast();
    response.json(state);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/teams/:teamId/deduct', authenticateAdmin, async (request, response) => {
  try {
    await deductPoints(request.params.teamId, request.body?.points);
    const state = await commitAndBroadcast();
    response.json(state);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.use(express.static(clientDistPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => err && next());
});

async function startServer() {
  try {
    await connectDatabase();
    console.log(`Client files location: ${clientDistPath}`);
    app.listen(port, '0.0.0.0', () => {
      console.log(`AI NEXUS server running on http://0.0.0.0:${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}


startServer();