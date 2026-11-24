import { waitForGlobal } from '../utils/waitForGlobal.ts';

declare const pdfjsLib: any;
declare const mammoth: any;

export interface PositionedPdfTextItem {
    text: string;
    x: number;
    y: number;
}

/**
 * Reconstructs a table grid from PDF text coordinates. Unlike inserting tabs only
 * when a gap is wide, this keeps empty cells in place on wrapped rows, preventing
 * continuation text from shifting into the Week/Lesson columns.
 */
export function reconstructPositionedPdfPage(positioned: PositionedPdfTextItem[], inheritedAnchors: number[] = []): { text: string; columnAnchors: number[] } {
    const rows: Array<{ y: number; items: PositionedPdfTextItem[] }> = [];
    positioned.forEach(item => {
        let row = rows.find(candidate => Math.abs(candidate.y - item.y) <= 2.5);
        if (!row) { row = { y: item.y, items: [] }; rows.push(row); }
        row.items.push(item);
    });
    rows.sort((a, b) => a.y - b.y);

    const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    let headerIndex = -1;
    for (let index = 0; index < Math.min(rows.length - 1, 100); index++) {
        const nearby = [...rows[index].items, ...rows[index + 1].items].map(item => item.text).join(' ');
        const normalized = normalizeHeader(nearby);
        if (/strand/.test(normalized) && /specific/.test(normalized) && /key/.test(normalized) && /assessment/.test(normalized)) {
            headerIndex = index;
            break;
        }
    }

    const simpleLines = rows.map(row => {
        const items = row.items.sort((a, b) => a.x - b.x);
        let line = '';
        let previousRight = Number.NaN;
        items.forEach((item, index) => {
            const gap = index === 0 ? 0 : item.x - previousRight;
            line += (index === 0 ? '' : gap > 12 ? '\t' : ' ') + item.text;
            previousRight = item.x + Math.max(item.text.length * 4, 8);
        });
        return line;
    });
    if (headerIndex < 0 && inheritedAnchors.length < 5) return { text: simpleLines.join('\n'), columnAnchors: inheritedAnchors };

    const headerItems = headerIndex >= 0 ? [...rows[headerIndex].items, ...rows[headerIndex + 1].items].sort((a, b) => a.x - b.x) : [];
    const firstItem = (predicate: (text: string) => boolean, after = Number.NEGATIVE_INFINITY) =>
        headerItems.find(item => item.x > after && predicate(normalizeHeader(item.text)));
    const anchors: number[] = headerIndex < 0 ? [...inheritedAnchors] : [];
    const add = (item?: PositionedPdfTextItem) => { if (item && !anchors.some(x => Math.abs(x - item.x) < 3)) anchors.push(item.x); };
    if (headerIndex >= 0) {
        // Week and lesson are the first two compact headings in school SOW tables.
        const xGroups: PositionedPdfTextItem[][] = [];
        headerItems.forEach(item => {
            const group = xGroups.find(candidate => Math.abs(candidate[0].x - item.x) <= 8);
            if (group) group.push(item); else xGroups.push([item]);
        });
        const firstTwoGroups = xGroups.sort((a, b) => a[0].x - b[0].x).slice(0, 2);
        add(firstTwoGroups[0]?.[0]);
        add(firstTwoGroups[1]?.[0]);
        add(firstItem(text => text === 'strand'));
        add(firstItem(text => text.startsWith('sub')));
        add(firstItem(text => text.startsWith('specific')));
        add(firstItem(text => text === 'key' || text.startsWith('key inquiry')));
        const experience = firstItem(text => text === 'learning' || text.startsWith('learning experiences'), anchors[anchors.length - 1] ?? Number.NEGATIVE_INFINITY);
        add(experience);
        const resources = firstItem(text => text === 'learning' || text.startsWith('learning resources'), anchors[anchors.length - 1] ?? Number.NEGATIVE_INFINITY);
        add(resources);
        add(firstItem(text => text.startsWith('assessment')));
        add(firstItem(text => text.startsWith('ref') || text.startsWith('remarks')));
        anchors.sort((a, b) => a - b);
    }
    if (anchors.length < 5) return { text: simpleLines.join('\n'), columnAnchors: inheritedAnchors };

    const toGridRow = (items: PositionedPdfTextItem[]) => {
        const cells = Array.from({ length: anchors.length }, () => [] as string[]);
        items.forEach(item => {
            let column = anchors.length - 1;
            const boundedColumn = anchors.findIndex((anchor, index) =>
                item.x >= anchor - 18 && (index === anchors.length - 1 || item.x < anchors[index + 1] - 20)
            );
            if (boundedColumn >= 0) column = boundedColumn;
            else {
                let bestDistance = Number.POSITIVE_INFINITY;
                anchors.forEach((anchor, index) => {
                    const distance = Math.abs(item.x - anchor);
                    if (distance < bestDistance) { bestDistance = distance; column = index; }
                });
            }
            cells[column].push(item.text);
        });
        return cells.map(cell => cell.join(' ').trim()).join('\t');
    };
    if (headerIndex < 0) {
        return { text: rows.map(row => toGridRow(row.items)).join('\n'), columnAnchors: anchors };
    }
    const header = toGridRow(headerItems);
    const dataRows = rows.slice(headerIndex + 2).map(row => toGridRow(row.items));
    return { text: [...simpleLines.slice(0, headerIndex), header, ...dataRows].join('\n'), columnAnchors: anchors };
}

