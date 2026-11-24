import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';
import { GeneratedContent } from '../types';
import { waitForGlobal } from '../utils/waitForGlobal';

// Declare global variables for Google APIs
declare const gapi: any;
declare const google: any;

export interface DriveFile {
  id: string;
  name: string;
  content?: string; // Text content if applicable
  mimeType: string;
  url: string;
}

let tokenClient: any;
let accessToken: string | null = null;
let pickerInited = false;
let gisInited = false;

// Scopes required to read and write files
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];

/**
 * Gets the current cached access token.
 */
export const getAccessToken = (): string | null => {
  return accessToken;
};

/**
 * Sets the current cached access token.
 */
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

/**
 * Authenticates with Google to get an access token for Drive API.
 * Uses Firebase popup with the drive.file scope.
 */
export const connectToGoogleDrive = async (): Promise<string> => {
  const provider = new GoogleAuthProvider();
  // Request Google Drive access to create and manage backup files
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google Drive access token from authentication.');
    }
    
    accessToken = credential.accessToken;
    return accessToken;
  } catch (error: any) {
    console.error('Error connecting to Google Drive:', error);
    throw error;
  }
};

/**
 * Formats GeneratedContent metadata and body into beautiful Markdown.
 */
export const formatContentToMarkdown = (content: GeneratedContent): string => {
  let md = `# ${content.title || 'Untitled Document'}\n\n`;
  
  if (content.metadata) {
    md += `## Metadata\n`;
    md += `- **Grade:** ${content.metadata.grade || 'N/A'}\n`;
    md += `- **Subject:** ${content.metadata.subject || 'N/A'}\n`;
    md += `- **Content Type:** ${content.metadata.contentType || 'N/A'}\n`;
    if (content.metadata.topic) {
      md += `- **Topic:** ${content.metadata.topic}\n`;
    }
    if (content.metadata.term) {
      md += `- **Term:** ${content.metadata.term}\n`;
    }
    if (content.savedAt) {
      md += `- **Saved At:** ${new Date(content.savedAt).toLocaleString('en-GB')}\n`;
    }
    md += `\n---\n\n`;
  }

  if (content.body) {
    md += content.body;
  } else if (content.schemeOfWorkData) {
    md += `## Scheme of Work\n\n`;
    md += `**Term:** ${content.schemeOfWorkData.term || 'N/A'}  \n\n`;
    md += `| Week | Lesson | Strand | Sub-Strand | Specific Learning Outcomes | Key Inquiry Questions | Learning Experiences | Learning Resources | Assessment | Remarks |\n`;
    md += `|---|---|---|---|---|---|---|---|---|---|\n`;
    
    const entries = content.schemeOfWorkData.entries || [];
    entries.forEach(e => {
      const outcomesVal = e.learningOutcomes || (e as any).specificLearningOutcomes || (e as any).learningOutcomesText || '';
      const inquiryVal = e.inquiryQuestions || (e as any).keyInquiryQuestions || '';
      const experiencesVal = e.learningExperiences || (e as any).content || (e as any).learningExperience || '';
      const resourcesVal = e.learningResources || (e as any).resources || '';
      const assessmentVal = e.assessment || (e as any).assessmentMethods || '';
      const remarksVal = e.remarks || '';
      const strandVal = e.strand || (e as any).strandTitle || '';
      const subStrandVal = e.subStrand || (e as any).subStrandTitle || '';

      const outcomes = outcomesVal.replace(/\n/g, '<br>');
      const questions = inquiryVal.replace(/\n/g, '<br>');
      const experiences = experiencesVal.replace(/\n/g, '<br>');
      const resources = resourcesVal.replace(/\n/g, '<br>');
      
      md += `| ${e.week || ''} | ${e.lesson || ''} | ${strandVal} | ${subStrandVal} | ${outcomes} | ${questions} | ${experiences} | ${resources} | ${assessmentVal} | ${remarksVal} |\n`;
    });
  } else if (content.rowcData) {
    md += `## Record of Work Covered\n\n`;
    md += `| Date | Grade | Subject | Lesson Title | Learning Activities | Resources | Assessment | Remarks |\n`;
    md += `|---|---|---|---|---|---|---|---|\n`;
    
    const lessons = content.rowcData.lessons || [];
    lessons.forEach(l => {
      const activities = (l.learningActivities || '').replace(/\n/g, '<br>');
      const remarks = (l.remarks || '').replace(/\n/g, '<br>');
      
      md += `| ${l.date || ''} | ${l.grade || ''} | ${l.subject || ''} | ${l.lessonTitle || ''} | ${activities} | ${l.resources || ''} | ${l.assessment || ''} | ${remarks} |\n`;
    });
  } else if (content.questions) {
    md += `## Assessment Questions\n\n`;
    content.questions.forEach((q, index) => {
      md += `### Question ${index + 1} (${q.marks || 1} Marks)\n\n`;
      md += `${q.questionText}\n\n`;
      if (q.options && q.options.length > 0) {
        q.options.forEach((opt, i) => {
          md += `${String.fromCharCode(65 + i)}) ${opt}\n`;
        });
        md += `\n`;
      }
      md += `**Correct Answer:** ${q.correctAnswer}\n\n`;
      if (q.explanation) {
        md += `**Explanation:** ${q.explanation}\n\n`;
      }
    });
  }

  if (content.rubric) {
    md += `\n---\n\n## Grading Rubric\n\n${content.rubric}`;
  }

  // Add footer credit
  md += `\n\n---\n*Backup generated automatically by Exameno CBE Content Generator (ECG) on ${new Date().toLocaleDateString('en-GB')}*`;

  return md;
};

