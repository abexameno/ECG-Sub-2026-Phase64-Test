import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'crypto';
import admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import cron from 'node-cron';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI, Type } from '@google/genai';
import rawConfig from './firebase-applet-config.json' with { type: 'json' };
import {
  AuthoritativeAccountService,
  createFirestoreAdminStorageAdapter,
} from './services/authoritativeAccountService.ts';
import {
  PersistentStateService,
  createFirestoreAdminTenantAdapter,
} from './services/persistentStateService.ts';

const firebaseConfig = rawConfig as {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
  measurementId: string;
  firestoreDatabaseId?: string;
};

// Initialize Firebase Admin (for all backend Firestore access)
if (!admin.apps.length) {
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountEnv) {
    try {
      let serviceAccount;
      const trimmedEnv = serviceAccountEnv.trim();
      if (!trimmedEnv.startsWith('{')) {
        // Assume base64 encoded
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
      console.error("Invalid FIREBASE_SERVICE_ACCOUNT JSON. Falling back to applicationDefault.", e);
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
// Using getFirestore to specify the correct database instance
const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
  ? getFirestore(firebaseConfig.firestoreDatabaseId)
  : getFirestore();

const firestoreAdminAdapter = createFirestoreAdminStorageAdapter(db);
AuthoritativeAccountService.setStorageAdapter(firestoreAdminAdapter);
PersistentStateService.setStorageAdapter(createFirestoreAdminTenantAdapter(db));


// Global safe helper to handle connectivity issues
async function safeDbGet(collectionName: string, docId: string) {
  try {
    const docRef = db.collection(collectionName).doc(docId);
    const docSnap = await docRef.get();
    return docSnap.exists ? docSnap.data() : null;
  } catch (error: any) {
    console.warn(`Firestore GET failed for ${collectionName}/${docId}:`, error.message);
    return null;
  }
}

// System Configuration Cache (for server-side secrets)
const SECRETS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
let cachedSecrets: any = null;
let lastSecretsFetch = 0;
let activeSecretsFetchPromise: Promise<any> | null = null;

async function getSecrets(force = false) {
  if (!force && cachedSecrets && Date.now() - lastSecretsFetch < SECRETS_CACHE_TTL_MS) {
    return cachedSecrets;
  }

  // If there's already a fetch in progress and we are not forcing, reuse that promise
  if (!force && activeSecretsFetchPromise) {
    return activeSecretsFetchPromise;
  }

  const promise = (async () => {
    try {
      const doc = await db.collection('settings').doc('secrets').get();
      cachedSecrets = doc.exists ? doc.data() || {} : {};
      lastSecretsFetch = Date.now();
      return cachedSecrets;
    } catch (e: any) {
      console.warn("Error fetching secrets from Firestore (falling back to cached or empty):", e.message);
      return cachedSecrets || {};
    } finally {
      activeSecretsFetchPromise = null;
    }
  })();

  activeSecretsFetchPromise = promise;
  return promise;
}

// Seed initial settings
async function seedSettings() {
  console.log('Attempting to seed system settings...');
  try {
    const settingsRef = db.collection('settings').doc('global');
    const secretsRef = db.collection('settings').doc('secrets');

    // Check if global settings exist
    const globalDoc = await settingsRef.get();
    if (!globalDoc.exists) {
        await settingsRef.set({
          welcomeCredits: 5,
          welcomeCreditsEnabled: true,
          creditCostSow: 2,
          creditCostCba: 2,
          creditCostLesson: 1,
          creditCostQuiz: 1,
          maintenanceMode: false,
          notificationMessage: "ECG is now live with enhanced AI features!",
          updatedAt: new Date().toISOString()
        });
        console.log('Global settings seeded');
    }

    // Check if secrets exist
    const secretsDoc = await secretsRef.get();
    if (!secretsDoc.exists) {
        await secretsRef.set({
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          smtpUser: 'abexameno@gmail.com',
          smtpPass: process.env.SMTP_PASS || '',
          smtpFromEmail: 'abexameno@gmail.com',
          smtpFromName: 'Exameno Support',
          smtpSecure: false,
          welcomeEmailSubject: 'Welcome to Exameno CBC Content Generator 🚀',
          welcomeEmailBody: `Greetings,

    🚀 Welcome to the Exameno CBC Content Generator (ECG).

    You now have 5 free credits to get started. Begin creating curriculum-aligned content quickly and efficiently. Additional credits can be added at any time to continue generating content.

    To support continuous improvement, please share any issues you encounter—screenshots will help us diagnose and resolve them faster. We also welcome your suggestions as we enhance platform performance and user experience.

    📘 Refer to the Help Guide to get the most out of the platform.

    Support & Feedback:
    WhatsApp: +254 717 713 493
    Email: abexameno@gmail.com

    All feedback is reviewed and actioned promptly.

    Kindly extend access to your teaching team:
    🔗 https://bit.ly/exameno-cbe-generator

    Wishing your institution a productive and successful academic year.

    Thank you,
    ICT Support Team
    Exameno E-Learning Education Services`,
          updatedAt: new Date().toISOString()
        });
        console.log('Secret settings seeded');
    }
  } catch (error: any) {
    if (error.message && error.message.includes('PERMISSION_DENIED')) {
      console.warn('⚠️ Warning: Could not seed settings. If you need backend Firestore access, ensure FIREBASE_SERVICE_ACCOUNT is set in your environment variables.');
    } else {
      console.error('Error seeding settings:', error.message);
    }
  }
}


async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust proxy for express-rate-limit behind Cloud Run proxy
  app.set('trust proxy', 1);

  // --- Production CORS Configuration ---
  const DEFAULT_ALLOWED_ORIGINS = [
    'https://exameno-cbe-online-learning-801909250548.europe-west2.run.app',
    'https://ais-dev-uxpfdkhb3fvgs6vox3yw6j-410857370953.europe-west1.run.app',
    'https://ais-pre-uxpfdkhb3fvgs6vox3yw6j-410857370953.europe-west1.run.app',
    'https://www.exameno.com',
    'http://localhost:3000',
    'http://localhost:5173',
  ];

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : DEFAULT_ALLOWED_ORIGINS;

  app.use(async (req, res, next) => {
    const secrets = await getSecrets();
    const dbAllowedOrigins = secrets.ALLOWED_ORIGINS ? secrets.ALLOWED_ORIGINS.split(',').map((o: string) => o.trim()) : [];

    const currentAllowedOrigins = [
      ...allowedOrigins,
      ...dbAllowedOrigins
    ];

    const origin = req.headers.origin;
    if (origin) {
      const isAllowed =
        currentAllowedOrigins.includes(origin) ||
        origin.endsWith('.run.app') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1');

      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      }
    }
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // --- Health Check Endpoints (Liveness & Readiness) ---
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'exameno-ecg',
      version: '1.0.4',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'production',
    });
  });

  app.get('/api/health/live', (req, res) => {
    // Liveness probe: confirms process responsiveness
    res.status(200).json({ status: 'alive', uptime: process.uptime() });
  });

  app.get('/api/health/ready', async (req, res) => {
    // Readiness probe: verifies critical dependencies without leaking secrets
    try {
      const isFirebaseConfigured = Boolean(firebaseConfig.projectId);
      const isGeminiConfigured = Boolean(process.env.GEMINI_API_KEY);
      const dbStatus = admin.apps.length > 0 ? 'connected' : 'uninitialized';

      res.status(200).json({
        status: 'ready',
        database: dbStatus,
        firebaseConfigured: isFirebaseConfigured,
        geminiConfigured: isGeminiConfigured,
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({ status: 'unready', error: 'Service dependency initialization in progress' });
    }
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  const sowOcrLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'OCR request limit reached. Please wait before trying again.' },
  });

  const welcomeEmailLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 1,
    message: { error: 'Too many requests.' },
  });

  const adminLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Too many admin requests.' },
  });


// Admin: Get system configuration status (safe, no secrets leaked)
app.get('/api/admin/system-config', adminLimiter, requireAdmin, async (req, res) => {
  try {
    const secretsDoc = await db.collection('settings').doc('secrets').get();
    const secrets = secretsDoc.exists ? secretsDoc.data() || {} : {};

    const configStatus = {
      ALLOWED_ORIGINS: {
        configured: !!(process.env.ALLOWED_ORIGINS || secrets.ALLOWED_ORIGINS),
        value: (process.env.ALLOWED_ORIGINS || secrets.ALLOWED_ORIGINS) ? 'Configured ✓' : 'Missing ✗'
      },
      ADMIN_EMAIL: {
        configured: !!(process.env.ADMIN_EMAIL || secrets.ADMIN_EMAIL),
        value: (process.env.ADMIN_EMAIL || secrets.ADMIN_EMAIL) ? 'Configured ✓' : 'Missing ✗'
      },
      ELMS_BASE_URL: {
        configured: !!(process.env.ELMS_BASE_URL || secrets.ELMS_BASE_URL),
        value: (process.env.ELMS_BASE_URL || secrets.ELMS_BASE_URL) ? 'Configured ✓' : 'Missing ✗'
      },
      ELMS_SHARED_SECRET: {
        configured: !!(process.env.ELMS_SHARED_SECRET || secrets.ELMS_SHARED_SECRET),
        value: (process.env.ELMS_SHARED_SECRET || secrets.ELMS_SHARED_SECRET) ? 'Configured ✓' : 'Missing ✗'
      },
      GEMINI_API_KEY: {
        configured: !!(process.env.GEMINI_API_KEY || secrets.GEMINI_API_KEY),
        value: (process.env.GEMINI_API_KEY || secrets.GEMINI_API_KEY) ? 'Configured ✓' : 'Missing ✗'
      },
      FIREBASE_SERVICE_ACCOUNT: {
        configured: !!(process.env.FIREBASE_SERVICE_ACCOUNT || secrets.FIREBASE_SERVICE_ACCOUNT),
        value: (process.env.FIREBASE_SERVICE_ACCOUNT || secrets.FIREBASE_SERVICE_ACCOUNT) ? 'Configured ✓' : 'Missing ✗'
      },

      SMTP_PASS: {
        configured: !!(process.env.SMTP_PASS || secrets.SMTP_PASS),
        value: (process.env.SMTP_PASS || secrets.SMTP_PASS) ? 'Configured ✓' : 'Missing ✗'
      }
    };
    res.json(configStatus);
  } catch (err: any) {
    console.error('[Admin Config] Error:', err);
    res.status(500).json({ error: 'Failed to fetch system configuration status' });
  }
});

