import mongoose from 'mongoose';

const judgeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  companyName: { type: String },
  photoUrl: { type: String }
}, { timestamps: true });

export const Judge = mongoose.model('Judge', judgeSchema);
