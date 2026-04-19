import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  college: { type: String, default: '' },
  members: [{ type: String }],
  bonusPoints: { type: Number, default: 0 },
  scores: { type: Map, of: Number, default: {} }
}, { timestamps: true });

export const Team = mongoose.model('Team', teamSchema);
