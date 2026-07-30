const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'src', 'screens');
const files = fs.readdirSync(screensDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const filePath = path.join(screensDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace navigation.goBack() with the safe version
  // Only replace if it's not already wrapped
  if (content.includes('navigation.goBack()') && !content.includes('navigation.canGoBack() ? navigation.goBack() : navigation.navigate(')) {
    content = content.replace(/navigation\.goBack\(\)/g, "(navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))");
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
console.log('Done.');
