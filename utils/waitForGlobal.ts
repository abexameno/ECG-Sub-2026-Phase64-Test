export function waitForGlobal<T = any>(globalName: string, timeout = 45000, interval = 200): Promise<T> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const checkGlobal = () => {
      const globalVar = (window as any)[globalName];
      
      let isInitialized = false;
      let debugInfo = `Checking '${globalName}'...`;

      if (globalVar !== undefined && globalVar !== null) {
        if (globalName === 'pdfMake') {
          isInitialized = !!globalVar.vfs && Object.keys(globalVar.vfs).length > 0;
        } else if (globalName === 'docx') {
          isInitialized = !!globalVar.Document && !!globalVar.Packer;
        } else if (globalName === 'XLSX') {
          isInitialized = !!globalVar.utils && !!globalVar.write;
        } else if (globalName === 'PptxGenJS') {
            isInitialized = typeof globalVar === 'function';
        } else if (globalName === 'pdfjsLib') {
            isInitialized = !!globalVar.getDocument;
        } else {
          isInitialized = true;
        }
      }

      if (isInitialized) {
        resolve(globalVar as T);
      } else if (Date.now() - startTime >= timeout) {
        reject(new Error(`Timed out waiting for '${globalName}' to initialize. Please check your network connection.`));
      } else {
        setTimeout(checkGlobal, interval);
      }
    };
    checkGlobal();
  });
}