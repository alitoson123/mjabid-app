const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath = path.join(__dirname, 'www', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// Regex to match script tags that do not have a src attribute (internal script)
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let scriptIndex = 1;
let hasErrors = false;

while ((match = scriptRegex.exec(html)) !== null) {
  const scriptContent = match[1].trim();
  // Skip external scripts
  if (match[0].includes(' src=')) {
    continue;
  }

  if (scriptContent.length === 0) continue;

  console.log(`Checking script block #${scriptIndex}...`);
  try {
    new vm.Script(scriptContent);
    console.log(`Script block #${scriptIndex} is syntactically correct.`);
  } catch (err) {
    hasErrors = true;
    console.error(`Syntax error in script block #${scriptIndex}:`);
    console.error(err.message);
    // Print lines around error
    const lines = scriptContent.split('\n');
    const stackLines = err.stack.split('\n');
    const lineMatch = stackLines[0].match(/evalmachine\.<anonymous>:(\d+)/) || stackLines[1].match(/evalmachine\.<anonymous>:(\d+)/);
    if (lineMatch) {
      const errorLine = parseInt(lineMatch[1], 10);
      console.error(`Error around line ${errorLine} of the script block:`);
      const start = Math.max(0, errorLine - 5);
      const end = Math.min(lines.length - 1, errorLine + 5);
      for (let i = start; i <= end; i++) {
        const prefix = (i + 1) === errorLine ? '>>> ' : '    ';
        console.error(`${prefix}${i + 1}: ${lines[i]}`);
      }
    }
  }
  scriptIndex++;
}

if (!hasErrors) {
  console.log('No syntax errors found in any script block!');
}
