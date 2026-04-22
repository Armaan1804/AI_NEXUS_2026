import { rounds } from './data.js';
import { Team } from './models/Team.js';

const clients = new Set();

export function calculateLeaderboard(currentTeams) {
  return [
    { rank: 1, teamName: "Farsight AI", teamId: "finalist-1", total: 0 },
    { rank: 2, teamName: "Vandalizers", teamId: "finalist-2", total: 0 },
    { rank: 3, teamName: "Rasta", teamId: "finalist-3", total: 0 },
    { rank: 4, teamName: "404 Trio Not Found", teamId: "finalist-4", total: 0 },
    { rank: 5, teamName: "Ace", teamId: "finalist-5", total: 0 },
    { rank: 6, teamName: "CloudMind AI", teamId: "finalist-6", total: 0 },
    { rank: 7, teamName: "Digital Dominators", teamId: "finalist-7", total: 0 },
    { rank: 8, teamName: "Elite Engineers", teamId: "finalist-8", total: 0 },
    { rank: 9, teamName: "Team Cypher", teamId: "finalist-9", total: 0 },
    { rank: 10, teamName: "Team Elites", teamId: "finalist-10", total: 0 },
    { rank: 11, teamName: "Team Vayu", teamId: "finalist-11", total: 0 }
  ];
}

import { isDbConnected, loadSnapshot } from './persistence.js';

export async function getFullState() {
  if (!isDbConnected) {
    const snapshot = await loadSnapshot();
    return {
      teams: snapshot.teams,
      rounds,
      leaderboard: calculateLeaderboard(snapshot.teams)
    };
  }

  const teams = await Team.find().lean();
  return {
    teams,
    rounds,
    leaderboard: calculateLeaderboard(teams)
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