const ftp = require('basic-ftp');
const path = require('path');
const fs = require('fs');

async function deploy() {
  const host = process.env.FTP_SERVER || 'server60-1.shared.spaceship.host';
  const user = process.env.FTP_USERNAME;
  const password = process.env.FTP_PASSWORD;
  const configuredDir = process.env.FTP_SERVER_DIR || '';

  if (!user || !password) {
    console.error('❌ Error: FTP_USERNAME or FTP_PASSWORD environment variables are missing.');
    process.exit(1);
  }

  const distDir = path.resolve(__dirname, '../dist');
  if (!fs.existsSync(distDir) || !fs.existsSync(path.join(distDir, 'index.html'))) {
    console.error('❌ Error: dist/ directory does not exist or has no index.html. Run npm run build first.');
    process.exit(1);
  }

  console.log(`🚀 Starting FTP Deployment to ${host}...`);
  console.log(`📁 Local directory: ${distDir}`);
  console.log(`👤 Username: ${user}`);
  if (configuredDir) console.log(`📂 Configured target dir: ${configuredDir}`);

  const client = new ftp.Client(60000); // 60s timeout
  client.ftp.verbose = true;

  let connected = false;

  // Try 1: FTPS with self-signed certificate acceptance
  try {
    console.log('📡 Attempting FTPS connection (secure with relaxed SSL validation)...');
    await client.access({
      host,
      user,
      password,
      port: 21,
      secure: 'implicit' ? false : true, // explicit TLS on port 21
      secureOptions: {
        rejectUnauthorized: false,
      },
    });
    console.log('✅ Connected via FTPS successfully!');
    connected = true;
  } catch (err) {
    console.warn(`⚠️ FTPS connection note: ${err.message}. Trying plain FTP...`);
    client.close();
  }

  // Try 2: Plain FTP fallback if FTPS refused
  if (!connected) {
    try {
      console.log('📡 Attempting plain FTP connection on port 21...');
      const plainClient = new ftp.Client(60000);
      plainClient.ftp.verbose = true;
      await plainClient.access({
        host,
        user,
        password,
        port: 21,
        secure: false,
      });
      console.log('✅ Connected via standard FTP successfully!');
      // replace client reference
      Object.assign(client, plainClient);
      connected = true;
    } catch (err) {
      console.error(`❌ Standard FTP connection also failed: ${err.message}`);
      process.exit(1);
    }
  }

  try {
    // Current remote working directory
    const pwd = await client.pwd();
    console.log(`📍 Initial remote working directory: ${pwd}`);

    // List contents to inspect remote directory layout
    const list = await client.list();
    console.log(`📋 Remote directory listing (${list.length} items):`);
    list.forEach(item => console.log(`   - [${item.isDirectory ? 'DIR' : 'FILE'}] ${item.name}`));

    // Determine target directory
    let targetDir = configuredDir.trim();

    if (targetDir && targetDir !== '/') {
      console.log(`Navigating to configured target directory: "${targetDir}"...`);
      await client.ensureDir(targetDir);
    } else {
      // Auto-detect web root if not explicitly pinned
      const names = list.map(i => i.name.toLowerCase());
      if (names.includes('public_html')) {
        console.log('Detected "public_html" directory. Checking subfolders...');
        await client.cd('public_html');
        const pubList = await client.list();
        const pubNames = pubList.map(i => i.name.toLowerCase());
        if (pubNames.includes('sadhana.zyxenai.com')) {
          console.log('Entering "public_html/sadhana.zyxenai.com"...');
          await client.cd('sadhana.zyxenai.com');
        } else {
          console.log('Deploying directly into "public_html"...');
        }
      } else if (names.includes('sadhana.zyxenai.com')) {
        console.log('Entering "sadhana.zyxenai.com"...');
        await client.cd('sadhana.zyxenai.com');
      } else {
        console.log('Deploying into current root directory...');
      }
    }

    const finalPwd = await client.pwd();
    console.log(`🎯 Destination upload directory: ${finalPwd}`);

    // Upload dist directory
    console.log('📦 Uploading built files to remote server...');
    await client.uploadFromDir(distDir);

    console.log('🎉 Upload completed successfully!');

    // Verify index.html on remote server
    const remoteCheck = await client.list();
    const remoteIndex = remoteCheck.find(f => f.name === 'index.html');
    if (remoteIndex) {
      console.log(`✅ Verified remote index.html exists (${remoteIndex.size} bytes, modified: ${remoteIndex.rawModifiedAt})`);
    }

  } catch (err) {
    console.error('❌ Error during file upload:', err);
    process.exit(1);
  } finally {
    client.close();
  }
}

deploy();
