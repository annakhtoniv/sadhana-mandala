const ftp = require('basic-ftp');
const path = require('path');
const fs = require('fs');

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

function cleanHost(h) {
  if (!h) return '';
  return h.trim().replace(/^https?:\/\/|^ftp:\/\//i, '').replace(/:[0-9]+$/, '').split('/')[0].trim();
}

async function deploy() {
  const rawHost = process.env.FTP_SERVER || '';
  const rawUser = process.env.FTP_USERNAME || '';
  const rawPass = process.env.FTP_PASSWORD || '';
  const configuredDir = process.env.FTP_SERVER_DIR || '';

  logSummary('## 🚀 Spaceship FTP Deployment Report');

  if (!rawUser || !rawPass) {
    logSummary(`❌ **Error**: FTP credentials missing! \`FTP_USERNAME\`: ${rawUser ? '✅ Present' : '❌ MISSING'}, \`FTP_PASSWORD\`: ${rawPass ? '✅ Present' : '❌ MISSING'}`);
    process.exit(1);
  }

  const distDir = path.resolve(__dirname, '../dist');
  if (!fs.existsSync(distDir) || !fs.existsSync(path.join(distDir, 'index.html'))) {
    logSummary('❌ **Error**: dist/ directory does not exist or has no index.html. Run npm run build first.');
    process.exit(1);
  }

  // Generate cleaned hosts
  const hostCandidates = [
    cleanHost(rawHost),
    'server60-1.shared.spaceship.host',
    'sadhana.zyxenai.com',
    '66.29.148.114',
  ].filter(Boolean);
  const uniqueHosts = [...new Set(hostCandidates)];

  // Generate cleaned passwords
  const passwordCandidates = [rawPass, rawPass.trim()].filter((p, idx, arr) => arr.indexOf(p) === idx);

  // Generate username candidates (handles cPanel user vs user@domain format)
  const trimmedUser = rawUser.trim();
  const userCandidates = [];
  if (trimmedUser.includes('@')) {
    const [uName, uDomain] = trimmedUser.split('@');
    userCandidates.push(trimmedUser);
    userCandidates.push(uName);
    userCandidates.push(`${uName}@zyxenai.com`);
    userCandidates.push(`${uName}@sadhana.zyxenai.com`);
  } else {
    userCandidates.push(trimmedUser);
    userCandidates.push(`${trimmedUser}@zyxenai.com`);
    userCandidates.push(`${trimmedUser}@sadhana.zyxenai.com`);
  }
  const uniqueUsers = [...new Set(userCandidates)];

  logSummary(`📋 Diagnostics: Hosts: [${uniqueHosts.join(', ')}], Users to try: ${uniqueUsers.length}, Pass length: ${rawPass.length}`);

  let connectedClient = null;
  let connectedHost = null;
  let successfulUser = null;

  hostLoop: for (const host of uniqueHosts) {
    for (const user of uniqueUsers) {
      for (const password of passwordCandidates) {
        logSummary(`\n🔍 Trying host: \`${host}\` with user pattern: \`${user.includes('@') ? user.split('@')[0] + '@' + user.split('@')[1] : user}\`...`);

        // Strategy 1: Explicit FTPS on Port 21 (Spaceship standard)
        try {
          console.log(`📡 Strategy 1: Explicit FTPS on ${host}:21...`);
          const client = new ftp.Client(30000);
          client.ftp.verbose = true;
          await client.access({
            host,
            user,
            password,
            port: 21,
            secure: true,
            secureOptions: { rejectUnauthorized: false },
          });
          logSummary(`✅ Successfully authenticated on \`${host}\` via **Explicit FTPS**!`);
          connectedClient = client;
          connectedHost = host;
          successfulUser = user;
          break hostLoop;
        } catch (err) {
          console.warn(`⚠️ Strategy 1 (FTPS) failed on ${host}: ${err.message}`);
          if (err.message && err.message.includes('530')) {
            // Authentication failed with this user/pass combination, continue to next
            continue;
          }
        }

        // Strategy 2: Plain FTP on Port 21
        try {
          console.log(`📡 Strategy 2: Plain FTP on ${host}:21...`);
          const client = new ftp.Client(30000);
          client.ftp.verbose = true;
          await client.access({
            host,
            user,
            password,
            port: 21,
            secure: false,
          });
          logSummary(`✅ Successfully authenticated on \`${host}\` via **Standard FTP**!`);
          connectedClient = client;
          connectedHost = host;
          successfulUser = user;
          break hostLoop;
        } catch (err) {
          console.warn(`⚠️ Strategy 2 (FTP) failed on ${host}: ${err.message}`);
        }
      }
    }
  }

  if (!connectedClient) {
    logSummary('❌ **Failed**: Could not authenticate to Spaceship with any host/user/security combination.');
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
