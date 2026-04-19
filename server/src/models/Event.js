import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  label: { type: String, required: true }
});

const photoSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  caption: { type: String }
});

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subtitle: { type: String, required: true },
  summary: { type: String, required: true },
  dates: [{ type: String }],
  venue: { type: String, required: true },
  prizePool: { type: Number, default: 0 },
  tracks: [{ type: String }],
  organizers: { type: String },
  contacts: [contactSchema],
  photos: [photoSchema]
}, { timestamps: true });

export const Event = mongoose.model('Event', eventSchema);
