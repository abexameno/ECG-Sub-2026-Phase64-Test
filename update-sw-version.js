import fs from 'fs';
import path from 'path';

const swPath = path.join(process.cwd(), 'dist', 'sw.js');
if (fs.existsSync(swPath)) {
  let content = fs.readFileSync(swPath, 'utf8');
  const timestamp = Date.now();
  
  // Replace CACHE_NAME definition with a dynamic, timestamp-based name
  const updatedContent = content.replace(
    /const CACHE_NAME = ['"][^'"]+['"];/,
    `const CACHE_NAME = 'exameno-ecg-${timestamp}';`
  );
  
  fs.writeFileSync(swPath, updatedContent, 'utf8');
  console.log(`Service Worker cache name successfully updated to: exameno-ecg-${timestamp}`);
} else {
  console.error('dist/sw.js not found! Service Worker cache name was not updated.');
}
