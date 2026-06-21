const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

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
    const bucket = new GridFSBucket(db);
    const filename = process.argv[2] || 'intro_Философские принципы и концепты';

    const downloadStream = bucket.openDownloadStreamByName(filename);
    const chunks = [];
    downloadStream.on('data', (c)=>chunks.push(c));
    downloadStream.on('error', (err)=>{ console.error('error', err); process.exit(2); });
    downloadStream.on('end', ()=>{
      const buf = Buffer.concat(chunks);
      const text = buf.toString('utf8');
      console.log('=== START FILE PREVIEW ===');
      console.log(text.slice(0,1000));
      console.log('=== END PREVIEW ===');
      process.exit(0);
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
