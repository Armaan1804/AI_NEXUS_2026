import { rounds } from './data.js';
import { Team } from './models/Team.js';

const clients = new Set();

export function calculateLeaderboard(currentTeams) {
  return currentTeams
    .map((team) => {
      // Handle Mongoose Map or plain object
      const scoresObj = team.scores instanceof Map 
        ? Object.fromEntries(team.scores) 
        : (team.scores || {});
        
      return {
        teamId: team.id,
        teamName: String(team.name ?? '').trim(),
        college: String(team.college ?? '').trim(),
        total:
          rounds.reduce((sum, round) => sum + (Number(scoresObj[round.id]) || 0), 0) +
          (Number(team.bonusPoints) || 0),
        roundScores: scoresObj
      };
    })
    .sort(
      (left, right) =>
        right.total - left.total ||
        left.teamName.localeCompare(right.teamName)
    );
}

export async function getFullState(games = []) {
  const teams = await Team.find().lean();
  return {
    teams,
    rounds,
    leaderboard: calculateLeaderboard(teams),
    games
  };
}

export async function updateScore(teamId, roundId, score) {
  if (!rounds.some((round) => round.id === roundId)) {
    throw new Error('Round not found');
  }

  const team = await Team.findOne({ id: teamId });
  if (!team) {
    throw new Error('Team not found');
  }

  // Ensure scores is initialized
  if (!team.scores) team.scores = new Map();
  team.scores.set(roundId, score);
  await team.save();
}

export async function awardPoints(teamId, points) {
  const awardedPoints = Number(points);
  if (!Number.isFinite(awardedPoints) || awardedPoints <= 0) return;

  const team = await Team.findOne({ id: teamId });
  if (!team) throw new Error('Team not found');

  team.bonusPoints = (Number(team.bonusPoints) || 0) + awardedPoints;
  await team.save();
}

export async function deductPoints(teamId, points) {
  const deduction = Number(points);
  if (!Number.isFinite(deduction) || deduction <= 0) throw new Error('Invalid points amount');

  const team = await Team.findOne({ id: teamId });
  if (!team) throw new Error('Team not found');

  const currentBonus = Number(team.bonusPoints) || 0;
  team.bonusPoints = Math.max(0, currentBonus - deduction);
  await team.save();
}

export function subscribeClient(res) {
  clients.add(res);
  res.on('close', () => clients.delete(res));
}

export function broadcast(payload) {
  const message = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    client.write(message);
  }
}