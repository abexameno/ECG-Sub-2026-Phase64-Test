import admin from 'firebase-admin';
import rawConfig from './firebase-applet-config.json' with { type: 'json' };
import { CanonicalCurriculumService } from './services/canonicalCurriculumService.ts';
import { ContentType } from './types.ts';
import fs from 'fs';

const firebaseConfig = rawConfig as any;

if (!admin.apps.length) {
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountEnv) {
    try {
      let serviceAccount;
      const trimmedEnv = serviceAccountEnv.trim();
      if (!trimmedEnv.startsWith('{')) {
        const decoded = Buffer.from(trimmedEnv, 'base64').toString('utf8');
        serviceAccount = JSON.parse(decoded);
      } else {
        serviceAccount = JSON.parse(trimmedEnv);
      }
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: firebaseConfig.projectId
      });
    } catch (e) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: firebaseConfig.projectId
      });
    }
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: firebaseConfig.projectId
    });
  }
}

async function getAuthToken(): Promise<string> {
  const user = await admin.auth().getUserByEmail('abexameno@gmail.com');
  const customToken = await admin.auth().createCustomToken(user.uid);
  
  const apiKey = firebaseConfig.apiKey;
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  
  const data = await res.json();
  return data.idToken;
}

async function runLessonPlanAcceptance() {
  console.log("=== STARTING PHASE 3C: LESSON PLAN ACCEPTANCE TEST ===");
  const grade = 'Grade 3';
  const subject = 'CRE';
  const topic = 'Self-care';
  const selectedWeeks = ['1'];
  const term = 'Term 1';

  // 1. Resolve Canonical Nodes for Week 1
  const canonicalNodes = CanonicalCurriculumService.resolveCanonicalSowNodes(
    grade,
    subject,
    [term]
  );
  const nodesForWeek1 = canonicalNodes.filter(n => selectedWeeks.includes(String(n.week)));

  console.log(`Resolved ${nodesForWeek1.length} Canonical Nodes for Week 1.`);
  nodesForWeek1.forEach(n => {
    console.log(` - Lesson ${n.lesson}: Strand="${n.strandTitle}", Sub-Strand="${n.subStrandTitle}"`);
  });

  if (nodesForWeek1.length === 0) {
    throw new Error("No curriculum nodes found for the test week.");
  }

  // 2. Obtain Auth Token
  const token = await getAuthToken();
  console.log("Obtained Auth Token.");

  // 3. Build Generation Request
  const payload = {
    prompt: `Generate comprehensive Lesson Plans for ${grade} ${subject} Week 1. Topic: ${topic}`, // This is simplified as the server logic handles the complex prompt building
    model: 'gemini-3.8-flash',
    contentType: ContentType.LessonPlan,
    config: {
        systemInstruction: "You are an expert curriculum developer...",
        responseMimeType: 'application/json',
        responseSchema: {
            type: "OBJECT",
            properties: {
                body: { type: "STRING" }
            },
            required: ["body"]
        }
    },
    // We simulate the FormState parameters that would be passed if we were calling the frontend proxy
    // But since we are calling /api/generate directly, we need to match what generateTextContent expects
    // Wait, generateTextContent is CLIENT SIDE (geminiService.ts). The server endpoint /api/generate 
    // takes a raw prompt. 
    // Let's re-verify how the frontend calls the backend.
  };

  // Re-checking server.ts for /api/generate handling
  // It takes { prompt, model, config, contentType, operationId, totalChunks }
  // And calls ai.models.generateContent({ model, contents: prompt, config })

  // So we need to provide the FULL PROMPT that geminiService.ts would have generated.
  
  const prompt = `**CRITICAL INSTRUCTION:** The entire output must be formatted using professional Markdown. Use headings (#, ##, ###), lists (* or - or 1.), and bold text (**) for structure and emphasis. Adhere to the following structure precisely.

        **LOCKED CANONICAL CURRICULUM NODES (CRITICAL - PRESERVE EXACTLY):**
        ${nodesForWeek1.map(n => `- Week ${n.week}, Lesson ${n.lesson} | Strand: ${n.strandTitle} | Sub-Strand: ${n.subStrandTitle} | Outcomes: ${n.learningOutcomesText.replace(/\n/g, ' ')}`).join('\n')}

        You must generate a comprehensive set of Lesson Plans for the following weeks: ${selectedWeeks.join(', ')}.
        For each selected week, you must generate all lessons taught in that week based strictly on the nodes above (e.g. Lesson 1, Lesson 2, Lesson 3, etc. for that week).
        Repeat the following structure for EVERY single lesson generated in the document.

# ${subject} - Grade ${grade} - Lesson Plans

## Week [Insert Week Number] - Lesson [Insert Lesson Number]: [AI: Generate an engaging lesson title based on the topic below]

**Topic: ${topic} (Curriculum Design)**

### Specific Learning Outcomes
*AI: Generate 3-5 SMART learning outcomes for a 40-minute lesson.*

### Key Inquiry Questions
*AI: Formulate 2-3 thought-provoking questions.*

### Learning Resources
*AI: List all necessary resources.*

### Introduction (5 Minutes)
*AI: Describe an engaging introduction.*

### Lesson Development
*AI: Provide step-by-step instructions.*

### Conclusion (5 Minutes)
*AI: Summarize the lesson.*

### Assessment
*AI: Generate 3-4 assessment questions.*
`;

  const finalPayload = {
    prompt,
    model: 'gemini-3.8-flash',
    contentType: ContentType.LessonPlan,
    config: {
        systemInstruction: "You are an expert curriculum developer creating a professional Lesson Plan for the Kenyan CBC.",
        responseMimeType: 'application/json',
        responseSchema: {
            type: "OBJECT",
            properties: {
                body: { type: "STRING" }
            },
            required: ["body"]
        }
    }
  };

  console.log("Submitting Generation Request to /api/generate...");
  const startTime = Date.now();
  const apiRes = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(finalPayload)
  });

  if (!apiRes.ok) {
    const err = await apiRes.text();
    throw new Error(`API Error: ${apiRes.status} - ${err}`);
  }

  const data = await apiRes.json();
  const duration = (Date.now() - startTime) / 1000;
  console.log(`Request Succeeded in ${duration.toFixed(2)}s`);

  const result = data.result;
  let body = "";
  if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const text = result.candidates[0].content.parts[0].text;
      const parsed = JSON.parse(text);
      body = parsed.body;
  }

  console.log("\n=== GENERATED CONTENT PREVIEW (START) ===");
  console.log(body.substring(0, 500) + "...");
  console.log("=== GENERATED CONTENT PREVIEW (END) ===\n");

  // Verification
  const requiredSections = [
    "Specific Learning Outcomes",
    "Key Inquiry Questions",
    "Learning Resources",
    "Introduction",
    "Lesson Development",
    "Conclusion",
    "Assessment"
  ];

  const missingSections = requiredSections.filter(s => !body.includes(s));
  const hasTitle = body.includes(`# ${subject} - Grade ${grade} - Lesson Plans`);
  const hasWeekInfo = body.includes("Week 1");
  const hasCanonicalSubStrand = body.includes("Self-care");

  console.log("Acceptance Verification:");
  console.log(`- Required Sections Present: ${missingSections.length === 0 ? "YES" : "NO (Missing: " + missingSections.join(", ") + ")"}`);
  console.log(`- Title Correct: ${hasTitle ? "YES" : "NO"}`);
  console.log(`- Week 1 Mentioned: ${hasWeekInfo ? "YES" : "NO"}`);
  console.log(`- Canonical Sub-Strand (Self-care) Present: ${hasCanonicalSubStrand ? "YES" : "NO"}`);

  const report = {
    timestamp: new Date().toISOString(),
    status: (missingSections.length === 0 && hasTitle && hasWeekInfo && hasCanonicalSubStrand) ? "PASS" : "FAIL",
    duration,
    missingSections,
    hasTitle,
    hasWeekInfo,
    hasCanonicalSubStrand,
    bodyLength: body.length
  };

  fs.writeFileSync('phase3c_lesson_plan_results.json', JSON.stringify(report, null, 2));
  console.log("\nSaved results to phase3c_lesson_plan_results.json");
  console.log("=== TEST RUN COMPLETE ===");
}

runLessonPlanAcceptance().catch(err => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
