const fs = require('fs');
const path = require('path');

const paths = [
  {
    src: 'node_modules/@capacitor-community/admob/dist/plugin.js',
    dest: 'www/admob-plugin.js'
  },
  {
    src: 'node_modules/@capacitor-firebase/authentication/dist/plugin.js',
    dest: 'www/firebase-auth-plugin.js'
  }
];

paths.forEach(({ src, dest }) => {
  const srcPath = path.resolve(__dirname, src);
  const destPath = path.resolve(__dirname, dest);

  if (fs.existsSync(srcPath)) {
    // Ensure the dest directory exists
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(srcPath, destPath);
    console.log(`[Capacitor Plugin Copy] Successfully copied ${src} to ${dest}`);
  } else {
    console.warn(`[Capacitor Plugin Copy] Warning: Source file not found: ${srcPath}. (Make sure you ran npm install first)`);
  }
});
