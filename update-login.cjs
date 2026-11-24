const fs = require('fs');
let code = fs.readFileSync('components/LoginScreen.tsx', 'utf8');

// There are multiple instances of the logo in LoginScreen possibly, let's just do a regex that catches them.
// But wait, the SVG code is slightly different in the first place, or maybe not.
// Let's use a simpler approach.

code = code.replace(
  /<div className="flex justify-center mb-4">[\s\S]*?<\/svg>[\s\S]*?<\/div>\s*<h1 className="text-xl font-bold text-gray-900">Exameno CBC Content Generator \(ECG\)<\/h1>/,
  `<div className="flex justify-center mb-6">\n      <ExamenoLogo className="h-24 w-auto" />\n     </div>`
);
fs.writeFileSync('components/LoginScreen.tsx', code);
