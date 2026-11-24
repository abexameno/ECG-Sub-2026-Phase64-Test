import React from 'react';

// This function will parse a single line of markdown into React nodes for inline formatting.
export function parseInlineMarkdownToReact(text: string | null | undefined): React.ReactNode[] {
    const safeText = text || '';
    const children: React.ReactNode[] = [];
    const regex = /(\*\*.*?\*\*)|(\*.*?\*)|(<u>.*?<\/u>)/g;
    let lastIndex = 0;
    let key = 0;

    let match;
    while ((match = regex.exec(safeText)) !== null) {
        if (match.index > lastIndex) {
            children.push(safeText.substring(lastIndex, match.index));
        }
        if (match[1]) {
            children.push(React.createElement('strong', { key: `match-${key++}` }, match[1].slice(2, -2)));
        }
        else if (match[2]) {
            children.push(React.createElement('em', { key: `match-${key++}` }, match[2].slice(1, -1)));
        }
        else if (match[3]) {
             children.push(React.createElement('u', { key: `match-${key++}` }, match[3].slice(3, -4)));
        }
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < safeText.length) {
        children.push(safeText.substring(lastIndex));
    }
    
    return children;
}

// This function will parse a single line of markdown into an array of docx.TextRun objects.
export function parseInlineMarkdownToDocx(text: string | null | undefined, docx: any): any[] {
    const { TextRun, UnderlineType } = docx;
    const safeText = (text || '').replace(/[#]/g, ''); // Explicitly strip header symbols too
    const children: any[] = [];
    const regex = /(\*\*.*?\*\*)|(\*.*?\*)|(<u>.*?<\/u>)/g;
    let lastIndex = 0;

    let match;
    while ((match = regex.exec(safeText)) !== null) {
        if (match.index > lastIndex) {
            children.push(new TextRun(safeText.substring(lastIndex, match.index)));
        }
        if (match[1]) {
            children.push(new TextRun({ text: match[1].slice(2, -2), bold: true }));
        }
        else if (match[2]) {
            children.push(new TextRun({ text: match[2].slice(1, -1), italics: true }));
        }
        else if (match[3]) {
            const innerText = match[3].slice(3, -4);
            const isBold = innerText.startsWith('**') && innerText.endsWith('**');
            const cleanText = isBold ? innerText.slice(2, -2) : innerText;
            
            children.push(new TextRun({ 
                text: cleanText, 
                underline: { type: UnderlineType.SINGLE, color: "000000" },
                bold: isBold
            }));
        }
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < safeText.length) {
        children.push(new TextRun(safeText.substring(lastIndex)));
    }

    if (children.length === 0) {
        return [new TextRun(safeText)];
    }
    
    return children;
}