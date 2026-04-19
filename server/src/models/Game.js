import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  teamId: { type: String, required: true },
  teamName: { type: String, required: true },
  college: { type: String },
  entry: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  awardedPoints: { type: Number, default: 0 },
  reviewedAt: { type: Date }
});

const gameSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  entryLabel: { type: String, default: 'Submission' },
  deadline: { type: String },
  rewardPoints: { type: Number, default: 0 },
  acceptingEntries: { type: Boolean, default: true },
  submissions: [submissionSchema]
}, { timestamps: true });

export const Game = mongoose.model('Game', gameSchema);