/**
 * Finds or creates a folder named 'Exameno' in Google Drive root.
 */
export const findOrCreateExamenoFolder = async (token: string): Promise<string> => {
  try {
    // Search for existing Exameno folder
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='Exameno' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`;
    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!searchResponse.ok) {
      throw new Error(`Failed to query Google Drive directories. Status: ${searchResponse.status}`);
    }
    
    const searchData = await searchResponse.json();
    let folderId = searchData.files?.[0]?.id;
    
    if (!folderId) {
      // Create new folder
      const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Exameno',
          mimeType: 'application/vnd.google-apps.folder'
        })
      });
      
      if (!createResponse.ok) {
        throw new Error(`Failed to create 'Exameno' directory in Google Drive.`);
      }
      
      const folderData = await createResponse.json();
      folderId = folderData.id;
    }
    
    return folderId;
  } catch (error: any) {
    console.error('Error in findOrCreateExamenoFolder:', error);
    throw error;
  }
};

/**
 * Backs up a single content item to Google Drive 'Exameno' folder.
 * If file already exists with same name, updates it. Otherwise, creates it.
 */
export const backupItemToDrive = async (content: GeneratedContent, token: string): Promise<string> => {
  try {
    const folderId = await findOrCreateExamenoFolder(token);
    
    // Determine filename
    const sanitizedTitle = (content.title || 'Untitled_Content').replace(/[/\\?%*:|"<>\s]/g, '_');
    const contentTypeIndicator = content.metadata?.contentType ? `_${content.metadata.contentType}` : '';
    const fileName = `${sanitizedTitle}${contentTypeIndicator}.md`;
    
    const fileContent = formatContentToMarkdown(content);
    
    // Search for existing file
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(fileName)}' and '${folderId}' in parents and trashed=false&fields=files(id)`;
    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    let existingFileId: string | null = null;
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      existingFileId = searchData.files?.[0]?.id || null;
    }
    
    if (existingFileId) {
      // Update existing file content
      const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`;
      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'text/markdown; charset=UTF-8'
        },
        body: fileContent
      });
      
      if (!updateResponse.ok) {
        throw new Error(`Failed to update file in Google Drive. Status: ${updateResponse.status}`);
      }
      
      return existingFileId;
    } else {
      // Create new file via Multipart Upload
      const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
      const boundary = '314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const close_delim = `\r\n--${boundary}--`;
      
      const metadata = {
        name: fileName,
        mimeType: 'text/markdown',
        parents: [folderId]
      };
      
      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: text/markdown; charset=UTF-8\r\n\r\n' +
        fileContent +
        close_delim;
        
      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartRequestBody
      });
      
      if (!createResponse.ok) {
        throw new Error(`Failed to create file in Google Drive. Status: ${createResponse.status}`);
      }
      
      const fileData = await createResponse.json();
      return fileData.id;
    }
  } catch (error: any) {
    console.error(`Error backing up item ${content.title} to Google Drive:`, error);
    throw error;
  }
};

/**
 * Backs up all library items to Google Drive.
 */
export const backupAllToDrive = async (
  library: GeneratedContent[],
  token: string,
  onProgress?: (backedUp: number, total: number) => void
): Promise<number> => {
  if (library.length === 0) return 0;
  
  let successCount = 0;
  for (let i = 0; i < library.length; i++) {
    try {
      await backupItemToDrive(library[i], token);
      successCount++;
    } catch (e) {
      console.error(`Failed to backup item: ${library[i].title}`, e);
    }
    
    if (onProgress) {
      onProgress(i + 1, library.length);
    }
  }
  
  return successCount;
};

/**
 * Backs up the App Backup JSON data directly to the Google Drive 'Exameno' folder.
 */
export const backupAppBackupJSONToDrive = async (
  backupData: any,
  token: string,
  fileName: string
): Promise<string> => {
  try {
    const folderId = await findOrCreateExamenoFolder(token);
    const fileContent = JSON.stringify(backupData, null, 2);
    
    // Search for existing file with the same name
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(fileName)}' and '${folderId}' in parents and trashed=false&fields=files(id)`;
    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    let existingFileId: string | null = null;
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      existingFileId = searchData.files?.[0]?.id || null;
    }
    
    if (existingFileId) {
      // Update existing file content
      const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`;
      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8'
        },
        body: fileContent
      });
      
      if (!updateResponse.ok) {
        throw new Error(`Failed to update backup file in Google Drive. Status: ${updateResponse.status}`);
      }
      
      return existingFileId;
    } else {
      // Create new file via Multipart Upload
      const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
      const boundary = '314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const close_delim = `\r\n--${boundary}--`;
      
      const metadata = {
        name: fileName,
        mimeType: 'application/json',
        parents: [folderId]
      };
      
      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        fileContent +
        close_delim;
        
      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartRequestBody
      });
      
      if (!createResponse.ok) {
        throw new Error(`Failed to create backup file in Google Drive. Status: ${createResponse.status}`);
      }
      
      const fileData = await createResponse.json();
      return fileData.id;
    }
  } catch (error: any) {
    console.error(`Error backing up App JSON to Google Drive:`, error);
    throw error;
  }
};

/**
 * Initializes the Google API Client and Picker API.
 */
export const initGoogleDrive = async (apiKey: string, clientId: string) => {
  await loadScript('https://apis.google.com/js/api.js');
  await loadScript('https://accounts.google.com/gsi/client');

  await new Promise<void>((resolve) => {
    gapi.load('client:picker', async () => {
      // Ensure gapi client is initialized with apiKey for Picker to work
      await gapi.client.init({
        apiKey: apiKey,
        discoveryDocs: DISCOVERY_DOCS,
      });
      pickerInited = true;
      resolve();
    });
  });

  // Initialize the new Identity Services client
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    ux_mode: 'popup',
    callback: '', // Defined at request time
  });
  gisInited = true;
};

/**
 * Opens the Google Drive Picker.
 */
export const openDrivePicker = async (
  apiKey: string,
  clientId: string,
  folderId: string | undefined,
  onSelect: (file: DriveFile) => void
) => {
  if (!pickerInited || !gisInited) {
    await initGoogleDrive(apiKey, clientId);
  }

  tokenClient.callback = async (response: any) => {
    if (response.error !== undefined) {
      throw (response);
    }
    accessToken = response.access_token;
    createPicker(apiKey, accessToken, folderId, onSelect);
  };

  if (accessToken === null) {
    tokenClient.requestAccessToken({ prompt: '' });
  } else {
    tokenClient.requestAccessToken({ prompt: '' });
  }
};

const createPicker = (apiKey: string, token: string | null, folderId: string | undefined, onSelect: (file: DriveFile) => void) => {
  if (pickerInited && token) {
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS);
    view.setMimeTypes("text/plain,application/pdf,application/vnd.google-apps.document,application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    
    if (folderId) {
        view.setParent(folderId); 
    }

    const picker = new google.picker.PickerBuilder()
      .enableFeature(google.picker.Feature.NAV_HIDDEN)
      .setDeveloperKey(apiKey)
      .setAppId((typeof process !== 'undefined' && process.env?.GOOGLE_PROJECT_ID) || '')
      .setOAuthToken(token)
      .addView(view)
      .addView(new google.picker.DocsView(google.picker.ViewId.FOLDERS))
      .setCallback((data: any) => pickerCallback(data, onSelect, token))
      .build();
    picker.setVisible(true);
  }
};

const pickerCallback = async (data: any, onSelect: (file: DriveFile) => void, token: string) => {
  if (data[google.picker.Response.ACTION] === google.picker.Action.PICKED) {
    const doc = data[google.picker.Response.DOCUMENTS][0];
    const fileId = doc[google.picker.Document.ID];
    const fileName = doc[google.picker.Document.NAME];
    const mimeType = doc[google.picker.Document.MIME_TYPE];
    const url = doc[google.picker.Document.URL];

    let content = '';

    if (mimeType === 'application/vnd.google-apps.document' || mimeType === 'text/plain') {
        try {
             const exportMime = mimeType === 'application/vnd.google-apps.document' ? 'text/plain' : undefined;
             const fetchUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/${exportMime ? 'export?mimeType=' + exportMime : '?alt=media'}`;
             
             const response = await fetch(fetchUrl, {
                 headers: { Authorization: `Bearer ${token}` }
             });
             if (response.ok) {
                 content = await response.text();
             }
        } catch (e) {
            console.error("Error fetching file content", e);
        }
    }

    onSelect({ id: fileId, name: fileName, mimeType, url, content });
  }
};

// Helper to load script dynamically
const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script ${src}`));
    document.body.appendChild(script);
  });
};
