import admin from 'firebase-admin';
import rawConfig from './firebase-applet-config.json' with { type: 'json' };
import { ContentType, QuestionType } from './types.ts';
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

async function runPhase3D() {
  console.log("=== STARTING PHASE 3D: ASSESSMENTS, QUIZZES & ROWC ACCEPTANCE TEST ===");
  const token = await getAuthToken();
  const results: any = {};

  // 1. ASSESSMENT TEST
  console.log("\n--- [1/3] TESTING ASSESSMENT GENERATION ---");
  const assessmentPayload = {
    prompt: `You are an expert assessment designer for the Kenyan CBC. 
    Task: Create a standard assessment for Grade 3 CRE.
    Topic: Self-care (Appreciating oneself as God's creation)
    Difficulty: Intermediate
    Target: 5 questions.
    Structure: Include Bloom's levels.`,
    model: 'gemini-3.8-flash',
    contentType: ContentType.Assessment,
    config: {
      systemInstruction: "You are an expert assessment designer...",
      responseMimeType: 'application/json',
      responseSchema: {
        type: "OBJECT",
        properties: {
          questions: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                questionType: { type: "STRING" },
                questionText: { type: "STRING" },
                correctAnswer: { type: "STRING" },
                explanation: { type: "STRING" },
                bloomsTaxonomyLevel: { type: "STRING" }
              },
              required: ["questionType", "questionText", "correctAnswer", "explanation"]
            }
          }
        },
        required: ["questions"]
      }
    }
  };

  try {
    const res = await fetch('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(assessmentPayload)
    });
    if (!res.ok) throw new Error(`Assessment API Error: ${res.status}`);
    const data = await res.json();
    const result = data.result;
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(text);
    
    const hasQuestions = parsed.questions && parsed.questions.length > 0;
    const hasSelfCare = text.toLowerCase().includes("self") || text.toLowerCase().includes("creation");
    
    results.assessment = {
        status: (hasQuestions && hasSelfCare) ? "PASS" : "FAIL",
        model: data.modelUsed || 'gemini-3.8-flash',
        questionCount: parsed.questions?.length || 0,
        hasCurriculumContext: hasSelfCare
    };
    console.log("Assessment Result:", results.assessment);
  } catch (e: any) {
    results.assessment = { status: "FAIL", error: e.message };
    console.error("Assessment Failed:", e.message);
  }

  // 2. QUIZ TEST
  console.log("\n--- [2/3] TESTING QUIZ GENERATION ---");
  const quizPayload = {
    prompt: `Generate a 5-question MCQ quiz for Grade 3 CRE.
    Topic: Self-care.
    Ensure each question has 4 options (A, B, C, D).`,
    model: 'gemini-3.8-flash',
    contentType: ContentType.Quiz,
    config: {
      systemInstruction: "You are an expert quiz designer...",
      responseMimeType: 'application/json',
      responseSchema: {
        type: "OBJECT",
        properties: {
          questions: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                questionType: { type: "STRING" },
                questionText: { type: "STRING" },
                distractors: { type: "ARRAY", items: { type: "STRING" } },
                correctAnswer: { type: "STRING" },
                explanation: { type: "STRING" }
              },
              required: ["questionType", "questionText", "distractors", "correctAnswer", "explanation"]
            }
          }
        },
        required: ["questions"]
      }
    }
  };

  try {
    const res = await fetch('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(quizPayload)
    });
    if (!res.ok) throw new Error(`Quiz API Error: ${res.status}`);
    const data = await res.json();
    const result = data.result;
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(text);
    
    const hasDistractors = parsed.questions?.every((q: any) => q.distractors && q.distractors.length === 3);
    const hasAnswers = parsed.questions?.every((q: any) => q.correctAnswer);
    
    results.quiz = {
        status: (hasDistractors && hasAnswers) ? "PASS" : "FAIL",
        model: data.modelUsed || 'gemini-3.8-flash',
        questionCount: parsed.questions?.length || 0,
        optionsVerified: hasDistractors
    };
    console.log("Quiz Result:", results.quiz);
  } catch (e: any) {
    results.quiz = { status: "FAIL", error: e.message };
    console.error("Quiz Failed:", e.message);
  }

  // 3. ROWC TEST
  console.log("\n--- [3/3] TESTING ROWC GENERATION ---");
  const rowcPayload = {
    prompt: `You are a reflective teacher completing a Record of Work Covered (ROWC).
    Input Data: [{"date":"2026-10-18","grade":"Grade 3","subject":"CRE","strand":"Creation","subStrand":"Self-care","lessonTitle":"Appreciating myself","learningActivities":"Learners sang and discussed unique body parts","resources":"Bible, Charts","remarks":""}]
    Standardize and elaborate.`,
    model: 'gemini-3.8-flash',
    contentType: ContentType.RecordOfWorkCovered,
    config: {
      systemInstruction: "You are a meticulous teacher...",
      responseMimeType: 'application/json',
      responseSchema: {
        type: "OBJECT",
        properties: {
          weekRange: { type: "STRING" },
          reflection: { type: "STRING" },
          lessons: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                remarks: { type: "STRING" },
                learningActivities: { type: "STRING" }
              }
            }
          }
        },
        required: ["lessons", "weekRange"]
      }
    }
  };

  try {
    const res = await fetch('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(rowcPayload)
    });
    if (!res.ok) throw new Error(`ROWC API Error: ${res.status}`);
    const data = await res.json();
    const result = data.result;
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(text);
    
    const hasElaboratedRemarks = parsed.lessons?.[0]?.remarks?.length > 20;
    const hasReflection = !!parsed.reflection;
    
    results.rowc = {
        status: (hasElaboratedRemarks && hasReflection) ? "PASS" : "FAIL",
        model: data.modelUsed || 'gemini-3.8-flash',
        remarksElaborated: hasElaboratedRemarks,
        reflectionPresent: hasReflection
    };
    console.log("ROWC Result:", results.rowc);
  } catch (e: any) {
    results.rowc = { status: "FAIL", error: e.message };
    console.error("ROWC Failed:", e.message);
  }

  fs.writeFileSync('phase3d_acceptance_results.json', JSON.stringify(results, null, 2));
  console.log("\nSaved results to phase3d_acceptance_results.json");
  console.log("=== PHASE 3D COMPLETE ===");
}

runPhase3D().catch(e => {
    console.error("CRITICAL TEST FAILURE:", e);
    process.exit(1);
});