/**
 * Extracts text content from a PDF file.
 * @param file The PDF file object.
 * @returns A promise resolving to the extracted text.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
    try {
        await waitForGlobal('pdfjsLib');
        const arrayBuffer = await file.arrayBuffer();
        
        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        let sowColumnAnchors: number[] = [];
        const totalPages = pdf.numPages;

        // Iterate through all pages, preserving the source page number and using
        // coordinate-aware grid reconstruction for tabular SOW documents.
        for (let i = 1; i <= totalPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const positioned = (textContent.items as any[])
                .filter(item => typeof item.str === 'string' && item.str.trim())
                .map(item => ({
                    text: item.str.trim(),
                    x: Number(item.transform?.[4] ?? 0),
                    y: Number(item.transform?.[5] ?? 0),
                }));
            const reconstructed = reconstructPositionedPdfPage(positioned, sowColumnAnchors);
            if (reconstructed.columnAnchors.length >= 5) sowColumnAnchors = reconstructed.columnAnchors;
            fullText += `\n--- Page ${i} ---\n${reconstructed.text}\n`;
        }

        const extracted = fullText.trim();
        // Image-only/scanned PDFs have pages but no selectable text. Do not pass an
        // empty string into the SOW parser, where it could be mistaken for a valid import.
        const visibleText = extracted.replace(/--- Page \d+ ---/g, '').replace(/[\s|\t]/g, '');
        const meaningfulCharacters = visibleText.replace(/[^\p{L}\p{N}]/gu, '');
        if (meaningfulCharacters.length < 20) {
            throw new Error('This PDF appears to be scanned or image-only. OCR is required before its lesson table can be imported. Please upload a text-searchable PDF or DOCX, or provide an OCR-processed copy.');
        }
        return extracted;
    } catch (error) {
        if (error instanceof Error && /OCR is required/.test(error.message)) throw error;
        console.error("Error extracting text from PDF:", error);
        throw new Error("Failed to extract text from PDF. Please ensure the file is not password protected.");
    }
}

/**
 * Extracts raw text from a DOCX file.
 * @param file The DOCX file object.
 * @returns A promise resolving to the extracted text.
 */
export async function extractTextFromDocx(file: File): Promise<string> {
    try {
        await waitForGlobal('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        
        // Mammoth's raw-text conversion discards table-cell boundaries. Convert to
        // HTML first so the SOW importer can retain row/column structure, then fall
        // back to raw text for documents without HTML tables.
        let html = '';
        try {
            const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
            html = String(htmlResult?.value ?? '');
        } catch (htmlError) {
            // Some malformed-but-readable DOCX files may still support raw-text extraction.
            console.warn('DOCX table-preserving conversion failed; falling back to raw text.', htmlError);
        }
        if (html && typeof DOMParser !== 'undefined') {
            const documentNode = new DOMParser().parseFromString(html, 'text/html');
            const structuredParts: string[] = [];
            documentNode.querySelectorAll('table').forEach(table => {
                table.querySelectorAll('tr').forEach(row => {
                    const cells = Array.from(row.querySelectorAll('th,td'))
                        .map(cell => (cell.textContent || '').replace(/\s+/g, ' ').trim());
                    if (cells.length) structuredParts.push(cells.join('\t'));
                });
                structuredParts.push('');
            });
            const nonTableText = (documentNode.body?.innerText || '').trim();
            const structuredText = structuredParts.join('\n').trim();
            if (structuredText) return [nonTableText, structuredText].filter(Boolean).join('\n\n');
        }
        const result = await mammoth.extractRawText({ arrayBuffer });
        const rawText = String(result?.value ?? '').trim();
        if (!rawText) throw new Error('The Word document contains no extractable text or tables.');
        return rawText;
    } catch (error) {
        console.error("Error extracting text from DOCX:", error);
        throw new Error("Failed to extract text from Word document.");
    }
}

/**
 * Main parser function that delegates based on file type.
 * @param file The file to parse.
 * @returns A promise resolving to the text content.
 */
export async function parseDocument(file: File): Promise<string> {
    const fileType = file.name.split('.').pop()?.toLowerCase();

    if (fileType === 'pdf') {
        return extractTextFromPdf(file);
    } else if (fileType === 'docx' || fileType === 'doc') {
        return extractTextFromDocx(file);
    } else if (fileType === 'txt') {
        return await file.text();
    } else {
        throw new Error(`Unsupported file type: .${fileType}`);
    }
}