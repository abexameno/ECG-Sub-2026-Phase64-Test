const fs = require('fs');
let code = fs.readFileSync('components/LoginScreen.tsx', 'utf8');
code = code.replace(
  /<div className="flex justify-center mb-4">\s*<svg.*?<\/svg>\s*<\/div>\s*<h1 className="text-xl font-bold text-gray-900">Exameno CBC Content Generator \(ECG\)<\/h1>/,
  `<div className="flex justify-center mb-6">\n      <ExamenoLogo className="h-24 w-auto" />\n     </div>`
);
fs.writeFileSync('components/LoginScreen.tsx', code);
