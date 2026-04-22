import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import { event as defaultEvent, judges as defaultJudges, teams as defaultTeams } from './data.js';
import { Event } from './models/Event.js';
import { Judge } from './models/Judge.js';
import { Team } from './models/Team.js';
import { Game } from './models/Game.js';

export let isDbConnected = false;

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('MONGODB_URI is not defined in .env. Running in LOCAL MODE.');
    return;
  }

  try {
    // Set a timeout for the connection attempt
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000 
    });
    console.log('Connected to MongoDB Atlas');
    isDbConnected = true;
    await seedInitialData();
  } catch (error) {
    console.error('--- DATABASE CONNECTION FAILED ---');
    console.error('Error:', error.message);
    console.warn('The application will continue in LOCAL MODE using local JSON data.');
    console.error('----------------------------------');
    isDbConnected = false;
  }
}

async function seedInitialData() {
  const eventCount = await Event.countDocuments();
  if (eventCount === 0) {
    console.log('Seeding initial event data...');
    await Event.create({
      ...defaultEvent,
      contacts: [
        {
          "name": "Yasha Tasaneem",
          "phone": "63875 11385",
          "label": "Hackathon Coordinator"
        },
        {
          "name": "Namit Sharma",
          "phone": "98556 03243",
          "label": "Technical Lead(Admin)"
        }
      ],
      photos: [
        {
          "imageUrl": "/api/uploads/1776157535536-1d7fa0f1fac7.jpeg",
          "caption": "Glimpse from past Event"
        },
        {
          "imageUrl": "/api/uploads/1776157439686-c9f99212e234.jpeg",
          "caption": "Networking session"
        }

      ]
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
  if (!isDbConnected) {
    const dataFilePath = path.resolve(process.cwd(), 'server/data/runtime-data.json');
    let localTeams = defaultTeams.map((name, index) => ({
      id: `team-${String(index + 1).padStart(3, '0')}`,
      name: name,
      college: '',
      bonusPoints: 0,
      scores: {}
    }));

    try {
      if (fs.existsSync(dataFilePath)) {
        const localData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
        if (localData.teams) localTeams = localData.teams;
      }
    } catch (e) {
      console.warn('Could not load runtime-data.json fallback:', e.message);
    }

    return {
      event: defaultEvent,
      judges: [],
      teams: localTeams,
      games: []
    };
  }

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
