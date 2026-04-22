import { randomUUID } from 'node:crypto';
import { Game } from './models/Game.js';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeRewardPoints(value) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
}

function hasDeadlineExpired(deadline) {
  const parsedDeadline = Date.parse(deadline);
  if (!Number.isFinite(parsedDeadline)) return false;
  return Date.now() > parsedDeadline;
}

import { isDbConnected } from './persistence.js';

export async function getGames() {
  if (!isDbConnected) return [];
  return await Game.find().sort({ createdAt: -1 }).lean();
}

export async function createGame(input) {
  const title = normalizeText(input?.title);
  const description = normalizeText(input?.description);
  const entryLabel = normalizeText(input?.entryLabel) || 'Submission';
  const deadline = normalizeText(input?.deadline);
  const rewardPoints = normalizeRewardPoints(input?.rewardPoints);

  if (!title) throw new Error('game title is required');
  if (!description) throw new Error('game description is required');

  const game = await Game.create({
    id: randomUUID(),
    title,
    description,
    entryLabel,
    deadline,
    rewardPoints,
    acceptingEntries: true,
    submissions: []
  });

  return game.toObject();
}

export async function setGameEntryStatus(gameId, acceptingEntries) {
  const game = await Game.findOne({ id: gameId });
  if (!game) throw new Error('Game not found');

  game.acceptingEntries = Boolean(acceptingEntries);
  await game.save();
  return game.toObject();
}

export async function submitGameEntry({ gameId, teamId, teamName, college, entry }) {
  const game = await Game.findOne({ id: gameId });
  if (!game) throw new Error('Game not found');

  if (!game.acceptingEntries || hasDeadlineExpired(game.deadline)) {
    throw new Error('Entries are closed for this game');
  }

  const normalizedEntry = normalizeText(entry);
  if (!normalizedEntry) throw new Error('entry is required');

  if (game.submissions.some((s) => s.teamId === teamId)) {
    throw new Error('This team has already submitted for this game');
  }

  const submission = {
    id: randomUUID(),
    teamId,
    teamName,
    college: normalizeText(college),
    entry: normalizedEntry,
    createdAt: new Date(),
    status: 'pending',
    awardedPoints: 0
  };

  game.submissions.unshift(submission);
  await game.save();

  return {
    game: game.toObject(),
    submission
  };
}

export async function reviewGameSubmission({ gameId, submissionId, decision }, awardPointsFn) {
  const game = await Game.findOne({ id: gameId });
  if (!game) throw new Error('Game not found');

  const submission = game.submissions.find((s) => s.id === submissionId);
  if (!submission) throw new Error('Submission not found');
  if (submission.status !== 'pending') throw new Error('Submission already reviewed');

  if (decision !== 'approved' && decision !== 'rejected') {
    throw new Error('decision must be approved or rejected');
  }

  submission.status = decision;
  submission.reviewedAt = new Date();

  if (decision === 'approved') {
    submission.awardedPoints = game.rewardPoints;
    if (typeof awardPointsFn === 'function') {
      await awardPointsFn(submission.teamId, submission.awardedPoints);
    }
  }

  await game.save();
  return {
    game: game.toObject(),
    submission: submission.toObject()
  };
}

export async function deleteGame(gameId) {
  const result = await Game.deleteOne({ id: gameId });
  if (result.deletedCount === 0) throw new Error('Game not found');
}
