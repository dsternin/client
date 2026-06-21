const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let [, key, val] = m;
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[key] = val;
  }
  return env;
}

(async function main(){
  try {
    const repoRoot = path.resolve(__dirname, '..');
    const env = parseEnv(path.join(repoRoot, '.env'));
    const MONGO_URL = env.MONGO_URL || process.env.MONGO_URL;
    if (!MONGO_URL) {
      console.error('Missing MONGO_URL');
      process.exit(1);
    }
    const conn = await mongoose.connect(MONGO_URL, { bufferCommands:false });
    const db = conn.connection.db;
    const files = await db.collection('fs.files').find({ filename: { $regex: '^intro_' } }).toArray();
    console.log(files.map(f => ({ filename: f.filename, length: f.length, uploadDate: f.uploadDate })).slice(0,50));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
