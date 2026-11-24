import { reconstructPositionedPdfPage } from './documentParser';

describe('reconstructPositionedPdfPage', () => {
  it('keeps empty table cells aligned when a source lesson wraps onto additional PDF lines', () => {
    const items = [
      // Two-line headings from the supplied Grade 7 Mathematics SOW layout.
      { text: 'We', x: 78, y: 92 }, { text: 'LS', x: 103, y: 92 },
      { text: 'strand', x: 129, y: 92 }, { text: 'Sub-', x: 180, y: 92 },
      { text: 'Specific', x: 239, y: 92 }, { text: 'Learning', x: 276, y: 92 },
      { text: 'Outcomes', x: 319, y: 92 }, { text: 'Key', x: 391, y: 92 },
      { text: 'Inquiry', x: 411, y: 92 }, { text: 'Learning', x: 462, y: 92 },
      { text: 'Experiences', x: 505, y: 92 }, { text: 'Learning', x: 597, y: 92 },
      { text: 'Assessment', x: 681, y: 92 }, { text: 'Ref', x: 749, y: 92 },
      { text: 'ek', x: 80, y: 107 }, { text: 'N', x: 105, y: 107 },
      { text: 'strand', x: 180, y: 107 }, { text: 'Question(s)', x: 391, y: 107 },
      { text: 'Resources', x: 595, y: 107 }, { text: 'Methods', x: 688, y: 107 },
      // First source lesson row.
      { text: '1', x: 78, y: 125 }, { text: '1', x: 101, y: 125 },
      { text: 'NUMBERS', x: 123, y: 125 }, { text: 'Whole', x: 176, y: 125 },
      { text: 'Learners discuss place value', x: 225, y: 125 },
      { text: 'Why do we write numbers?', x: 388, y: 125 },
      { text: 'Identify place value', x: 458, y: 125 },
      { text: 'Place value apparatus', x: 574, y: 125 },
      { text: 'Class activities', x: 672, y: 125 },
      // Wrapped continuation: week/lesson columns are empty, not shifted.
      { text: 'and prepare a place value chart', x: 225, y: 140 },
      { text: 'using number cards', x: 458, y: 140 },
      { text: 'Number charts', x: 574, y: 140 },
    ];

    const reconstructed = reconstructPositionedPdfPage(items);
    const lines = reconstructed.text.split('\n');
    expect(reconstructed.columnAnchors.length).toBeGreaterThanOrEqual(9);
    const header = lines.find(line => line.includes('Specific Learning Outcomes'));
    expect(header).toBeTruthy();
    const lesson = lines.find(line => line.startsWith('1\t1\tNUMBERS'));
    expect(lesson).toBeTruthy();
    const cells = lesson!.split('\t');
    expect(cells[0]).toBe('1');
    expect(cells[1]).toBe('1');
    expect(cells[2]).toBe('NUMBERS');
    expect(cells[4]).toBe('Learners discuss place value');
    const continuation = lines.find(line => line.includes('and prepare a place value chart'))!.split('\t');
    expect(continuation[0]).toBe('');
    expect(continuation[1]).toBe('');
    expect(continuation[4]).toBe('and prepare a place value chart');
  });

  it('reuses detected column anchors on continuation pages without repeated headings', () => {
    const anchors = [78, 103, 129, 180, 239, 391, 462, 597, 681, 749];
    const page = reconstructPositionedPdfPage([
      { text: '2', x: 103, y: 40 },
      { text: 'Place Value', x: 180, y: 40 },
      { text: 'Learners identify place value', x: 239, y: 40 },
    ], anchors);
    const cells = page.text.split('\t');
    expect(cells[0]).toBe('');
    expect(cells[1]).toBe('2');
    expect(cells[3]).toBe('Place Value');
    expect(cells[4]).toBe('Learners identify place value');
    expect(page.columnAnchors).toEqual(anchors);
  });
});
