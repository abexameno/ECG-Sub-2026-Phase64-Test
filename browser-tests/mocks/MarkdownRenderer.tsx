import React from 'react';
const MarkdownRenderer: React.FC<{ markdown?: string | null; className?: string }> = ({ markdown }) => <span>{markdown || ''}</span>;
export default MarkdownRenderer;
