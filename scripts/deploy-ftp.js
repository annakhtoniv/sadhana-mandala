import * as ftp from 'basic-ftp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function logSummary(msg) {
  console.log(msg);
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, msg + '\n');
    } catch {
      // ignore
    }
  }
}

async function deploy() {
  const envHost = process.env.FTP_SERVER;
  const user = process.env.FTP_USERNAME;
  const password = process.env.FTP_PASSWORD;
  const configuredDir = process.env.FTP_SERVER_DIR || '';

  logSummary('## 🚀 Spaceship FTP Deployment Report');

  if (!user || !password) {
    logSummary(`❌ **Error**: FTP credentials missing! \`FTP_USERNAME\`: ${user ? '✅ Present' : '❌ MISSING'}, \`FTP_PASSWORD\`: ${password ? '✅ Present' : '❌ MISSING'}`);
    process.exit(1);
  }

  const distDir = path.resolve(__dirname, '../dist');
  if (!fs.existsSync(distDir) || !fs.existsSync(path.join(distDir, 'index.html'))) {
    logSummary('❌ **Error**: dist/ directory does not exist or has no index.html. Run npm run build first.');
    process.exit(1);
  }

  const hostsToTry = [
    envHost,
    'server60-1.shared.spaceship.host',
    '66.29.148.114',
    'sadhana.zyxenai.com',
  ].filter(Boolean);

  const uniqueHosts = [...new Set(hostsToTry)];

  let connectedClient = null;
  let connectedHost = null;

  for (const host of uniqueHosts) {
    logSummary(`### Connecting to host: \`${host}\`...`);

    // Strategy 1: Explicit FTPS on Port 21 (Spaceship default)
    try {
      console.log(`📡 Strategy 1: Explicit FTPS (AUTH TLS) on ${host}:21...`);
      const client = new ftp.Client(60000);
      client.ftp.verbose = true;
      await client.access({
        host,
        user,
        password,
        port: 21,
        secure: true,
        secureOptions: { rejectUnauthorized: false },
      });
      logSummary(`✅ Connected to \`${host}\` via **Explicit FTPS (TLS)** successfully!`);
      connectedClient = client;
      connectedHost = host;
      break;
    } catch (err) {
      console.warn(`⚠️ Strategy 1 (FTPS:21) on ${host} failed: ${err.message}`);
    }

    // Strategy 2: Standard Plain FTP on Port 21
    try {
      console.log(`📡 Strategy 2: Plain standard FTP on ${host}:21...`);
      const client = new ftp.Client(60000);
      client.ftp.verbose = true;
      await client.access({
        host,
        user,
        password,
        port: 21,
        secure: false,
      });
      logSummary(`✅ Connected to \`${host}\` via **Standard FTP** successfully!`);
      connectedClient = client;
      connectedHost = host;
      break;
    } catch (err) {
      console.warn(`⚠️ Strategy 2 (FTP:21) on ${host} failed: ${err.message}`);
    }

    // Strategy 3: Implicit FTPS on Port 990
    try {
      console.log(`📡 Strategy 3: Implicit FTPS on ${host}:990...`);
      const client = new ftp.Client(60000);
      client.ftp.verbose = true;
      await client.access({
        host,
        user,
        password,
        port: 990,
        secure: 'implicit',
        secureOptions: { rejectUnauthorized: false },
      });
      logSummary(`✅ Connected to \`${host}\` via **Implicit FTPS (Port 990)** successfully!`);
      connectedClient = client;
      connectedHost = host;
      break;
    } catch (err) {
      console.warn(`⚠️ Strategy 3 (FTPS:990) on ${host} failed: ${err.message}`);
    }
  }

  if (!connectedClient) {
    logSummary('❌ **Failed**: Could not connect to any Spaceship FTP endpoint with the provided credentials.');
    process.exit(1);
  }

  const client = connectedClient;

  try {
    const pwd = await client.pwd();
    logSummary(`📍 **Initial remote directory**: \`${pwd}\``);

    const list = await client.list();
    console.log(`📋 Directory items (${list.length}):`, list.map(i => i.name));

    let targetDir = configuredDir.trim();

    if (targetDir && targetDir !== '/' && targetDir !== '.') {
      console.log(`Navigating to configured target directory: "${targetDir}"...`);
      await client.ensureDir(targetDir);
    } else {
      // Smart discovery
      const names = list.map(i => i.name.toLowerCase());
      if (names.includes('sadhana.zyxenai.com')) {
        await client.cd('sadhana.zyxenai.com');
      } else if (names.includes('public_html')) {
        await client.cd('public_html');
        const pubList = await client.list();
        const pubNames = pubList.map(i => i.name.toLowerCase());
        if (pubNames.includes('sadhana.zyxenai.com')) {
          await client.cd('sadhana.zyxenai.com');
        }
      }
    }

    const finalPwd = await client.pwd();
    logSummary(`🎯 **Deploying into destination directory**: \`${finalPwd}\``);

    console.log('📦 Uploading built files from dist/ ...');
    await client.uploadFromDir(distDir);

    const remoteCheck = await client.list();
    const remoteIndex = remoteCheck.find(f => f.name === 'index.html');
    if (remoteIndex) {
      logSummary(`🎉 **Deployment Success!** \`index.html\` verified live on Spaceship (${remoteIndex.size} bytes).`);
    } else {
      logSummary('🎉 Files uploaded successfully!');
    }

  } catch (err) {
    logSummary(`❌ **Error during file upload**: ${err.message}`);
    process.exit(1);
  } finally {
    client.close();
  }
}

deploy();
