import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const dataFilePath = path.resolve(__dirname, '../../data/runtime-data.json');

const topTeamsList = [
  "Farsight AI",
  "Vandalizers",
  "Rasta",
  "404 Trio Not Found",
  "Ace",
  "CloudMind AI",
  "Digital Dominators",
  "Elite Engineers",
  "Team Cypher",
  "Team Elites",
  "Team Vayu"
];

const teamSchema = new mongoose.Schema({
  id: String,
  name: String,
  college: String,
  bonusPoints: Number,
  scores: Map
});

const Team = mongoose.model('Team', teamSchema);

async function updateTeams() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    // 1. Update MongoDB
    console.log('Updating MongoDB teams...');
    
    // We'll give each top team a unique high score to ensure the order is exactly as requested
    for (let i = 0; i < topTeamsList.length; i++) {
      const name = topTeamsList[i];
      const bonusPoints = 1000 - i; // Decreasing points to maintain order
      
      // Try to find the team by name (case-insensitive) or create it
      let team = await Team.findOne({ name: new RegExp(`^${name}$`, 'i') });
      
      if (!team) {
        // Try variations if not found
        const variations = {
          "Farsight AI": "FAIRSIGHT AI",
          "CloudMind AI": "CloudMindAI",
          "Digital Dominators": "Digital Dominator",
          "Team Elites": "Team Of Elites",
          "Team Vayu": "TEAM VAAYU"
        };
        if (variations[name]) {
          team = await Team.findOne({ name: new RegExp(`^${variations[name]}$`, 'i') });
        }
      }

      if (team) {
        console.log(`Updating ${team.name} -> ${name} with ${bonusPoints} points`);
        team.name = name;
        team.bonusPoints = bonusPoints;
        await team.save();
      } else {
        console.log(`Team ${name} not found, creating...`);
        const id = `team-top-${i + 1}`;
        await Team.create({
          id,
          name,
          college: 'Finalist',
          bonusPoints,
          scores: {}
        });
      }
    }

    // Reset points for everyone else to 0
    await Team.updateMany(
      { name: { $nin: topTeamsList } },
      { $set: { bonusPoints: 0, scores: {} } }
    );

    console.log('MongoDB update complete.');

    // 2. Update runtime-data.json if it exists
    if (fs.existsSync(dataFilePath)) {
      console.log('Updating runtime-data.json...');
      const data = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
      
      // We'll just replace the teams array with the ones from DB or a fresh set
      const allTeams = await Team.find().lean();
      data.teams = allTeams.map(t => ({
        id: t.id,
        name: t.name,
        college: t.college || '',
        bonusPoints: t.bonusPoints || 0,
        scores: t.scores || {}
      }));
      
      fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
      console.log('runtime-data.json update complete.');
    }

    await mongoose.disconnect();
    console.log('Done.');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateTeams();
