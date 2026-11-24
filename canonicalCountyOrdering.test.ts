import { KENYA_COUNTIES, KENYA_COUNTIES_META } from './constants/kenyaCounties';
import { SchoolDirectoryService } from './services/schoolDirectoryService';

describe('Global County Ordering Standardization (A–Z)', () => {
  it('verifies exactly 47 Kenya counties exist in canonical exports', () => {
    expect(KENYA_COUNTIES.length).toBe(47);
    expect(KENYA_COUNTIES_META.length).toBe(47);
  });

  it('verifies no county is duplicated', () => {
    const uniqueCounties = new Set(KENYA_COUNTIES);
    expect(uniqueCounties.size).toBe(47);

    const uniqueCodes = new Set(KENYA_COUNTIES_META.map(c => c.code));
    expect(uniqueCodes.size).toBe(47);
  });

  it('verifies no standard Kenya county is missing', () => {
    const requiredCounties = [
      'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu',
      'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho',
      'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale',
      'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit',
      'Meru', 'Migori', 'Mombasa', "Murang'a", 'Nairobi City', 'Nakuru',
      'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya',
      'Taita-Taveta', 'Tana River', 'Tharaka-Nithi', 'Trans Nzoia', 'Turkana',
      'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot',
    ];

    requiredCounties.forEach(county => {
      expect(KENYA_COUNTIES.includes(county)).toBe(true);
    });
  });

  it('verifies counties are strictly ordered ALPHABETICALLY A–Z by name', () => {
    const expectedSorted = [...KENYA_COUNTIES].sort((a, b) => a.localeCompare(b));
    expect([...KENYA_COUNTIES]).toEqual(expectedSorted);

    // Specific boundary checks
    expect(KENYA_COUNTIES[0]).toBe('Baringo');
    expect(KENYA_COUNTIES[1]).toBe('Bomet');
    expect(KENYA_COUNTIES[27]).toBe('Mombasa');
    expect(KENYA_COUNTIES[28]).toBe("Murang'a");
    expect(KENYA_COUNTIES[29]).toBe('Nairobi City');
    expect(KENYA_COUNTIES[30]).toBe('Nakuru');
    expect(KENYA_COUNTIES[46]).toBe('West Pokot');
  });

  it('verifies county code metadata remains intact and associated correctly', () => {
    const mombasaMeta = KENYA_COUNTIES_META.find(c => c.name === 'Mombasa');
    expect(mombasaMeta).toBeDefined();
    expect(mombasaMeta?.code).toBe('001');

    const nairobiMeta = KENYA_COUNTIES_META.find(c => c.name === 'Nairobi City');
    expect(nairobiMeta).toBeDefined();
    expect(nairobiMeta?.code).toBe('047');

    const baringoMeta = KENYA_COUNTIES_META.find(c => c.name === 'Baringo');
    expect(baringoMeta).toBeDefined();
    expect(baringoMeta?.code).toBe('030');
  });

  it('verifies "All Counties" appears first in selector option builders', () => {
    const options = ['All Counties', ...KENYA_COUNTIES];
    expect(options[0]).toBe('All Counties');
    expect(options[1]).toBe('Baringo');
    expect(options[2]).toBe('Bomet');
    expect(options.length).toBe(48);
  });

  it('verifies search filtering within county selector returns correct county', () => {
    const searchCounties = (query: string) =>
      KENYA_COUNTIES.filter(c => c.toLowerCase().includes(query.toLowerCase()));

    expect(searchCounties('nairobi')).toEqual(['Nairobi City']);
    expect(searchCounties('taita')).toEqual(['Taita-Taveta']);
    expect(searchCounties('mura')).toEqual(["Murang'a"]);
    expect(searchCounties('pokot')).toEqual(['West Pokot']);
    expect(searchCounties('uasin')).toEqual(['Uasin Gishu']);
  });

  it('verifies SchoolDirectoryService.getCountyCoverageReport() returns reports in A–Z order', () => {
    const report = SchoolDirectoryService.getCountyCoverageReport();
    expect(report.length).toBe(47);
    expect(report[0].county).toBe('Baringo');
    expect(report[29].county).toBe('Nairobi City');
    expect(report[46].county).toBe('West Pokot');
  });
});
