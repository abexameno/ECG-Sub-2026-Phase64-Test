import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  resolve: {
    alias: [
      { find: path.resolve(root, 'components/ExportControls.tsx'), replacement: path.resolve(root, 'browser-tests/mocks/ExportControls.tsx') },
      { find: path.resolve(root, 'utils/MarkdownRenderer.tsx'), replacement: path.resolve(root, 'browser-tests/mocks/MarkdownRenderer.tsx') },
      { find: path.resolve(root, 'services/geminiService.ts'), replacement: path.resolve(root, 'browser-tests/mocks/geminiService.ts') },
      { find: path.resolve(root, 'services/curriculumAlignmentService.ts'), replacement: path.resolve(root, 'browser-tests/mocks/curriculumAlignmentService.ts') },
      { find: path.resolve(root, 'components/ImageEditorModal.tsx'), replacement: path.resolve(root, 'browser-tests/mocks/ImageEditorModal.tsx') },
      { find: path.resolve(root, 'components/AssessmentElmsPublishingPanel.tsx'), replacement: path.resolve(root, 'browser-tests/mocks/AssessmentElmsPublishingPanel.tsx') },
      { find: path.resolve(root, 'lib/utils.ts'), replacement: path.resolve(root, 'browser-tests/mocks/utils.ts') },
    ],
  },
  server: { host: '127.0.0.1', port: 4174, strictPort: true },
});
