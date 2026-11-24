
import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  markdown: string | null | undefined;
  className?: string;
  isTableContent?: boolean;
}

declare const renderMathInElement: any;

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ markdown, className, isTableContent = false }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const safeMarkdown = markdown || '';

  const textColorClass = '!text-black';

  useEffect(() => {
    if (rootRef.current && typeof renderMathInElement === 'function') {
      renderMathInElement(rootRef.current, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
        ],
        throwOnError: false
      });
    }
  }, [safeMarkdown]);

  return (
    <div ref={rootRef} className={`prose max-w-none ${textColorClass} ${className || ''} prose-headings:text-black prose-p:text-black prose-li:text-black`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {safeMarkdown}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