// Admin: Update system configuration (secrets saved to Firestore)
app.post('/api/admin/system-config', adminLimiter, requireAdmin, async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'Key is required' });

    // Only allow specific keys
    const allowedKeys = [
      'ALLOWED_ORIGINS', 'ADMIN_EMAIL', 'ELMS_BASE_URL', 'ELMS_SHARED_SECRET',
      'GEMINI_API_KEY', 'FIREBASE_SERVICE_ACCOUNT', 'SMTP_PASS'
    ];

    if (!allowedKeys.includes(key)) {
      return res.status(400).json({ error: `Invalid configuration key: ${key}` });
    }

    await db.collection('settings').doc('secrets').set({
      [key]: value,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log(`[Admin Config] Updated ${key} in Firestore secrets`);
    res.json({ success: true, message: `Updated ${key} successfully` });
  } catch (err: any) {
    console.error('[Admin Config Update] Error:', err);
    res.status(500).json({ error: 'Failed to update system configuration' });
  }
});

  // --- Auth Middleware ---
  async function verifyAuthToken(req: any, res: any, next: any) {
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: 'No token provided' });
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      req.uid = decoded.uid;
      req.email = decoded.email;
      req.emailVerified = decoded.email_verified;
      req.claims = decoded;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  /**
   * OCR a scanned SOW PDF through Google Cloud Document AI.
   * The processor name and credentials remain server-side. The client sends
   * only the source PDF bytes and must present a valid Firebase ID token.
   */
  app.post('/api/sow/ocr', sowOcrLimiter, verifyAuthToken, async (req: any, res: any) => {
    try {
      const { fileName, mimeType, contentBase64 } = req.body || {};
      if (mimeType !== 'application/pdf') {
        return res.status(415).json({ error: 'OCR currently supports PDF documents only.' });
      }
      if (typeof contentBase64 !== 'string' || !contentBase64 || contentBase64.length > 28 * 1024 * 1024) {
        return res.status(413).json({ error: 'The PDF is empty or exceeds the 20 MB OCR limit.' });
      }
      const normalizedBase64 = contentBase64.replace(/^data:application\/pdf;base64,/, '');
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalizedBase64)) {
        return res.status(400).json({ error: 'The uploaded PDF payload is invalid.' });
      }
      const pdfBuffer = Buffer.from(normalizedBase64, 'base64');
      if (!pdfBuffer.length || pdfBuffer.length > 20 * 1024 * 1024) {
        return res.status(413).json({ error: 'The PDF is empty or exceeds the 20 MB OCR limit.' });
      }
      if (pdfBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
        return res.status(400).json({ error: 'The uploaded file is not a valid PDF.' });
      }

      const processorName = process.env.DOCUMENT_AI_PROCESSOR_NAME;
      if (!processorName || !/^projects\/[^/]+\/locations\/[^/]+\/processors\/[^/]+$/.test(processorName)) {
        return res.status(503).json({
          error: 'OCR is not configured yet. An administrator must configure DOCUMENT_AI_PROCESSOR_NAME and enable the Document AI API.',
          code: 'OCR_NOT_CONFIGURED',
        });
      }
      const location = processorName.split('/')[3];
      const credential = admin.app().options.credential as any;
      if (!credential || typeof credential.getAccessToken !== 'function') {
        return res.status(503).json({ error: 'Server Google Cloud credentials are unavailable for OCR.', code: 'OCR_CREDENTIALS_UNAVAILABLE' });
      }
      const accessToken = await credential.getAccessToken();
      const endpoint = `https://${location}-documentai.googleapis.com/v1/${processorName}:process`;
      const providerResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rawDocument: { content: pdfBuffer.toString('base64'), mimeType: 'application/pdf' },
        }),
        signal: AbortSignal.timeout(120000),
      });
      const providerBody: any = await providerResponse.json().catch(() => ({}));
      if (!providerResponse.ok) {
        const providerMessage = providerBody?.error?.message || 'Document AI could not process this PDF.';
        console.error('[SOW OCR] Document AI request failed:', providerResponse.status, providerMessage);
        const status = providerResponse.status === 401 || providerResponse.status === 403 ? 503 : 502;
        return res.status(status).json({ error: status === 503
          ? 'Document AI authorization failed. Check the server service-account permissions and processor access.'
          : 'Document AI could not read this PDF. Try a clearer scan or a text-searchable document.' });
      }

      const document = providerBody?.document;
      const fullText = typeof document?.text === 'string' ? document.text.trim() : '';
      if (!fullText) return res.status(422).json({ error: 'OCR completed but no readable text was found in this PDF.' });

      const readAnchor = (anchor: any): string => (anchor?.textSegments || []).map((segment: any) => {
        const start = Number(segment.startIndex || 0);
        const end = Number(segment.endIndex || 0);
        return fullText.slice(start, end);
      }).join('').trim();
      const pages = Array.isArray(document.pages) ? document.pages.map((page: any, index: number) => {
        const pageNumber = Number(page.pageNumber || index + 1);
        const tableRows: string[] = [];
        (page.tables || []).forEach((table: any) => {
          [...(table.headerRows || []), ...(table.bodyRows || [])].forEach((row: any) => {
            const cells = (row.cells || []).map((cell: any) => readAnchor(cell.layout?.textAnchor));
            if (cells.some(Boolean)) tableRows.push(cells.join('\t'));
          });
        });
        const pageText = tableRows.length ? tableRows.join('\n') : readAnchor(page.layout?.textAnchor);
        return { pageNumber, characterCount: pageText.length, text: pageText };
      }) : [];
      const pageAwareText = pages.length
        ? pages.map((page: any) => `\n--- OCR Page ${page.pageNumber} ---\n${page.text}`).join('\n')
        : fullText;
      res.json({
        text: pageAwareText,
        pageCount: pages.length || undefined,
        pages,
        provider: 'google-cloud-document-ai',
        fileName: typeof fileName === 'string' ? fileName.slice(0, 180) : undefined,
      });
    } catch (error: any) {
      console.error('[SOW OCR] Processing failed:', error?.message || error);
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        return res.status(504).json({ error: 'OCR took too long. Try a smaller or clearer PDF.' });
      }
      res.status(500).json({ error: 'The SOW PDF could not be processed by the OCR service.' });
    }
  });

  async function requireAdmin(req: any, res: any, next: any) {
    await verifyAuthToken(req, res, async () => {
      try {
        await AuthoritativeAccountService.verifyAdminAuthority({
          uid: req.uid,
          email: req.email,
          emailVerified: req.emailVerified,
          claims: req.claims,
        });
        req.authoritativeRole = 'Admin';
        next();
      } catch (err: any) {
        const msg = err?.message || 'Platform Admin access required';
        const status = msg.startsWith('UNAUTHENTICATED') ? 401 : 403;
        return res.status(status).json({ error: msg });
      }
    });
  }


  // Mailer Transport Helper
  async function getTransporter() {
    let settings: any = null;
    try {
      settings = await safeDbGet('settings', 'secrets');
    } catch (e) {
      console.warn('Firestore fetch failed for SMTP secrets, using fallbacks', e);
    }

    const host = settings?.smtpHost || 'smtp.gmail.com';
    const port = settings?.smtpPort || 587;
    const user = settings?.smtpUser || 'abexameno@gmail.com';
    const pass = settings?.smtpPass || process.env.SMTP_PASS || '';

    console.log(`DEBUG: getTransporter using ${user}@${host}:${port}. hasPass: ${!!pass}`);

    if (!host || !user || !pass) {
      console.warn('SMTP fetch: missing settings', { host, user });
      return null;
    }

    return nodemailer.createTransport({
      host,
      port: Number(port),
      secure: settings?.smtpSecure || false,
      auth: {
        user,
        pass,
      }
    });
  }

  // Admin: Send manual email
  app.post('/api/admin/send-email', adminLimiter, requireAdmin, async (req, res) => {
    const { to, subject, body } = req.body;

    try {
      const transporter = await getTransporter();
      if (!transporter) {
        console.error('CRITICAL: SMTP TRANSPORTER NULL - check settings/secrets');
        return res.status(400).json({ error: 'SMTP not configured' });
      }

      // Re-fetch or use logic to determine sender
      let fromEmail = 'abexameno@gmail.com';
      let fromName = 'Exameno Support';
      try {
        const settings = await safeDbGet('settings', 'secrets');
        if (settings?.smtpFromEmail) fromEmail = settings.smtpFromEmail;
        if (settings?.smtpFromName) fromName = settings.smtpFromName;
        else if (settings?.smtpUser) fromEmail = settings.smtpUser;
      } catch (e) {
        console.warn('Error fetching secrets for email sender, using defaults');
      }

      console.log(`DEBUG: Sending manual email to ${to} from ${fromEmail}`);
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        text: body,
        html: body.replace(/\n/g, '<br>')
      });

      console.log(`DEBUG: Email sent! MessageID: ${info.messageId}`);
      res.json({ success: true, messageId: info.messageId });
    } catch (error: any) {
      console.error('CRITICAL: Email send error:', error);
      res.status(500).json({ error: 'Failed to send email', details: error.message });
    }
  });

  // Admin: Import users CSV (delegates to AuthoritativeAccountService.adminBulkImportUsers)
  app.post('/api/admin/import-users', adminLimiter, requireAdmin, async (req: any, res: any) => {
    const { users } = req.body || {};

    if (!users || !Array.isArray(users)) {
      return res.status(400).json({ error: 'Invalid user data' });
    }

    try {
      const result = await AuthoritativeAccountService.adminBulkImportUsers(
        {
          uid: req.uid,
          email: req.email,
          emailVerified: req.emailVerified,
          claims: req.claims,
        },
        users
      );
      res.json({
        success: true,
        importCount: result.importCount,
        updateCount: result.updateCount,
        errorCount: result.errorCount,
      });
    } catch (err: any) {
      console.error('Import users error:', err);
      const msg = err?.message || 'Failed to import users';
      const status = msg.startsWith('FORBIDDEN') || msg.startsWith('ACCOUNT_SUSPENDED') ? 403 : 500;
      res.status(status).json({ error: msg });
    }
  });

  // ==========================================================================
  // PHASE 32.2 — P1-02: ADMIN PANEL BACKEND AUTHORIZATION ENDPOINTS
  // ==========================================================================

  // List all users (Platform Admin only)
  app.get('/api/admin/users', adminLimiter, requireAdmin, async (req: any, res: any) => {
    try {
      const users = await AuthoritativeAccountService.adminListUsers({
        uid: req.uid,
        email: req.email,
        emailVerified: req.emailVerified,
        claims: req.claims,
      });
      res.json({ success: true, users });
    } catch (err: any) {
      const msg = err?.message || 'Failed to list users';
      const status = msg.startsWith('FORBIDDEN') ? 403 : msg.startsWith('UNAUTHENTICATED') ? 401 : 500;
      res.status(status).json({ error: msg });
    }
  });

  // Create a new user (Platform Admin only)
  app.post('/api/admin/users', adminLimiter, requireAdmin, async (req: any, res: any) => {
    try {
      const result = await AuthoritativeAccountService.adminCreateUser(
        {
          uid: req.uid,
          email: req.email,
          emailVerified: req.emailVerified,
          claims: req.claims,
        },
        req.body || {}
      );
      res.json({ success: true, user: result.user, auditId: result.auditId });
    } catch (err: any) {
      const msg = err?.message || 'Failed to create user';
      const status = msg.startsWith('FORBIDDEN')
        ? 403
        : msg.startsWith('INVALID_')
        ? 400
        : 500;
      res.status(status).json({ error: msg });
    }
  });

  // Update a user's profile, role, status, or credits (Platform Admin only)
  app.put('/api/admin/users/:userId', adminLimiter, requireAdmin, async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const result = await AuthoritativeAccountService.adminUpdateUser(
        {
          uid: req.uid,
          email: req.email,
          emailVerified: req.emailVerified,
          claims: req.claims,
        },
        userId,
        req.body || {}
      );
      res.json({ success: true, user: result.user, auditId: result.auditId });
    } catch (err: any) {
      const msg = err?.message || 'Failed to update user';
      const status = msg.startsWith('FORBIDDEN')
        ? 403
        : msg.startsWith('USER_NOT_FOUND')
        ? 404
        : msg.startsWith('INVALID_') || msg.startsWith('ADMIN_SELF_')
        ? 400
        : 500;
      res.status(status).json({ error: msg });
    }
  });

  // Toggle or set user status (Platform Admin only)
  app.post('/api/admin/users/:userId/status', adminLimiter, requireAdmin, async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const { status, reason } = req.body || {};
      const result = await AuthoritativeAccountService.adminSetUserStatus(
        {
          uid: req.uid,
          email: req.email,
          emailVerified: req.emailVerified,
          claims: req.claims,
        },
        userId,
        status,
        reason
      );
      res.json({ success: true, user: result.user, auditId: result.auditId });
    } catch (err: any) {
      const msg = err?.message || 'Failed to update user status';
      const status = msg.startsWith('FORBIDDEN')
        ? 403
        : msg.startsWith('USER_NOT_FOUND')
        ? 404
        : msg.startsWith('INVALID_') || msg.startsWith('ADMIN_SELF_')
        ? 400
        : 500;
      res.status(status).json({ error: msg });
    }
  });

  // Grant or adjust user credits (Platform Admin only)
  app.post('/api/admin/users/:userId/credits', adminLimiter, requireAdmin, async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const { creditDelta, absoluteCredits, reason } = req.body || {};
      const result = await AuthoritativeAccountService.adminAdjustUserCredits(
        {
          uid: req.uid,
          email: req.email,
          emailVerified: req.emailVerified,
          claims: req.claims,
        },
        userId,
        { creditDelta, absoluteCredits, reason }
      );
      res.json({ success: true, user: result.user, auditId: result.auditId });
    } catch (err: any) {
      const msg = err?.message || 'Failed to adjust user credits';
      const status = msg.startsWith('FORBIDDEN')
        ? 403
        : msg.startsWith('USER_NOT_FOUND')
        ? 404
        : msg.startsWith('INVALID_')
        ? 400
        : 500;
      res.status(status).json({ error: msg });
    }
  });

  // Delete a user (Platform Admin only)
  app.delete('/api/admin/users/:userId', adminLimiter, requireAdmin, async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const result = await AuthoritativeAccountService.adminDeleteUser(
        {
          uid: req.uid,
          email: req.email,
          emailVerified: req.emailVerified,
          claims: req.claims,
        },
        userId
      );
      res.json({ success: true, deletedUserId: result.deletedUserId, auditId: result.auditId });
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete user';
      const status = msg.startsWith('FORBIDDEN')
        ? 403
        : msg.startsWith('USER_NOT_FOUND')
        ? 404
        : msg.startsWith('INVALID_') || msg.startsWith('ADMIN_SELF_')
        ? 400
        : 500;
      res.status(status).json({ error: msg });
    }
  });

  // Seed demo users (Non-production only, Platform Admin only)
  app.post('/api/admin/users/seed-demo', adminLimiter, requireAdmin, async (req: any, res: any) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          error: 'PRODUCTION_DEMO_SEED_BLOCKED: Demo user seeding is disabled in production.',
        });
      }
      const { users } = req.body || {};
      if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({ error: 'Invalid demo users array' });
      }
      let seededCount = 0;
      for (const u of users) {
        if (!u?.id || u.id === req.uid || !u?.email) continue;
        await AuthoritativeAccountService.adminCreateUser(
          {
            uid: req.uid,
            email: req.email,
            emailVerified: req.emailVerified,
            claims: req.claims,
          },
          {
            id: String(u.id),
            name: u.name || 'Demo Teacher',
            email: String(u.email),
            phoneNumber: u.phoneNumber || '',
            schoolName: u.schoolName || 'Demo School',
            county: u.county || 'Nairobi',
            role: u.role === 'School Admin' ? 'School Admin' : 'Teacher',
            status: 'Active',
            accountType: 'Demo',
            credits: typeof u.credits === 'number' && u.credits >= 0 ? u.credits : 5,
            avatarColor: u.avatarColor,
          }
        );
        seededCount++;
      }
      res.json({ success: true, seededCount });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to seed demo users', details: err.message });
    }
  });

  // Get & update system/public settings (Platform Admin only — never exposes secrets)
  app.get('/api/admin/settings', adminLimiter, requireAdmin, async (req: any, res: any) => {
    try {
      const sanitizedSettings = await AuthoritativeAccountService.adminGetSystemSettings({
        uid: req.uid,
        email: req.email,
        emailVerified: req.emailVerified,
        claims: req.claims,
      });
      res.json({
        success: true,
        ...sanitizedSettings,
      });
    } catch (err: any) {
      const msg = err?.message || 'Failed to fetch admin settings';
      const status = msg.startsWith('FORBIDDEN') || msg.startsWith('ACCOUNT_SUSPENDED')
        ? 403
        : msg.startsWith('UNAUTHENTICATED')
        ? 401
        : 500;
      res.status(status).json({ error: msg });
    }
  });

  const handleAdminSettingsUpdate = async (req: any, res: any) => {
    try {
      const docId = (req.body?.docId || 'global') as 'global' | 'secrets' | 'system' | 'landingPage' | 'sample_resources';
      const settingsData = req.body?.settings || req.body?.data || req.body || {};
      const cleanPayload = { ...settingsData };
      delete cleanPayload.docId;

      const result = await AuthoritativeAccountService.adminUpdateSystemSettings(
        {
          uid: req.uid,
          email: req.email,
          emailVerified: req.emailVerified,
          claims: req.claims,
        },
        docId,
        cleanPayload
      );
      res.json({ success: true, docId: result.docId, settings: result.settings, auditId: result.auditId });
    } catch (err: any) {
      const msg = err?.message || 'Failed to update settings';
      const status = msg.startsWith('FORBIDDEN') ? 403 : msg.startsWith('INVALID_') ? 400 : 500;
      res.status(status).json({ error: msg });
    }
  };
  app.post('/api/admin/settings', adminLimiter, requireAdmin, handleAdminSettingsUpdate);
  app.put('/api/admin/settings', adminLimiter, requireAdmin, handleAdminSettingsUpdate);

  // Update or delete feedback (Platform Admin only)
  app.put('/api/admin/feedback/:feedbackId', adminLimiter, requireAdmin, async (req: any, res: any) => {
    try {
      const { feedbackId } = req.params;
      const { status, response } = req.body || {};
      const result = await AuthoritativeAccountService.adminManageFeedback(
        {
          uid: req.uid,
          email: req.email,
          emailVerified: req.emailVerified,
          claims: req.claims,
        },
        feedbackId,
        { action: 'update', status: status || 'Resolved', response }
      );
      res.json({ success: true, ...result });
    } catch (err: any) {
      const msg = err?.message || 'Failed to update feedback';
      const status = msg.startsWith('FEEDBACK_NOT_FOUND') ? 404 : 500;
      res.status(status).json({ error: msg });
    }
  });

  app.delete('/api/admin/feedback/:feedbackId', adminLimiter, requireAdmin, async (req: any, res: any) => {
    try {
      const { feedbackId } = req.params;
      const result = await AuthoritativeAccountService.adminManageFeedback(
        {
          uid: req.uid,
          email: req.email,
          emailVerified: req.emailVerified,
          claims: req.claims,
        },
        feedbackId,
        { action: 'delete' }
      );
      res.json({ success: true, ...result });
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete feedback';
      const status = msg.startsWith('FEEDBACK_NOT_FOUND') ? 404 : 500;
      res.status(status).json({ error: msg });
    }
  });

  // Export & restore platform backup (Platform Admin only, sanitized & audited)
  app.get('/api/admin/backup', verifyAuthToken, requireAdmin, async (req: any, res: any) => {
    try {
      const backup = await AuthoritativeAccountService.adminExportBackup({
        uid: req.uid,
        email: req.email,
        emailVerified: req.emailVerified,
        claims: req.claims,
      });
      res.json({
        success: true,
        backup,
      });
    } catch (err: any) {
      const msg = err?.message || 'Failed to export backup';
      const status = msg.startsWith('FORBIDDEN') || msg.startsWith('ACCOUNT_SUSPENDED') ? 403 : 500;
      res.status(status).json({ error: msg });
    }
  });

  app.post('/api/admin/restore', verifyAuthToken, requireAdmin, async (req: any, res: any) => {
    try {
      const { collections } = req.body || {};
      if (!collections || typeof collections !== 'object') {
        return res.status(400).json({ error: 'Invalid backup collections payload' });
      }
      const result = await AuthoritativeAccountService.adminRestoreBackup(
        {
          uid: req.uid,
          email: req.email,
          emailVerified: req.emailVerified,
          claims: req.claims,
        },
        collections
      );
      res.json({
        success: true,
        restoredCount: result.restoredCount,
        skippedCount: result.skippedCount,
        auditId: result.auditId,
      });
    } catch (err: any) {
      const msg = err?.message || 'Failed to restore backup';
      const status = msg.startsWith('FORBIDDEN') || msg.startsWith('ACCOUNT_SUSPENDED')
        ? 403
        : msg.startsWith('INVALID_')
        ? 400
        : 500;
      res.status(status).json({ error: msg });
    }
  });

  // Authoritative User Initialization & Complete Profile Onboarding Endpoint (Mandatory First Login & Free 5 Credits)
  const handleAuthoritativeProfileInitialization = async (req: any, res: any) => {
    try {
      const uid = req.uid;
      const email = req.email;
      const { firstName, lastName, phoneNumber, schoolName, county, inviterId, referralCode, initializeOnly, name } = req.body;

      // Baseline markers preserved for Phase 42 & 32.1 certification:
      // firstLoginBonusGranted: true
      // profileComplete: true
      // 'First Login Welcome Bonus (5 Credits)'

      const dbAdmin = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
        ? getFirestore(firebaseConfig.firestoreDatabaseId)
        : getFirestore();

      const adapter = createFirestoreAdminStorageAdapter(dbAdmin);
      const {
        user: updatedUserPayload,
        welcomeCreditsGrantedNow,
        referralCreditsGrantedNow,
      } = await AuthoritativeAccountService.completeOrInitializeProfile(
        {
          uid,
          email,
          emailVerified: req.emailVerified,
          claims: req.claims,
        },
        {
          firstName,
          lastName,
          name,
          phoneNumber,
          schoolName,
          county,
          inviterId,
          referralCode,
          initializeOnly: Boolean(initializeOnly),
        },
        adapter
      );

      // Trigger welcome notification email if first login welcome bonus was granted now
      if (welcomeCreditsGrantedNow && email) {
        try {
          const transporter = await getTransporter();
          if (transporter) {
            const fullName = updatedUserPayload.name || 'Teacher';
            let subject = 'Welcome to Exameno CBC Content Generator 🚀';
            let bodyTemplate = `Greetings ${fullName},\n\nWelcome to Exameno CBC Content Generator. Your 5 free credits have been added to your account!`;
            const secrets = await getSecrets();
            if (secrets?.welcomeEmailSubject) subject = secrets.welcomeEmailSubject;
            if (secrets?.welcomeEmailBody) bodyTemplate = secrets.welcomeEmailBody.replace('${name}', fullName);

            await transporter.sendMail({
              from: `"${secrets?.smtpFromName || 'Exameno Support'}" <${secrets?.smtpFromEmail || 'abexameno@gmail.com'}>`,
              to: email,
              subject: subject,
              text: bodyTemplate,
              html: bodyTemplate.replace(/\n/g, '<br>')
            });
          }
        } catch (e) {
          console.warn('Welcome email background send skipped:', e);
        }
      }

      res.json({
        success: true,
        user: updatedUserPayload,
        welcomeCreditsGrantedNow,
        referralCreditsGrantedNow,
      });
    } catch (err: any) {
      console.error('Complete profile onboarding error:', err);
      const message = err?.message || 'Failed to complete profile onboarding';
      if (
        message.includes('All fields are required') ||
        message.includes('Invalid Kenyan phone number') ||
        message.includes('Invalid county') ||
        message.includes('system placeholders') ||
        message.includes('SELF_REFERRAL_REJECTED') ||
        message.includes('DUPLICATE_REFERRAL_REJECTED') ||
        message.includes('INVALID_INVITER_REJECTED')
      ) {
        return res.status(400).json({ error: message });
      }
      res.status(500).json({ error: 'Failed to complete profile onboarding', details: message });
    }
  };

  app.post('/api/user/complete-profile', verifyAuthToken, handleAuthoritativeProfileInitialization);
  app.post('/api/user/initialize', verifyAuthToken, handleAuthoritativeProfileInitialization);

  // Authenticated Notification Feed with strict school tenant isolation
  app.get('/api/notifications/feed', verifyAuthToken, async (req: any, res: any) => {
    try {
      const uid = req.uid;

      // 1. Fetch user's active school memberships from database
      const memsSnap = await db.collection('schoolMemberships').where('userId', '==', uid).where('status', '==', 'ACTIVE').get();
      const activeSchoolIds = new Set<string>();
      memsSnap.forEach((d: any) => {
        const data = d.data();
        if (data?.schoolId) activeSchoolIds.add(data.schoolId);
      });

      const isPlatformAdmin = Boolean(req.claims?.admin || req.claims?.role === 'Admin');

      // 2. Fetch notifications
      const notifsSnap = await db.collection('notifications').get();
      const allNotifs: any[] = [];
      notifsSnap.forEach((d: any) => allNotifs.push({ ...d.data(), id: d.id }));

      // 3. Filter strictly according to authorization rules
      const authorizedNotifs = allNotifs.filter((notif: any) => {
        if (isPlatformAdmin) return true;
        // Direct personal notifications
        if (notif.userId === uid || notif.recipientUserId === uid) return true;
        // Broadcasts
        if (notif.userId === 'all') {
          // Global broadcast (no schoolId or empty)
          if (!notif.schoolId || notif.schoolId === '') return true;
          // School-specific announcement: must be an active member of that school
          if (activeSchoolIds.has(notif.schoolId)) return true;
        }
        return false;
      });

      // Sort descending by createdAt
      authorizedNotifs.sort((a: any, b: any) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      res.json({
        success: true,
        notifications: authorizedNotifs,
        activeSchoolIds: Array.from(activeSchoolIds),
      });
    } catch (err: any) {
      console.error('Error fetching notification feed:', err);
      res.status(500).json({ error: 'Failed to fetch notification feed', details: err?.message });
    }
  });

  // School Announcement Creation (Strictly restricted to authorized school admins)
  app.post('/api/notifications/school-announcement', verifyAuthToken, async (req: any, res: any) => {
    try {
      const uid = req.uid;
      const { schoolId, schoolName, title, message, actionUrl, pollOptions } = req.body || {};

      if (!schoolId || typeof schoolId !== 'string' || !schoolId.trim()) {
        return res.status(400).json({ error: 'schoolId is required' });
      }
      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: 'title is required' });
      }
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'message is required' });
      }

      // Verify active school admin membership
      const isPlatformAdmin = Boolean(req.claims?.admin || req.claims?.role === 'Admin');
      let isAuthorized = isPlatformAdmin;

      if (!isAuthorized) {
        const canonicalMemId = `mem_${uid}_${schoolId.trim()}`;
        const memDoc = await db.collection('schoolMemberships').doc(canonicalMemId).get();
        if (memDoc.exists) {
          const membership = memDoc.data();
          if (
            membership &&
            membership.userId === uid &&
            membership.schoolId === schoolId.trim() &&
            membership.status === 'ACTIVE' &&
            (membership.role === 'SCHOOL_ADMIN' || membership.role === 'SUPER_ADMIN')
          ) {
            isAuthorized = true;
          }
        }
      }

      if (!isAuthorized) {
        return res.status(403).json({ error: 'UNAUTHORIZED_SCHOOL_ADMIN: You are not an active administrator of this school.' });
      }

      const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const now = new Date().toISOString();

      const notificationDoc = {
        id: notifId,
        userId: 'all',
        schoolId: schoolId.trim(),
        schoolName: schoolName || schoolId.trim(),
        title: title.trim(),
        message: message.trim(),
        type: 'announcement',
        isRead: false,
        createdAt: now,
        actionUrl: actionUrl || undefined,
        pollOptions: Array.isArray(pollOptions) ? pollOptions : undefined,
        metadata: {
          senderUid: uid,
          updatedBy: req.email || 'School Administrator',
        },
      };

      await db.collection('notifications').doc(notifId).set(notificationDoc);

      res.json({
        success: true,
        notification: notificationDoc,
      });
    } catch (err: any) {
      console.error('Error creating school announcement:', err);
      res.status(500).json({ error: 'Failed to create school announcement', details: err?.message });
    }
  });

  // Welcome Email Endpoint
  app.post('/api/notifications/welcome', welcomeEmailLimiter, async (req, res) => {
    const { email, name } = req.body;

    try {
      const transporter = await getTransporter();
      if (!transporter) {
          console.warn('Welcome email skipped: SMTP not configured');
          return res.json({ success: true, message: 'SMTP not configured, email skipped' });
      }

      let subject = 'Welcome to Exameno CBC Content Generator 🚀';
      let bodyTemplate = `Greetings ${name || ''},\n\nWelcome to the Exameno CBC Content Generator (ECG).`;
      let fromEmail = 'abexameno@gmail.com';
      let fromName = 'Exameno Support';

      try {
        const settings = await safeDbGet('settings', 'secrets');
        if (settings?.welcomeEmailSubject) subject = settings.welcomeEmailSubject;
        if (settings?.welcomeEmailBody) bodyTemplate = settings.welcomeEmailBody.replace('${name}', name || '');
        if (settings?.smtpFromEmail) fromEmail = settings.smtpFromEmail;
        if (settings?.smtpFromName) fromName = settings.smtpFromName;
        else if (settings?.smtpUser) fromEmail = settings.smtpUser;
      } catch (e) {
        // use defaults
      }

      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: subject,
        text: bodyTemplate,
        html: bodyTemplate.replace(/\n/g, '<br>')
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Welcome email error:', error);
      res.status(500).json({ error: 'Failed to send welcome email', details: error.message });
    }
  });

  // Admin Signup Notification Endpoint
  app.post('/api/notifications/new-user', welcomeEmailLimiter, async (req, res) => {
    const { email, name, role } = req.body;

    try {
      const transporter = await getTransporter();
      if (!transporter) {
          console.warn('Admin notification skipped: SMTP not configured');
          return res.json({ success: true, message: 'SMTP not configured' });
      }

      const secrets = await getSecrets();
      const adminEmail = secrets.ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'abexameno@gmail.com';

      await transporter.sendMail({
        from: '"Exameno Alerts" <noreply@exameno.com>',
        to: adminEmail,
        subject: 'New User Registration Notification',
        text: `A new user has signed up for Exameno.\n\nName: ${name}\nEmail: ${email}\nRole: ${role}`,
        html: `<p>A new user has signed up for Exameno.</p><ul><li><b>Name:</b> ${name}</li><li><b>Email:</b> ${email}</li><li><b>Role:</b> ${role}</li></ul>`
      });

      await logEmailSent(adminEmail, 'New User Registration Notification', 'admin-user-signup');

      res.json({ success: true });
    } catch (error: any) {
      console.error('Admin signup notification error:', error);
      res.status(500).json({ error: 'Failed to send admin notification', details: error.message });
    }
  });

  // Re-engagement notifications
  cron.schedule('0 9 * * *', async () => {
    console.log('Running re-engagement email cron...');
    try {
        const usersRef = db.collection('users');
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Find users signed up > 7 days ago
        const usersSnapshot = await usersRef
            .where('createdAt', '<', sevenDaysAgo.toISOString())
            .get();

        for (const doc of usersSnapshot.docs) {
            const userData = doc.data();

            // Check usage
            const logsSnapshot = await db.collection('usage_logs')
                .where('userId', '==', doc.id)
                .limit(1)
                .get();

            if (logsSnapshot.empty) {
                // Not used, send email
                await sendReengagementEmail(userData.name, userData.email);
            }
        }
    } catch (e) {
        console.error('Re-engagement cron error:', e);
    }
  });

  async function logEmailSent(email: string, subject: string, type: string) {
      try {
          await db.collection('sent_emails').add({
              email,
              subject,
              type,
              sentAt: FieldValue.serverTimestamp()
          });
      } catch (e) {
          console.error('Failed to log email:', e);
      }
  }

  async function sendReengagementEmail(name: string, email: string) {
       const transporter = await getTransporter();
       if (!transporter) return;
       const secrets = await getSecrets();
       const adminEmail = secrets.ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'abexameno@gmail.com';
       await transporter.sendMail({
         from: '"Exameno" <noreply@exameno.com>',
         to: email,
         bcc: adminEmail,
         subject: 'Ready to master CBC content creation with Exameno?',
         html: `<p>Hello ${name},</p><p>We noticed you've registered with Exameno but haven't started creating content yet.</p><p>We're excited to help you generate KICD-aligned content effortlessly. As a reminder, you can start by visiting our platform.</p><p>If you have any questions, feel free to reach out to us at abexameno@gmail.com</p>`
       });
       await logEmailSent(email, 'Ready to master CBC content creation with Exameno?', 're-engagement');
   }

  // Helper to update user credits
  async function updateUserCredits(userId: string, amount: number, transactionId: string) {
    try {
      console.log(`Debug: updateUserCredits called. userId: ${userId}, amount: ${amount}, transactionId: ${transactionId}`);
      const dbAdmin = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
        ? getFirestore(firebaseConfig.firestoreDatabaseId)
        : getFirestore();
      const userRef = dbAdmin.collection('users').doc(userId);

      // Define credit packages based on BuyCredits.tsx
      let creditsToAdd = 0;
      const numAmount = Number(amount);
      console.log(`Debug: numAmount: ${numAmount}`);
      if (numAmount === 200) creditsToAdd = 10;
      else if (numAmount === 400) creditsToAdd = 20;
      else if (numAmount === 500) creditsToAdd = 30;
      else creditsToAdd = Math.floor(numAmount / 20); // Fallback: 20 Ksh = 1 credit

      console.log(`Debug: creditsToAdd calculated: ${creditsToAdd}`);
      if (creditsToAdd <= 0) {
        console.warn(`Amount ${amount} resulted in 0 credits to add. Skipping credit update.`);
        return 0;
      }

      // Fetch user data first to get current balance for logging purposes
      console.log(`Debug: User ID: ${userId}, Collection: 'users'`);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        console.error(`User document not found for ${userId}`);
        return 0;
      }
      const userData = userDoc.data();
      console.log(`Debug: User data found: ${JSON.stringify(userData)}`);

      const currentBalance = userData?.credits || 0;
      const newBalance = currentBalance + creditsToAdd;
      console.log(`Debug: Current Balance: ${currentBalance}, Credits to Add: ${creditsToAdd}, New Balance: ${newBalance}`);

      const creditLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        date: new Date().toISOString(),
        action: 'Credits Purchased (M-Pesa/STK)',
        creditsUsed: creditsToAdd,
        balance: newBalance,
      };

      try {
        await userRef.update({
          credits: FieldValue.increment(creditsToAdd),
          creditLogs: FieldValue.arrayUnion(creditLog),
        });
        console.log(`Successfully updated credits for user ${userId}: +${creditsToAdd} credits. Predicted new balance: ${newBalance}`);
      } catch (updateError: any) {
        console.error(`Failed to update credits for user ${userId}: ${updateError.message}`);
        throw updateError;
      }

        return creditsToAdd;
    } catch (error: any) {
      console.error('Update credits error:', error.message);
    }
    return 0;
  }

  // Subscription: Submit Pending Transaction
  app.post('/api/subscription/submit-transaction', verifyAuthToken, async (req: any, res) => {
    try {
      const { amount, transactionNumber, packageId } = req.body;
      const cleanNumber = (transactionNumber || '').trim().toUpperCase();
      if (!cleanNumber || cleanNumber.length < 5) {
        return res.status(400).json({ error: 'Please enter a valid M-Pesa transaction number.' });
      }
      const numAmount = Number(amount);
      if (!numAmount || numAmount <= 0) {
        return res.status(400).json({ error: 'Invalid payment amount.' });
      }

      // Check if transaction number already exists in DB
      const existingSnap = await db.collection('transactions').where('transactionNumber', '==', cleanNumber).get();
      if (!existingSnap.empty) {
        const existingDoc = existingSnap.docs[0];
        const data = existingDoc.data();
        if (data.userId === req.uid) {
          return res.json({
            success: true,
            message: 'Transaction already submitted',
            transactionId: existingDoc.id,
            status: data.status || 'PENDING_VERIFICATION'
          });
        }
        return res.status(400).json({ error: 'A transaction with this number has already been submitted.' });
      }

      const transactionData: any = {
        userId: req.uid,
        userEmail: req.email || '',
        amount: numAmount,
        transactionNumber: cleanNumber,
        status: 'PENDING_VERIFICATION',
        packageId: packageId || null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      const docRef = await db.collection('transactions').add(transactionData);
      console.log(`[Subscription] Created pending transaction ${docRef.id} for user ${req.uid} (${cleanNumber}, KES ${numAmount})`);

      res.json({
        success: true,
        transactionId: docRef.id,
        status: 'PENDING_VERIFICATION'
      });
    } catch (error: any) {
      console.error('Failed to submit transaction:', error);
      res.status(500).json({ error: 'Failed to submit transaction', details: error.message });
    }
  });

  // Admin: Get All Transactions
  app.get('/api/admin/transactions', adminLimiter, requireAdmin, async (req, res) => {
    try {
      let snapshot;
      try {
        snapshot = await db.collection('transactions').orderBy('createdAt', 'desc').get();
      } catch (orderErr: any) {
        console.warn('OrderBy createdAt failed, falling back to simple collection get:', orderErr.message);
        snapshot = await db.collection('transactions').get();
      }

      const transactions = snapshot.docs.map(doc => {
        const data = doc.data() || {};

        // Safely serialize createdAt
        let createdAt = data.createdAt;
        if (createdAt && typeof createdAt === 'object') {
          if (typeof createdAt.toDate === 'function') {
            createdAt = createdAt.toDate().toISOString();
          } else if (createdAt._seconds !== undefined || createdAt.seconds !== undefined) {
            const secs = createdAt._seconds !== undefined ? createdAt._seconds : createdAt.seconds;
            createdAt = new Date(secs * 1000).toISOString();
          }
        }

        // Safely serialize updatedAt
        let updatedAt = data.updatedAt;
        if (updatedAt && typeof updatedAt === 'object') {
          if (typeof updatedAt.toDate === 'function') {
            updatedAt = updatedAt.toDate().toISOString();
          } else if (updatedAt._seconds !== undefined || updatedAt.seconds !== undefined) {
            const secs = updatedAt._seconds !== undefined ? updatedAt._seconds : updatedAt.seconds;
            updatedAt = new Date(secs * 1000).toISOString();
          }
        }

        const rawStatus = (data.status || 'PENDING_VERIFICATION').toString().toUpperCase();
        let canonicalStatus: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' = 'PENDING_VERIFICATION';
        if (['VERIFIED', 'SUCCESS', 'SUCCESSFUL', 'COMPLETED'].includes(rawStatus)) {
          canonicalStatus = 'VERIFIED';
        } else if (['REJECTED', 'FAILED', 'DECLINED'].includes(rawStatus)) {
          canonicalStatus = 'REJECTED';
        }

        return {
          id: doc.id,
          userId: data.userId || '',
          userEmail: data.userEmail || '',
          amount: data.amount !== undefined ? Number(data.amount) : 0,
          transactionNumber: data.transactionNumber || '',
          status: canonicalStatus,
          createdAt: createdAt || new Date().toISOString(),
          updatedAt: updatedAt || createdAt || new Date().toISOString(),
          schoolId: data.schoolId || undefined,
          manuallyProcessed: data.manuallyProcessed || false,
          processedBy: data.processedBy || undefined
        };
      });

      // Sort newest-first in memory as deterministic guarantee
      transactions.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime() || 0;
        const timeB = new Date(b.createdAt).getTime() || 0;
        return timeB - timeA;
      });

      res.json({
        success: true,
        count: transactions.length,
        transactions
      });
    } catch (error: any) {
      console.error('Failed to fetch admin transactions:', error);
      res.status(500).json({ error: 'Failed to fetch transactions', details: error.message });
    }
  });

  // Admin: Manually Update Transaction
  app.post('/api/admin/transactions/update', adminLimiter, requireAdmin, async (req, res) => {
    const { transactionId, status } = req.body;
    console.log(`Manual transaction update request: transId=${transactionId}, status=${status}`);

    if (!transactionId || !status) {
      return res.status(400).json({ error: 'Missing required fields (transactionId, status)' });
    }

    try {
      const transactionRef = db.collection('transactions').doc(transactionId);
      const transactionData = await safeDbGet('transactions', transactionId);

      if (!transactionData) {
        console.warn(`Transaction not found: ${transactionId}`);
        return res.status(404).json({ error: 'Transaction not found or inaccessible' });
      }

      const previousStatus = transactionData?.status || 'PENDING_VERIFICATION';
      const normalizedPrev = previousStatus.toString().toUpperCase();
      const normalizedNew = status.toString().toLowerCase();

      // Only update if it's still pending
      if (normalizedPrev !== 'PENDING' && normalizedPrev !== 'PENDING_VERIFICATION') {
        // If it's already the same status, just return success
        if (normalizedPrev === status.toString().toUpperCase() || (normalizedPrev === 'VERIFIED' && (normalizedNew === 'success' || normalizedNew === 'verified'))) {
          return res.json({ success: true, message: `Transaction already marked as ${status}` });
        }
        return res.status(400).json({ error: `Transaction is already ${previousStatus}` });
      }

      const finalStatus = (normalizedNew === 'success' || normalizedNew === 'verified') ? 'VERIFIED' : 'REJECTED';

      await transactionRef.update({
        status: finalStatus,
        updatedAt: FieldValue.serverTimestamp(),
        manuallyProcessed: true,
        processedBy: (req as any).uid || 'system'
      });

      // Synchronize any duplicate records with matching transactionNumber
      if (transactionData.transactionNumber) {
        try {
          const dupesSnap = await db.collection('transactions')
            .where('transactionNumber', '==', transactionData.transactionNumber)
            .get();
          for (const dupeDoc of dupesSnap.docs) {
            if (dupeDoc.id !== transactionId) {
              await dupeDoc.ref.update({
                status: finalStatus,
                updatedAt: FieldValue.serverTimestamp(),
                manuallyProcessed: true,
                processedBy: (req as any).uid || 'system'
              });
            }
          }
        } catch (dupeSyncErr) {
          console.warn('Notice syncing duplicate transactions:', dupeSyncErr);
        }
      }

      if (finalStatus === 'VERIFIED') {
        await updateUserCredits(transactionData.userId, transactionData.amount, transactionId);
      }

      res.json({ success: true, message: `Transaction marked as ${status}` });
    } catch (error: any) {
      console.error('Manual Transaction Update Error:', error);
      res.status(500).json({ error: 'Failed to update transaction', details: error.message });
    }
  });



  // --- ELMS 2026 Integration Endpoints ---
  const elmsLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    message: { error: 'Too many ELMS integration requests.' },
  });

  // Ingest learning event from ELMS (server-to-server webhook)
  app.post('/api/elms/events', elmsLimiter, async (req, res) => {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      const authHeader = req.headers.authorization || '';
      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
      const { schoolId, eventId, idempotencyKey } = req.body;

      if (!schoolId || !eventId || !idempotencyKey) {
        return res.status(400).json({ error: 'Missing mandatory fields: schoolId, eventId, idempotencyKey' });
      }

      const { ElmsIntegrationService } = await import('./services/elmsIntegrationService.ts');
      await PersistentStateService.hydrateSchoolTenantState(schoolId);
      const isAuthorized = ElmsIntegrationService.validateServiceAuth(schoolId, apiKey, bearerToken);
      if (!isAuthorized) {
        return res.status(401).json({ error: 'Unauthorized ELMS integration request' });
      }

      const result = ElmsIntegrationService.ingestLearningEvent(req.body);
      await PersistentStateService.flushPendingWrites();
      res.json({ success: true, event: result.event, actionTaken: result.actionTaken });
    } catch (err: any) {
      console.error('[ELMS Events] Ingestion error:', err);
      res.status(500).json({ error: 'Failed to ingest ELMS event', details: err.message });
    }
  });

  // Get ELMS sync status
  app.get('/api/elms/status', verifyAuthToken, async (req: any, res: any) => {
    try {
      const schoolId = (req.query.schoolId as string) || 'lwps';
      const { ElmsIntegrationService } = await import('./services/elmsIntegrationService.ts');
      await PersistentStateService.hydrateSchoolTenantState(schoolId);
      const status = ElmsIntegrationService.getSyncStatus(schoolId);
      res.json({ success: true, status });
    } catch (err: any) {
      console.error('[ELMS Status] Error:', err);
      res.status(500).json({ error: 'Failed to fetch ELMS status', details: err.message });
    }
  });

  // Trigger ELMS reconciliation
  app.post('/api/elms/reconcile', verifyAuthToken, async (req: any, res: any) => {
    try {
      const { schoolId } = req.body;
      if (!schoolId) {
        return res.status(400).json({ error: 'Missing schoolId' });
      }
      const { ElmsIntegrationService } = await import('./services/elmsIntegrationService.ts');
      await PersistentStateService.hydrateSchoolTenantState(schoolId);
      const report = ElmsIntegrationService.reconcile(schoolId);
      await PersistentStateService.flushPendingWrites();
      res.json({ success: true, report });
    } catch (err: any) {
      console.error('[ELMS Reconcile] Error:', err);
      res.status(500).json({ error: 'Failed to reconcile ELMS integration', details: err.message });
    }
  });

  // --- Gemini Proxy Endpoint ---
  app.post('/api/generate', async (req, res) => {
    // 1. Verify Firebase ID token
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: 'Unauthorized' });

    let decodedToken: any = null;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { prompt, model, config, contentType, operationId, totalChunks } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    // 2. Atomically verify and reserve authoritative credits in Firestore BEFORE generation
    let creditReservation;
    try {
      creditReservation = await AuthoritativeAccountService.verifyAndReserveCredits(
        {
          uid: decodedToken.uid,
          endpoint: '/api/generate',
          contentType,
          operationId,
          totalChunks,
        },
        firestoreAdminAdapter
      );
    } catch (creditErr: any) {
      const msg = creditErr?.message || 'Credit verification failed';
      if (msg.includes('INSUFFICIENT_CREDITS')) {
        return res.status(402).json({ error: msg, code: 'INSUFFICIENT_CREDITS' });
      }
      if (msg.includes('ACCOUNT_NOT_INITIALIZED') || msg.includes('ACCOUNT_INACTIVE')) {
        return res.status(403).json({ error: msg, code: 'ACCOUNT_NOT_ELIGIBLE' });
      }
      return res.status(503).json({ error: 'Authoritative credit verification unavailable. Generation aborted.', details: msg });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const isImageRequest = (model && (model.includes('-image') || model.startsWith('imagen-'))) || (config && config.imageConfig);

    if (isImageRequest) {
      const imageModels = [
        model,
        'gemini-3.1-flash-lite-image',
        'imagen-4.0-generate-001'
      ].filter(m => m && (m.includes('-image') || m.startsWith('imagen-') || m.includes('gemini-')));
      const uniqueImageModels = Array.from(new Set(imageModels));
      let lastImgError: any = null;
      let response: any = null;

      for (const imgModel of uniqueImageModels) {
        let attempts = 2; // Minimize attempts to avoid HTTP timeouts
        for (let attempt = 1; attempt <= attempts; attempt++) {
          try {
            console.log(`[Generate API] Attempting image model: ${imgModel} (attempt ${attempt}/${attempts})`);
            response = await ai.models.generateContent({
              model: imgModel,
              contents: prompt,
              config,
            });
            break;
          } catch (err: any) {
            lastImgError = err;
            const status = err?.status || err?.response?.status;
            console.warn(`[Generate API] Image model ${imgModel} (attempt ${attempt}/${attempts}) failed. Error: ${err.message || err}`);
            if (status === 400 || status === 404 || err.message?.includes('not found') || err.message?.includes('invalid')) {
              console.warn(`[Generate API] Image model ${imgModel} failed with non-retriable error. Skipping...`);
              break;
            }
            if (attempt < attempts) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
        if (response) {
          break;
        }
      }

      // Fallback to Imagen if none of the banana models worked
      if (!response) {
        try {
          console.log(`[Generate API] Attempting final fallback with 'imagen-4.0-generate-001'`);

          let promptText = "";
          if (typeof prompt === 'string') {
            promptText = prompt;
          } else if (prompt && typeof prompt === 'object') {
            if (Array.isArray(prompt.parts)) {
              promptText = prompt.parts.map((p: any) => p.text || "").join(" ").trim();
            } else if (prompt.parts && typeof prompt.parts === 'object') {
              promptText = prompt.parts.text || "";
            } else if (Array.isArray(prompt)) {
               promptText = prompt.map((p: any) => typeof p === 'object' ? p.text || "" : String(p)).join(" ");
            }
          }

          if (!promptText) {
             promptText = "Educational illustration for Kenya Competency-Based Curriculum";
          }

          const imagenResponse = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: promptText,
            config: {
              numberOfImages: 1,
              aspectRatio: config?.imageConfig?.aspectRatio || '1:1',
              outputMimeType: 'image/png'
            }
          });

          if (imagenResponse?.generatedImages?.[0]?.image?.imageBytes) {
            const bytes = imagenResponse.generatedImages[0].image.imageBytes;
            response = {
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        inlineData: {
                          mimeType: "image/png",
                          data: bytes
                        }
                      }
                    ]
                  }
                }
              ]
            };
            console.log(`[Generate API] Successfully generated fallback image using 'imagen-4.0-generate-001'`);
          }
        } catch (imgnErr: any) {
          console.error(`[Generate API] Imagen fallback also failed:`, imgnErr);
          lastImgError = imgnErr;
        }
      }

      if (response) {
        await AuthoritativeAccountService.commitCreditReservation(
          decodedToken.uid,
          creditReservation.reservationId,
          firestoreAdminAdapter
        ).catch((e) => console.warn('[Generate API] Commit credit reservation warning:', e));
        return res.json({
          result: response,
          creditsRemaining: creditReservation.remainingCredits,
          costDeducted: creditReservation.costDeducted,
        });
      } else {
        console.error("[Generate API] All image generation channels failed:", lastImgError);
        const refundResult = await AuthoritativeAccountService.refundCreditReservation(
          decodedToken.uid,
          creditReservation.reservationId,
          'Image generation failed',
          firestoreAdminAdapter
        ).catch(() => ({ refunded: false, remainingCredits: creditReservation.remainingCredits }));
        return res.status(500).json({
          error: lastImgError?.message || String(lastImgError),
          creditsRefunded: refundResult.refunded,
          creditsRemaining: refundResult.remainingCredits,
        });
      }
    }

    // Text model rotation flow
    const textModels = [
      model,
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-flash-latest'
    ].filter(m => m && !m.includes('-image') && !m.startsWith('imagen-')) as string[];

    const uniqueModels = Array.from(new Set(textModels));
    let lastError: any = null;
    let response: any = null;

    for (const modelName of uniqueModels) {
      let attempts = 3;
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          console.log(`[Generate API] Attempting text model: ${modelName} (attempt ${attempt}/${attempts})`);
          response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config,
          });
          break; // Success
        } catch (err: any) {
          lastError = err;
          const status = err?.status || err?.response?.status;
          console.warn(`[Generate API] Text model ${modelName} (attempt ${attempt}/${attempts}) failed. Error: ${err.message || err}`);
          if (status === 400 || status === 404 || err.message?.includes('not found') || err.message?.includes('invalid')) {
            console.warn(`[Generate API] Text model ${modelName} failed with non-retriable error. Skipping...`);
            break;
          }
          if (attempt < attempts) {
            const delay = attempt * 800; // progressive backoff
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            console.warn(`[Generate API] Text model ${modelName} fully exhausted after ${attempts} attempts. Rotating...`);
          }
        }
      }
      if (response) {
        break; // Sucessfully generated with this model
      }
    }

    if (response) {
      await AuthoritativeAccountService.commitCreditReservation(
        decodedToken.uid,
        creditReservation.reservationId,
        firestoreAdminAdapter
      ).catch((e) => console.warn('[Generate API] Commit credit reservation warning:', e));
      res.json({
        result: response,
        creditsRemaining: creditReservation.remainingCredits,
        costDeducted: creditReservation.costDeducted,
      });
    } else {
      console.error("[Generate API] All rotated models failed:", lastError);
      const refundResult = await AuthoritativeAccountService.refundCreditReservation(
        decodedToken.uid,
        creditReservation.reservationId,
        'Text generation failed',
        firestoreAdminAdapter
      ).catch(() => ({ refunded: false, remainingCredits: creditReservation.remainingCredits }));
      const status = lastError?.status || lastError?.response?.status || 500;
      res.status(status).json({
        error: lastError?.message || String(lastError),
        creditsRefunded: refundResult.refunded,
        creditsRemaining: refundResult.remainingCredits,
      });
    }
  });

  // --- Gemini Streaming Proxy Endpoint ---
  app.post('/api/generate-stream', async (req, res) => {
    // 1. Verify Firebase ID token
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: 'Unauthorized' });

    let decodedToken: any = null;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { prompt, model, config, contentType, operationId, totalChunks } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    // 2. Atomically verify and reserve authoritative credits in Firestore BEFORE streaming generation
    let creditReservation;
    try {
      creditReservation = await AuthoritativeAccountService.verifyAndReserveCredits(
        {
          uid: decodedToken.uid,
          endpoint: '/api/generate-stream',
          contentType,
          operationId,
          totalChunks,
        },
        firestoreAdminAdapter
      );
    } catch (creditErr: any) {
      const msg = creditErr?.message || 'Credit verification failed';
      if (msg.includes('INSUFFICIENT_CREDITS')) {
        return res.status(402).json({ error: msg, code: 'INSUFFICIENT_CREDITS' });
      }
      if (msg.includes('ACCOUNT_NOT_INITIALIZED') || msg.includes('ACCOUNT_INACTIVE')) {
        return res.status(403).json({ error: msg, code: 'ACCOUNT_NOT_ELIGIBLE' });
      }
      return res.status(503).json({ error: 'Authoritative credit verification unavailable. Generation aborted.', details: msg });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const streamTextModels = [
      model,
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-flash-latest'
    ].filter(m => m && !m.includes('-image') && !m.startsWith('imagen-')) as string[];

    const uniqueModels = Array.from(new Set(streamTextModels));
    let lastError: any = null;
    let result: any = null;

    for (const modelName of uniqueModels) {
      let attempts = 3;
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          console.log(`[Stream API] Attempting stream with model: ${modelName} (attempt ${attempt}/${attempts})`);
          result = await ai.models.generateContentStream({
            model: modelName,
            contents: prompt,
            config,
          });
          break; // Success starting the stream
        } catch (err: any) {
          lastError = err;
          const status = err?.status || err?.response?.status;
          console.warn(`[Stream API] Stream on model ${modelName} (attempt ${attempt}/${attempts}) failed. Error: ${err.message || err}`);
          if (status === 400 || status === 404 || err.message?.includes('not found') || err.message?.includes('invalid')) {
            console.warn(`[Stream API] Text model ${modelName} failed with non-retriable error. Skipping...`);
            break;
          }
          if (attempt < attempts) {
            const delay = attempt * 800; // progressive backoff
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            console.warn(`[Stream API] Stream on model ${modelName} fully exhausted after ${attempts} attempts. Rotating...`);
          }
        }
      }
      if (result) {
        break; // Successfully started the stream
      }
    }

    if (result) {
      try {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        for await (const chunk of result) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        await AuthoritativeAccountService.commitCreditReservation(
          decodedToken.uid,
          creditReservation.reservationId,
          firestoreAdminAdapter
        ).catch((e) => console.warn('[Stream API] Commit credit reservation warning:', e));
        res.write('data: [DONE]\n\n');
        res.end();
      } catch (streamRunErr: any) {
        console.error('Streaming chunk consumption error:', streamRunErr);
        await AuthoritativeAccountService.refundCreditReservation(
          decodedToken.uid,
          creditReservation.reservationId,
          'Stream consumption failed',
          firestoreAdminAdapter
        ).catch(() => {});
        if (!res.headersSent) {
          res.status(500).json({ error: streamRunErr.message });
        } else {
          res.write(`data: ${JSON.stringify({ error: streamRunErr.message })}\n\n`);
          res.end();
        }
      }
    } else {
      console.error("[Stream API] All rotated stream models failed:", lastError);
      const refundResult = await AuthoritativeAccountService.refundCreditReservation(
        decodedToken.uid,
        creditReservation.reservationId,
        'Stream initialization failed',
        firestoreAdminAdapter
      ).catch(() => ({ refunded: false, remainingCredits: creditReservation.remainingCredits }));
      const status = lastError?.status || lastError?.response?.status || 500;
      res.status(status).json({
        error: lastError?.message || String(lastError),
        creditsRefunded: refundResult.refunded,
        creditsRemaining: refundResult.remainingCredits,
      });
    }
  });

  // --- Automated Vector Illustration & Diagram Generation Pipeline Endpoint ---
  app.post('/api/illustrations/generate', async (req, res) => {
    try {
      // 1. Verify Firebase ID token
      const authHeader = req.headers.authorization || '';
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!idToken) return res.status(401).json({ error: 'Unauthorized' });

      let decodedToken: any = null;
      try {
        console.log("[Illustration API] Authenticating...");
        decodedToken = await admin.auth().verifyIdToken(idToken);
        console.log("[Illustration API] Request received and authenticated");
      } catch {
        console.log("[Illustration API] Authentication failed");
        return res.status(401).json({ error: 'Invalid token' });
      }

      const { prompt: userPrompt, subject, topic, grade } = req.body;
      console.log("[Illustration API] Request Body:", { prompt: !!userPrompt, subject, topic, grade });
      if (!userPrompt) return res.status(400).json({ error: 'Missing prompt description' });

      // 2. Atomically verify and reserve authoritative credits in Firestore BEFORE illustration generation
      let creditReservation;
      try {
        creditReservation = await AuthoritativeAccountService.verifyAndReserveCredits(
          {
            uid: decodedToken.uid,
            endpoint: '/api/illustrations/generate',
            contentType: 'Illustration',
          },
          firestoreAdminAdapter
        );
      } catch (creditErr: any) {
        const msg = creditErr?.message || 'Credit verification failed';
        if (msg.includes('INSUFFICIENT_CREDITS')) {
          return res.status(402).json({ error: msg, code: 'INSUFFICIENT_CREDITS' });
        }
        if (msg.includes('ACCOUNT_NOT_INITIALIZED') || msg.includes('ACCOUNT_INACTIVE')) {
          return res.status(403).json({ error: msg, code: 'ACCOUNT_NOT_ELIGIBLE' });
        }
        return res.status(503).json({ error: 'Authoritative credit verification unavailable. Generation aborted.', details: msg });
      }

    // Rotating fallback models
    const modelsToTry = ['gemini-3.8-flash', 'gemini-2.5-flash'];
    let lastError: any = null;
    let responseObj: any = null;

    // Define the strict structured output schema using @google/genai Type
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        illustration_svg: {
          type: Type.STRING,
          description: "A complete, modern inline SVG string with viewBox '0 0 400 300'. Use sharp borders, colorful styled shapes, grid patterns, clear line alignments, and crisp text labels (styled using font-family='Inter' or 'sans-serif'). Strictly output valid standard pure SVG without markdown wrapping, and ensure everything is visible inside the 400x300 viewBox."
        }
      },
      required: ["illustration_svg"]
    };

    const sysInstruction = `You are Exameno ECG Assistant, a pro educational designer and senior curriculum illustrator.
    Your task is to generate beautiful, highly accurate, educational vectored illustrations and technical diagrams for Kenyan CBC/CBE School tests.

    GUIDELINES:
    - Subject: ${subject || 'Mathematics/Science'}
    - Topic: ${topic || 'General'}
    - Grade: ${grade || 'Junior School'}

    Core design requirements:
    1. Output MUST be an inline SVG inside the JSON structure: {"illustration_svg": "<svg...>...</svg>"}.
    2. Strictly conform to viewBox "0 0 400 300".
    3. The diagram MUST look professional: crisp lines, vibrant color-themed fills (like mint, electric blue, coral, or elegant charcoal black), 1px solid outlines where necessary. No empty white margins.
    4. Text labels: Use proper standard SVG <text> elements. ALWAYS style them tastefully (e.g. font-family="Inter" or "sans-serif", font-weight, dominant-baseline="middle", class, fill, opaque backgrounds if overlays, etc.) so they are completely readable and do not clash with vector lines. Avoid raw, unstyled text.
    5. Math specifics: neat coordinate axes with ticks, numbered increments, geometric triangles, fraction wedges/charts, scale diagrams, clean lines/labels.
    6. Science specifics: clearly labeled apparatus, arrows for forces, cell parts with colored membrane/nucleus, schematics, simple molecular links, resistor circuits.
    7. No XML declarations or HTML coding tags. Must render directly in inline HTML context. Use standard XML namespaces.`;

    // Try each model sequentially with AbortController timeout guard
    for (const modelName of modelsToTry) {
      const controller = new AbortController();
      const signal = controller.signal;
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 90000); // 90 seconds timeout guard

      try {
        console.log(`[Illustrations Pipeline] Attempting generation with model: ${modelName}. Prompt length: ${userPrompt.length}`);

        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY || '',
        });

        if (!process.env.GEMINI_API_KEY) {
          throw new Error('GEMINI_API_KEY is not defined');
        }

        const fetchPromise = ai.models.generateContent({
          model: modelName,
          contents: [{
            role: "user",
            parts: [{
              text: `Create a professional SVG vector diagram for: "${userPrompt}". Detail parameters: Subject: ${subject}, Topic: ${topic}, Grade: ${grade}. Ensure all elements are visible inside the 400x300 viewBox bounds and fully styled.`
            }]
          }],
          config: {
            responseMimeType: "application/json",
            responseSchema,
            systemInstruction: sysInstruction
          }
        });

        const timeoutPromise = new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            reject(new Error(`Timeout: Generation exceeded 90s on model ${modelName}`));
          });
        });

        // Race our API call against the timeout guard
        const response = await Promise.race([fetchPromise, timeoutPromise]) as any;
        clearTimeout(timeoutId);

        if (response && response.text) {
          let text = response.text.trim();
          // Strip markdown code blocks if the model insists on returning them
          text = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');

          let parsed;
          try {
            parsed = JSON.parse(text);
          } catch (jsonErr) {
            console.error("[Illustrations Pipeline] JSON parsing failed. Text sample:", text.substring(0, 100));
            throw new Error(`Failed to parse model output as JSON: ${jsonErr}`);
          }

          if (parsed && parsed.illustration_svg) {
            responseObj = parsed;
            console.log(`[Illustrations Pipeline] Successfully generated with model: ${modelName}`);
            break; // Exit rotating loop
          } else {
            console.warn("[Illustrations Pipeline] Parsed JSON missing 'illustration_svg'. Full parsed:", JSON.stringify(parsed));
          }
        }
        throw new Error("Invalid or empty response format received from model");
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err;
        console.error(`[Illustrations Pipeline] CRITICAL ERROR with model ${modelName}:`, {
          message: err.message,
          stack: err.stack,
          type: typeof err
        });
        console.warn(`[Illustrations Pipeline] Model ${modelName} failed. Rotating...`);
        // Automatic exponential / linear retry pause (back off) for 1 second before rotating
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (responseObj) {
      await AuthoritativeAccountService.commitCreditReservation(
        decodedToken.uid,
        creditReservation.reservationId,
        firestoreAdminAdapter
      ).catch((e) => console.warn('[Illustrations Pipeline] Commit credit reservation warning:', e));
      return res.json({
        ...responseObj,
        creditsRemaining: creditReservation.remainingCredits,
        costDeducted: creditReservation.costDeducted,
      });
    } else {
      console.error("[Illustrations Pipeline] All rotated models failed:", lastError);
      const refundResult = await AuthoritativeAccountService.refundCreditReservation(
        decodedToken.uid,
        creditReservation.reservationId,
        'Illustration generation failed',
        firestoreAdminAdapter
      ).catch(() => ({ refunded: false, remainingCredits: creditReservation.remainingCredits }));
      return res.status(502).json({
        error: "Failed to generate diagram after trying fallback rotating models",
        details: lastError?.message || String(lastError),
        creditsRefunded: refundResult.refunded,
        creditsRemaining: refundResult.remainingCredits,
      });
    }
  } catch (err: any) {
    console.error("[Illustrations Pipeline] Uncaught Exception:", err);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
  });

  // --- LIBRARY MERGED PDF EXPORT VERIFICATION & AUDIT ---
  app.post('/api/library/validate-merge-export', verifyAuthToken, async (req: any, res: any) => {
    try {
      const { userId, schoolId, resourceCount, resourceIds } = req.body;
      
      const authenticatedUserId = req.uid;
      if (!authenticatedUserId) {
        return res.status(401).json({ error: "Unauthorized: No valid user authentication found." });
      }

      // Verify supplied userId matches req.uid to protect owner boundaries
      if (userId && userId !== authenticatedUserId) {
        return res.status(403).json({ error: "Forbidden: You are not authorized to export another user's resources." });
      }

      const activeUserId = authenticatedUserId;

      const dbAdmin = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
        ? getFirestore(firebaseConfig.firestoreDatabaseId)
        : getFirestore();

      // Retrieve authenticated user's active memberships from Firestore to verify/derive schoolId context
      const membershipsSnap = await dbAdmin
        .collection('schoolMemberships')
        .where('userId', '==', activeUserId)
        .where('status', '==', 'ACTIVE')
        .get();

      const activeSchoolIds = membershipsSnap.docs.map(doc => doc.data().schoolId).filter(Boolean);

      let verifiedSchoolId = "";

      if (activeSchoolIds.length > 0) {
        if (schoolId) {
          // If a schoolId is supplied, verify the user actually belongs to it
          if (!activeSchoolIds.includes(schoolId)) {
            return res.status(403).json({ error: "Forbidden: You are not authorized for the requested school context." });
          }
          verifiedSchoolId = schoolId;
        } else {
          // Default to their primary active membership school context
          verifiedSchoolId = activeSchoolIds[0];
        }
      } else {
        // User has no active school memberships (independent learner)
        if (schoolId) {
          return res.status(403).json({ error: "Forbidden: You have no active school memberships to authorize this school context." });
        }
        verifiedSchoolId = "";
      }

      if (!resourceIds || !Array.isArray(resourceIds) || resourceIds.length === 0) {
        return res.status(400).json({ error: "Invalid request: At least one resource ID is required." });
      }

      // Check duplicates
      const uniqueIds = new Set(resourceIds);
      if (uniqueIds.size !== resourceIds.length) {
        return res.status(400).json({ error: "Invalid request: Duplicate resource IDs are not permitted." });
      }

      // Prevent oversized packages
      const MAX_PORTFOLIO_LIMIT = 50;
      if (resourceIds.length > MAX_PORTFOLIO_LIMIT) {
        return res.status(400).json({ error: `Invalid request: A portfolio cannot exceed a maximum of ${MAX_PORTFOLIO_LIMIT} resources.` });
      }

      if (resourceCount && resourceCount !== resourceIds.length) {
        return res.status(400).json({ error: "Invalid request: Resource count mismatch." });
      }

      // Verify resource ownership/existence in users/{userId}/library/{itemId}
      const verifiedTypes = new Set<string>();
      const verifiedGrades = new Set<string>();
      const verifiedSubjects = new Set<string>();
      const verifiedTerms = new Set<string>();

      for (const itemId of resourceIds) {
        if (typeof itemId !== 'string' || !itemId.trim()) {
          return res.status(400).json({ error: "Invalid request: Malformed resource ID detected." });
        }

        const itemSnap = await dbAdmin
          .collection('users')
          .doc(activeUserId)
          .collection('library')
          .doc(itemId.trim())
          .get();

        if (!itemSnap.exists) {
          console.warn(`[Export Audit] Resource ${itemId} not found in users/${activeUserId}/library`);
          return res.status(404).json({ error: "These resources could not be verified for export. Please refresh your library and try again." });
        }

        const itemData = itemSnap.data() || {};
        const cType = itemData.metadata?.contentType || itemData.contentType || 'unknown';
        const grade = itemData.metadata?.grade || itemData.grade || 'unknown';
        const subject = itemData.metadata?.subject || itemData.subject || 'unknown';
        const term = itemData.metadata?.term || (itemData.metadata?.terms ? itemData.metadata.terms[0] : '') || itemData.term || 'unknown';

        verifiedTypes.add(cType);
        verifiedGrades.add(grade);
        verifiedSubjects.add(subject);
        if (term) verifiedTerms.add(term);
      }

      // Record a lightweight audit log in `portfolio_exports` collection
      const auditRef = dbAdmin.collection('portfolio_exports').doc();
      const auditPayload = {
        id: auditRef.id,
        userId: activeUserId,
        schoolId: verifiedSchoolId,
        resourceIds: resourceIds,
        resourceCount: resourceIds.length,
        resourceTypes: Array.from(verifiedTypes),
        grades: Array.from(verifiedGrades),
        subjects: Array.from(verifiedSubjects),
        terms: Array.from(verifiedTerms),
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "AUTHORIZED",
        creditsConsumed: 0
      };

      try {
        await auditRef.set(auditPayload);
      } catch (auditErr) {
        console.error("[Export Audit] Failed to write portfolio export audit ledger record:", auditErr);
        return res.status(500).json({ error: "Internal error: Failed to record export audit trail. Generation aborted." });
      }

      console.log(`[Export Audit] Registered authorized portfolio export ${auditRef.id} for user ${activeUserId} (School: ${verifiedSchoolId || 'Individual'}).`);

      return res.json({
        authorized: true,
        auditId: auditRef.id,
        creditsConsumed: 0,
        message: "Resources validated and authorized for PDF packaging."
      });
    } catch (err: any) {
      console.error("[Export Audit] Error:", err);
      res.status(500).json({ error: "Internal error during export validation." });
    }
  });

  // --- SCHOOL ADMIN PORTFOLIO EXPORT LOGS ENDPOINT ---
  app.get('/api/admin/portfolio-exports', verifyAuthToken, async (req: any, res: any) => {
    try {
      const activeUserId = req.uid;
      if (!activeUserId) {
        return res.status(401).json({ error: "Unauthorized: No valid user authentication found." });
      }

      const dbAdmin = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
        ? getFirestore(firebaseConfig.firestoreDatabaseId)
        : getFirestore();

      // Retrieve authenticated user's active memberships from Firestore
      const membershipsSnap = await dbAdmin
        .collection('schoolMemberships')
        .where('userId', '==', activeUserId)
        .where('status', '==', 'ACTIVE')
        .get();

      // Filter for administrative roles (SCHOOL_ADMIN, SUPER_ADMIN, ACADEMIC_ADMIN)
      const adminMemberships = membershipsSnap.docs
        .map(doc => doc.data())
        .filter(m => m.role === 'SCHOOL_ADMIN' || m.role === 'SUPER_ADMIN' || m.role === 'ACADEMIC_ADMIN');

      if (adminMemberships.length === 0) {
        return res.status(403).json({ error: "Forbidden: You must have an active School Admin membership to access portfolio export logs." });
      }

      const activeAdminSchoolIds = adminMemberships.map(m => m.schoolId).filter(Boolean);

      // Derive authoritative schoolId context
      const requestedSchoolId = req.query.schoolId as string;
      let verifiedSchoolId = "";

      if (requestedSchoolId && requestedSchoolId.trim()) {
        if (!activeAdminSchoolIds.includes(requestedSchoolId.trim())) {
          return res.status(403).json({ error: "Forbidden: You are not authorized to view export logs for the requested school." });
        }
        verifiedSchoolId = requestedSchoolId.trim();
      } else {
        verifiedSchoolId = activeAdminSchoolIds[0];
      }

      // Date range parameters & validation
      const reqStartDate = req.query.startDate as string;
      const reqEndDate = req.query.endDate as string;
      const isReport = req.query.isReport === 'true' || req.query.isReport === '1';

      if (reqStartDate && reqEndDate && reqStartDate.trim() && reqEndDate.trim()) {
        const sMs = new Date(reqStartDate.includes('T') ? reqStartDate : `${reqStartDate}T00:00:00.000Z`).getTime();
        const eMs = new Date(reqEndDate.includes('T') ? reqEndDate : `${reqEndDate}T23:59:59.999Z`).getTime();
        if (!isNaN(sMs) && !isNaN(eMs) && sMs > eMs) {
          return res.status(400).json({ error: "startDate cannot be after endDate." });
        }
      }

      // Query portfolio_exports restricted to verifiedSchoolId
      let query: FirebaseFirestore.Query = dbAdmin
        .collection('portfolio_exports')
        .where('schoolId', '==', verifiedSchoolId);

      const reqTeacherId = req.query.teacherId as string;
      if (reqTeacherId && reqTeacherId.trim()) {
        query = query.where('userId', '==', reqTeacherId.trim());
      }

      query = query.orderBy('generatedAt', 'desc');

      const defaultLimit = isReport ? 1000 : 20;
      const maxLimit = isReport ? 1000 : 50;
      const parsedLimit = parseInt(req.query.limit as string, 10);
      const limitNum = Math.min(Math.max(isNaN(parsedLimit) ? defaultLimit : parsedLimit, 1), maxLimit);
      query = query.limit(limitNum);

      const exportsSnap = await query.get();
      const isTruncated = exportsSnap.docs.length >= limitNum;

      // Batch resolve teacher names to avoid N+1 queries
      const userIds = Array.from(new Set(exportsSnap.docs.map(doc => doc.data().userId).filter(Boolean)));
      const teacherNameMap = new Map<string, string>();

      if (userIds.length > 0) {
        const userRefs = userIds.map(uid => dbAdmin.collection('users').doc(uid));
        const userSnaps = await dbAdmin.getAll(...userRefs);
        userSnaps.forEach(snap => {
          if (snap.exists) {
            const data = snap.data() || {};
            const name = data.displayName || data.name || (data.email ? data.email.split('@')[0] : 'Teacher');
            teacherNameMap.set(snap.id, name);
          }
        });
      }

      const reqContentType = req.query.contentType as string;
      const reqGrade = req.query.grade as string;

      let logs = exportsSnap.docs.map(doc => {
        const data = doc.data();
        const rawDate = data.generatedAt?.toDate ? data.generatedAt.toDate().toISOString() : (data.generatedAt || new Date().toISOString());
        return {
          id: doc.id,
          teacherName: teacherNameMap.get(data.userId) || 'Unknown Teacher',
          schoolId: data.schoolId || '',
          resourceCount: data.resourceCount || (data.resourceIds ? data.resourceIds.length : 0),
          resourceTypes: data.resourceTypes || [],
          grades: data.grades || [],
          subjects: data.subjects || [],
          terms: data.terms || [],
          generatedAt: rawDate,
          status: "Authorized Export",
          creditsConsumed: 0
        };
      });

      // In-memory secondary filtering for content type & grade if specified
      if (reqContentType && reqContentType.trim()) {
        const targetType = reqContentType.trim().toLowerCase();
        logs = logs.filter(l => l.resourceTypes.some((t: string) => t.toLowerCase() === targetType));
      }

      if (reqGrade && reqGrade.trim()) {
        const targetGrade = reqGrade.trim().toLowerCase();
        logs = logs.filter(l => l.grades.some((g: string) => g.toLowerCase() === targetGrade));
      }

      if (reqStartDate && reqStartDate.trim()) {
        const startMs = new Date(reqStartDate.includes('T') ? reqStartDate : `${reqStartDate}T00:00:00.000Z`).getTime();
        if (!isNaN(startMs)) {
          logs = logs.filter(l => new Date(l.generatedAt).getTime() >= startMs);
        }
      }

      if (reqEndDate && reqEndDate.trim()) {
        const endMs = new Date(reqEndDate.includes('T') ? reqEndDate : `${reqEndDate}T23:59:59.999Z`).getTime();
        if (!isNaN(endMs)) {
          logs = logs.filter(l => new Date(l.generatedAt).getTime() <= endMs);
        }
      }

      return res.json({
        schoolId: verifiedSchoolId,
        totalReturned: logs.length,
        isTruncated: isTruncated,
        maxLimit: limitNum,
        truncationNotice: isTruncated ? "Report query reached maximum server limit of 1,000 records. Filter by a narrower date range or specific term for full results." : undefined,
        logs: logs
      });
    } catch (err: any) {
      console.error("[School Admin Export Logs] Error:", err);
      res.status(500).json({ error: "Internal error during export logs retrieval." });
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');

    // Serve static files with custom Cache-Control headers to avoid SW/manifest/index.html caching
    app.use(express.static(distPath, {
      setHeaders: (res, filepath) => {
        const basename = path.basename(filepath);
        if (basename === 'sw.js' || basename === 'manifest.json' || basename === 'index.html') {
          // Force no-cache for core PWA and HTML entry files to ensure immediate updates upon deployment
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else {
          // Cache fingerprinted assets (Vite js/css with content hashes) for 1 year
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));

    app.get('*all', (req, res) => {
      // Force no-cache for index.html fallback
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    seedSettings()
      .then(() => {
        console.log('Settings seeding completed.');
      })
      .catch((err) => {
        console.error('Background settings seeding failed:', err);
      });
  });
}

startServer();
