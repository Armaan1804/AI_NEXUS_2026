import mongoose from 'mongoose';
import { event as defaultEvent, judges as defaultJudges, teams as defaultTeams } from './data.js';
import { Event } from './models/Event.js';
import { Judge } from './models/Judge.js';
import { Team } from './models/Team.js';
import { Game } from './models/Game.js';

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in .env');
  }

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB Atlas');
    await seedInitialData();
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    throw error;
  }
}

async function seedInitialData() {
  const eventCount = await Event.countDocuments();
  if (eventCount === 0) {
    console.log('Seeding initial event data...');
    await Event.create({
      ...defaultEvent,
      contacts: defaultEvent.contacts || [],
      photos: defaultEvent.photos || []
    });
  }

  const teamCount = await Team.countDocuments();
  if (teamCount === 0) {
    console.log('Seeding initial teams...');
    const formattedTeams = defaultTeams.map((name, index) => ({
      id: `team-${String(index + 1).padStart(3, '0')}`,
      name: String(name).trim(),
      bonusPoints: 0,
      scores: {}
    }));
    await Team.insertMany(formattedTeams);
  }

  const judgeCount = await Judge.countDocuments();
  if (judgeCount === 0) {
    console.log('Seeding initial judges...');
    const judgesData = [
      {
        "name": "Mr. Rakesh Gahlot",
        "companyName": "Mphasis Corporation",
        "photoUrl": "/api/uploads/1776229071403-28a92a20b275.jpeg"
      },
      {
        "name": "Amol M. Khadge",
        "companyName": "MSR Technology Group",
        "photoUrl": "/api/uploads/1776229456523-fb87dfde5608.jpeg"
      },
      {
        "name": "Jafash Wadhwa",
        "companyName": "Sapient",
        "photoUrl": "/api/uploads/1776229455202-cb3fb6377c37.jpeg"
      },
      {
        "name": "Manish Kumar Abhay Singh",
        "companyName": "Mphasis Corporation",
        "photoUrl": "/api/uploads/1776229453161-aa90ad6e329b.jpeg"
      }
    ];
    await Judge.insertMany(judgesData);
  }
}


export async function loadSnapshot() {
  const event = await Event.findOne().lean();
  const judges = await Judge.find().lean();
  const teams = await Team.find().lean();
  const games = await Game.find().lean();

  return {
    event: event || defaultEvent,
    judges: judges || [],
    teams: teams || [],
    games: games || []
  };
}

export async function saveSnapshot(snapshot) {
  if (snapshot.event) {
    const { _id, createdAt, updatedAt, ...eventData } = snapshot.event;
    await Event.updateOne({}, { $set: eventData }, { upsert: true });
  }
  
  if (snapshot.judges) {
    // For judges, we might need a more complex sync if they are added/removed.
    // For simplicity in the admin dashboard, we'll just handle updates via specific endpoints usually.
  }
}
