const fs = require('fs');
const path = require('path');

// Read package.json
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')
);

// Get all dependencies
const dependencies = packageJson.dependencies || {};

// Generate credits markdown
function generateCredits() {
  let credits = '## Credits\n\n';
  credits += 'This project is built with the following open-source packages:\n\n';
  
  // Sort dependencies alphabetically
  const sortedDeps = Object.keys(dependencies).sort();
  
  credits += '### Dependencies\n\n';
  credits += '| Package | Version |\n';
  credits += '|---------|----------|\n';
  
  sortedDeps.forEach(dep => {
    const version = dependencies[dep];
    // Create npm package link
    const npmLink = `https://www.npmjs.com/package/${dep}`;
    credits += `| [${dep}](${npmLink}) | ${version} |\n`;
  });
  
  credits += '\n';
  credits += '---\n\n';
  credits += '*This credits section is automatically generated. Last updated: ' + 
    new Date().toISOString().split('T')[0] + '*\n';
  
  return credits;
}

// Read current readme
const readmePath = path.join(__dirname, '../readme.md');
let readme = fs.readFileSync(readmePath, 'utf8');

// Find and replace credits section
const creditsMarkerStart = '## Credits';
const creditsMarkerEnd = '---\n\n*This credits section is automatically generated';

const startIndex = readme.indexOf(creditsMarkerStart);

if (startIndex === -1) {
  console.log('Credits section not found in readme.md');
  process.exit(1);
}

// Find the end of the auto-generated section or end of file
let endIndex = readme.indexOf('## ', startIndex + creditsMarkerStart.length);
if (endIndex === -1) {
  endIndex = readme.length;
}

// Check if there's an existing auto-generated section
const autoGenMarkerIndex = readme.indexOf(creditsMarkerEnd, startIndex);
if (autoGenMarkerIndex !== -1 && autoGenMarkerIndex < endIndex) {
  // Find the actual end (after the timestamp line)
  const lineEnd = readme.indexOf('\n', autoGenMarkerIndex + creditsMarkerEnd.length);
  endIndex = lineEnd !== -1 ? lineEnd + 1 : readme.length;
}

// Replace the section
const newReadme = readme.substring(0, startIndex) + 
                 generateCredits() + 
                 readme.substring(endIndex);

// Write back to file
fs.writeFileSync(readmePath, newReadme, 'utf8');

console.log('✓ Credits section updated successfully!');
console.log(`✓ Added ${Object.keys(dependencies).length} dependencies to credits`);
