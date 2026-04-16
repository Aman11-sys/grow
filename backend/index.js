import express from 'express';
// Force redeploy - Timestamp: 12:17 AM
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY
});

const app = express();
app.use(cors({
  origin: ['https://grow-five-beryl.vercel.app', 'https://grow-production.up.railway.app', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

const PORT = process.env.PORT || 8080;

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST === 'localhost' ? '127.0.0.1' : (process.env.MYSQL_HOST || '127.0.0.1'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'grow_ad',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  port: 3306
});

// Initialize Database and Tables
async function initDB() {
  console.log('--- Initializing Database ---');
  let retries = 5;
  while (retries > 0) {
    try {
      const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST === 'localhost' ? '127.0.0.1' : (process.env.MYSQL_HOST || '127.0.0.1'),
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        port: 3306
      });

      const dbName = process.env.MYSQL_DATABASE || 'grow_ad';
      await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
      await connection.query(`USE ${dbName}`);
      
      console.log(`Connected to MySQL. Using database: ${dbName}`);

      // Table: profiles
      await connection.query(`
        CREATE TABLE IF NOT EXISTS profiles (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255),
          website VARCHAR(255),
          business_type VARCHAR(255),
          audience VARCHAR(255),
          city VARCHAR(255),
          products TEXT,
          ai_industry VARCHAR(255),
          ai_usp TEXT,
          ai_target_persona TEXT,
          ai_tone VARCHAR(255),
          image TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Table: calendars
      await connection.query(`
        CREATE TABLE IF NOT EXISTS calendars (
          id INT AUTO_INCREMENT PRIMARY KEY,
          profile_name VARCHAR(255),
          plan JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Table: captions
      await connection.query(`
        CREATE TABLE IF NOT EXISTS captions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          description TEXT,
          captions JSON,
          image TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Table: festival_ideas
      await connection.query(`
        CREATE TABLE IF NOT EXISTS festival_ideas (
          id INT AUTO_INCREMENT PRIMARY KEY,
          festival_name VARCHAR(255),
          industry VARCHAR(255),
          idea TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Table: insights
      await connection.query(`
        CREATE TABLE IF NOT EXISTS insights (
          id INT AUTO_INCREMENT PRIMARY KEY,
          metrics JSON,
          insight TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('Database schema verified/created successfully');
      await connection.end();
      return; 
    } catch (err) {
      console.error(`Database init attempt failed. Retries left: ${retries-1}`, err.message);
      retries -= 1;
      await new Promise(res => setTimeout(res, 5000)); // Wait 5 seconds
    }
  }
}

initDB();

// AI Generation Route
app.post('/api/ai/generate', async (req, res) => {
  const { prompt } = req.body;
  
  if (!openai.apiKey) {
    return res.status(500).json({ error: 'OpenAI API key missing on server' });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });
    
    let text = response.choices[0].message.content;
    
    // Clean markdown
    if (text.includes("```json")) {
      text = text.split("```json")[1].split("```")[0].trim();
    } else if (text.includes("```")) {
      text = text.split("```")[1].split("```")[0].trim();
    }

    try {
      res.json(JSON.parse(text));
    } catch(e) {
      res.json({ result: text });
    }
  } catch (err) {
    console.error("AI Generation Error:", err);
    res.status(500).json({ error: 'AI Generation failed', message: err.message });
  }
});

// Generic API Routes
app.post('/api/:collection', async (req, res) => {
  const { collection } = req.params;
  const data = req.body;

  try {
    let query = '';
    let values = [];

    switch (collection) {
      case 'profiles':
        query = `INSERT INTO profiles (name, website, business_type, audience, city, products, ai_industry, ai_usp, ai_target_persona, ai_tone, image) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        values = [
          data.name, data.website, data.type, data.audience, data.city, data.products,
          data.ai_profile.industry, data.ai_profile.usp, data.ai_profile.targetPersona, data.ai_profile.toneOfVoice, data.image
        ];
        break;
      
      case 'calendars':
        query = 'INSERT INTO calendars (profile_name, plan) VALUES (?, ?)';
        values = [data.profileName, JSON.stringify(data.plan)];
        break;
      
      case 'captions':
        query = 'INSERT INTO captions (description, captions, image) VALUES (?, ?, ?)';
        values = [data.desc, JSON.stringify(data.captions), data.image];
        break;

      case 'ideas':
        query = 'INSERT INTO festival_ideas (festival_name, industry, idea) VALUES (?, ?, ?)';
        values = [data.festivalName, data.industry, data.idea];
        break;

      case 'insights':
        query = 'INSERT INTO insights (metrics, insight) VALUES (?, ?)';
        values = [JSON.stringify(data.metrics), data.insight];
        break;

      default:
        return res.status(400).json({ error: 'Invalid collection' });
    }

    const [result] = await pool.query(query, values);
    console.log(`Successfully saved to ${collection}, ID: ${result.insertId}`);
    res.json({ id: result.insertId, status: 'success' });
  } catch (err) {
    console.error(`POST Error on /api/${collection}:`, err);
    res.status(500).json({ 
      error: 'Database error', 
      message: err.message,
      code: err.code 
    });
  }
});

app.get('/api/:collection', async (req, res) => {
  const { collection } = req.params;
  
  // Map internal collection names to table names
  const tableMap = {
    'profiles': 'profiles',
    'calendars': 'calendars',
    'captions': 'captions',
    'ideas': 'festival_ideas',
    'insights': 'insights'
  };

  const tableName = tableMap[collection];
  if (!tableName) return res.status(400).json({ error: 'Invalid collection' });

  try {
    const query = `SELECT * FROM ${tableName} ORDER BY created_at DESC`;
    const [rows] = await pool.query(query);
    
    // Auto-parse JSON columns
    const formattedRows = rows.map(row => {
      if (row.plan && typeof row.plan === 'string') row.plan = JSON.parse(row.plan);
      if (row.captions && typeof row.captions === 'string') row.captions = JSON.parse(row.captions);
      if (row.metrics && typeof row.metrics === 'string') row.metrics = JSON.parse(row.metrics);
      return row;
    });

    res.json(formattedRows);
  } catch (err) {
    console.error('GET Error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

app.use(express.static(path.join(__dirname, '../')));
app.use(express.static(path.join(__dirname, '../public')));

// Fallback to serve index.html for any other routes (for SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

