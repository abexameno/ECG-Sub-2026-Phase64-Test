const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const workDir = process.cwd();
const sandbox = "/tmp/repo_sandbox";

// Clean sandbox
if (fs.existsSync(sandbox)) fs.rmSync(sandbox, { recursive: true, force: true });
fs.mkdirSync(sandbox, { recursive: true });

// Copy current files
const serverCurr = fs.readFileSync(path.join(workDir, "server.ts"), "utf8");
const panelCurr = fs.readFileSync(path.join(workDir, "components/SchoolManagementPanel.tsx"), "utf8");
const testCurr = fs.readFileSync(path.join(workDir, "schoolAdminExportLogs.test.ts"), "utf8");

// Reconstruct baseline server.ts
const endpointMarker = "  // --- SCHOOL ADMIN PORTFOLIO EXPORT LOGS ENDPOINT ---";
const viteMarker = "  // --- Vite Middleware ---";

let serverBase = serverCurr;
const idx1 = serverCurr.indexOf(endpointMarker);
const idx2 = serverCurr.indexOf(viteMarker);
if (idx1 !== -1 && idx2 !== -1 && idx1 < idx2) {
  serverBase = serverCurr.slice(0, idx1) + "\n" + serverCurr.slice(idx2);
} else {
  console.error("Could not locate endpoint markers in server.ts");
}

// Reconstruct baseline components/SchoolManagementPanel.tsx
let panelBase = panelCurr;

// 1. Remove import auth
panelBase = panelBase.replace("import { auth } from '../firebase.ts';\n", "");

// 2. Remove extra lucide imports
panelBase = panelBase.replace(",\n  FileText,\n  Loader2,\n  AlertCircle", "");

// 3. Revert activeTab type
panelBase = panelBase.replace("<'all' | 'duplicates' | 'coverage' | 'export_logs'>", "<'all' | 'duplicates' | 'coverage'>");

// 4. Remove Export Logs State block
const stateMarkerStart = "  // Export Logs State\n";
const stateMarkerEnd = "  // Modals\n";
const sIdx1 = panelBase.indexOf(stateMarkerStart);
const sIdx2 = panelBase.indexOf(stateMarkerEnd);
if (sIdx1 !== -1 && sIdx2 !== -1 && sIdx1 < sIdx2) {
  panelBase = panelBase.slice(0, sIdx1) + panelBase.slice(sIdx2);
} else {
  console.error("Could not locate state markers in panel");
}

// 5. Remove Export Logs tab button
const btnMarker = `          <button
            onClick={() => setActiveTab('export_logs')}
            className={\`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer \${
              activeTab === 'export_logs' ? 'bg-[#3b1464] text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }\`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export Logs</span>
          </button>\n\n`;
panelBase = panelBase.replace(btnMarker, "");

// 6. Remove Export Logs View block
const viewMarkerStart = "      {/* VIEW: PORTFOLIO EXPORT AUDIT LOGS */}\n";
const viewMarkerEnd = "      {/* MODAL / DRAWER: CUSTOM ECG PWA FILTER SELECTOR */}\n";
const vIdx1 = panelBase.indexOf(viewMarkerStart);
const vIdx2 = panelBase.indexOf(viewMarkerEnd);
if (vIdx1 !== -1 && vIdx2 !== -1 && vIdx1 < vIdx2) {
  panelBase = panelBase.slice(0, vIdx1) + panelBase.slice(vIdx2);
} else {
  console.error("Could not locate view markers in panel");
}

// Set up git repo in sandbox
fs.mkdirSync(path.join(sandbox, "components"), { recursive: true });
fs.writeFileSync(path.join(sandbox, "server.ts"), serverBase);
fs.writeFileSync(path.join(sandbox, "components/SchoolManagementPanel.tsx"), panelBase);

execSync("git init", { cwd: sandbox });
execSync("git config user.name 'Audit Sandbox'", { cwd: sandbox });
execSync("git config user.email 'audit@example.com'", { cwd: sandbox });
execSync("git add .", { cwd: sandbox });
execSync("git commit -m 'Baseline 2aeb534'", { cwd: sandbox });

// Copy current Phase 20.1D modified files
fs.writeFileSync(path.join(sandbox, "server.ts"), serverCurr);
fs.writeFileSync(path.join(sandbox, "components/SchoolManagementPanel.tsx"), panelCurr);
fs.writeFileSync(path.join(sandbox, "schoolAdminExportLogs.test.ts"), testCurr);

// Stage new untracked file so git diff includes it or use git add -N
execSync("git add -N schoolAdminExportLogs.test.ts", { cwd: sandbox });

// Generate unified diff patch
const patchContent = execSync("git diff", { cwd: sandbox }).toString();
const patchPath = path.join(workDir, "phase-20.1D-school-admin-export-logs.patch");
fs.writeFileSync(patchPath, patchContent);

console.log("Patch generated. Size:", fs.statSync(patchPath).size, "bytes");

// Test git apply --check in sandbox
execSync("git reset --hard HEAD", { cwd: sandbox });
// Remove untracked file before test apply
if (fs.existsSync(path.join(sandbox, "schoolAdminExportLogs.test.ts"))) {
  fs.unlinkSync(path.join(sandbox, "schoolAdminExportLogs.test.ts"));
}

try {
  execSync("git apply --check " + patchPath, { cwd: sandbox });
  console.log("git apply --check validation: PASS");
  
  // Also perform actual git apply in sandbox to be 100% sure!
  execSync("git apply " + patchPath, { cwd: sandbox });
  console.log("git apply actual application: PASS");
} catch (err) {
  console.error("git apply --check validation: FAILED", err.message);
}
