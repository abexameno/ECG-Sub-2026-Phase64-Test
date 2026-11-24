jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  // This suite exercises the directory's in-memory import/search behavior.
  // Prevent unit tests from opening real Firestore network streams.
  setDoc: jest.fn(async () => undefined),
  updateDoc: jest.fn(async () => undefined),
  getDocs: jest.fn(async () => ({ forEach: jest.fn() })),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    commit: jest.fn(async () => undefined),
  })),
}));

import { SchoolDirectoryService, getNormalizedName } from './services/schoolDirectoryService.ts';
import { SchoolConfigService } from './services/schoolConfigService.ts';
import { SchoolMembershipService } from './services/schoolMembershipService.ts';

describe('Kenya National School Directory Service (Phase 51)', () => {
  const currentUserId = 'test-teacher-user';

  beforeEach(() => {
    SchoolDirectoryService.clearStore();
    SchoolConfigService.clearStore();
    SchoolMembershipService.clearStore();
  });

  // --- SECTION 1: DATA NORMALIZATION ---
  describe('Data Normalization', () => {
    test('normalizes school names correctly keeping critical suffixes', () => {
      expect(getNormalizedName("St. Mary's Girls Secondary School")).toBe('st marys girls secondary school');
      expect(getNormalizedName('Alliance High School')).toBe('alliance high school');
      expect(getNormalizedName('Mombasa Primary & Junior School')).toBe('mombasa primary junior school');
      expect(getNormalizedName('')).toBe('');
    });
  });

  // --- SECTION 2: IMPORT PIPELINE ---
  describe('Import Pipeline & Idempotency', () => {
    test('imports a valid record successfully', async () => {
      const rawRecords = [{
        schoolName: 'Kibwezi Sunshine Academy',
        county: 'Makueni',
        subCounty: 'Kibwezi West',
        nemisCode: 'NEMIS-MKN999',
        knecCode: 'KNEC-MKN-999'
      }];

      const stats = await SchoolDirectoryService.runImportPipeline({ rawRecords });
      expect(stats.totalImported).toBe(1);
      expect(stats.invalidRecords).toBe(0);

      const search = await SchoolDirectoryService.searchDirectory('Kibwezi Sunshine Academy');
      expect(search.length).toBe(1);
      expect(search[0].schoolName).toBe('Kibwezi Sunshine Academy');
      expect(search[0].county).toBe('Makueni');
    });

    test('rejects/skips invalid records', async () => {
      const rawRecords = [
        { county: 'Mombasa' }, // Missing schoolName
        { schoolName: 'No County School' } // Missing county
      ];

      const stats = await SchoolDirectoryService.runImportPipeline({ rawRecords });
      expect(stats.invalidRecords).toBe(2);
      expect(stats.totalImported).toBe(0);
    });

    test('is strictly idempotent on multiple imports', async () => {
      const rawRecords = [{
        schoolName: 'Fresh Kajiado Academy',
        county: 'Kajiado',
        nemisCode: 'NEMIS-KJD999'
      }];

      // First Import
      const stats1 = await SchoolDirectoryService.runImportPipeline({ rawRecords });
      expect(stats1.totalImported).toBe(1);

      // Second Import (identical record)
      const stats2 = await SchoolDirectoryService.runImportPipeline({ rawRecords });
      expect(stats2.totalImported).toBe(0);
      expect(stats2.duplicatesDetected).toBe(1);
      expect(stats2.duplicatesSkipped).toBe(1);
    });

    test('performs safe enrichment instead of blind overwrite', async () => {
      const baseRecord = {
        schoolName: 'Kericho Green Tea Academy',
        county: 'Kericho',
        nemisCode: 'NEMIS-KRC444',
        schoolType: 'Secondary'
      };

      await SchoolDirectoryService.runImportPipeline({ rawRecords: [baseRecord] });

      // Secondary import with missing schoolType but adding knecCode and assessment
      const enrichRecord = {
        schoolName: 'Kericho Green Tea Academy',
        county: 'Kericho',
        nemisCode: 'NEMIS-KRC444',
        knecCode: 'KNEC-KRC-444',
        kpsea: 'true'
      };

      await SchoolDirectoryService.runImportPipeline({ rawRecords: [enrichRecord] });

      const results = await SchoolDirectoryService.searchDirectory('Kericho Green Tea Academy');
      expect(results.length).toBe(1);
      const school = results[0];
      // Should preserve schoolType from first import
      expect(school.schoolType).toBe('Secondary');
      // Should enrich knecCode and assessment from second import
      expect(school.knecCode).toBe('KNEC-KRC-444');
      expect(school.kpsea2025Participant).toBe(true);
    });
  });

  // --- SECTION 3: DETERMINISTIC MATCHING PRIORITY ---
  describe('Deterministic Matching Priority', () => {
    test('matches correctly on NEMIS / UIC code', async () => {
      await SchoolDirectoryService.runImportPipeline({
        rawRecords: [{
          schoolName: 'NEMIS Match School',
          county: 'Garissa',
          nemisCode: 'NEMIS-MATCH-1'
        }]
      });

      // Import with same NEMIS but updated Name
      await SchoolDirectoryService.runImportPipeline({
        rawRecords: [{
          schoolName: 'NEMIS Match School Updated',
          county: 'Garissa',
          nemisCode: 'NEMIS-MATCH-1'
        }]
      });

      const all = await SchoolDirectoryService.searchDirectory('NEMIS-MATCH-1');
      expect(all.length).toBe(1);
    });

    test('matches correctly on KNEC code', async () => {
      await SchoolDirectoryService.runImportPipeline({
        rawRecords: [{
          schoolName: 'Original KNEC School',
          county: 'Kiambu',
          knecCode: 'KNEC-MATCH-2'
        }]
      });

      await SchoolDirectoryService.runImportPipeline({
        rawRecords: [{
          schoolName: 'Enriched KNEC School',
          county: 'Kiambu',
          knecCode: 'KNEC-MATCH-2'
        }]
      });

      const all = await SchoolDirectoryService.searchDirectory('KNEC-MATCH-2');
      expect(all.length).toBe(1);
    });

    test('matches on combination of Name, County, and Subcounty without matching on name alone', async () => {
      // Create St Marys in different Counties
      await SchoolDirectoryService.runImportPipeline({
        rawRecords: [
          { schoolName: "Fresh St. Mary's School", county: 'Nairobi City', subCounty: 'Westlands' },
          { schoolName: "Fresh St. Mary's School", county: 'Nakuru', subCounty: 'Naivasha' }
        ]
      });

      const allMarys = await SchoolDirectoryService.searchDirectory("Fresh St. Mary's");
      // Should preserve them separately (no blind merge by name only)
      expect(allMarys.length).toBe(2);
    });
  });

  // --- SECTION 4: ASSESSMENT PARTICIPATION ---
  describe('Assessment Participation & Provenance', () => {
    test('flags KPSEA and KJSEA participation correctly', async () => {
      await SchoolDirectoryService.runImportPipeline({
        rawRecords: [{
          schoolName: 'Exam Center Primary',
          county: 'Nyeri',
          kpsea: 'true',
          kjsea: 'true'
        }]
      });

      const results = await SchoolDirectoryService.searchDirectory('Exam Center Primary');
      expect(results[0].kpsea2025Participant).toBe(true);
      expect(results[0].kjsea2025Participant).toBe(true);
    });
  });

  // --- SECTION 5: DIRECTORY SEARCH ---
  describe('Directory Search', () => {
    test('supports searching by name, partial name, county, subcounty, and codes', async () => {
      await SchoolDirectoryService.runImportPipeline({
        rawRecords: [{
          schoolName: 'Testing Alliance High School',
          county: 'Kiambu',
          subCounty: 'Kikuyu',
          nemisCode: 'AHS-NEM-99',
          knecCode: 'AHS-KNEC-99'
        }]
      });

      // 1. Partial Name
      expect((await SchoolDirectoryService.searchDirectory('Testing Alliance')).length).toBe(1);
      // 2. County
      expect((await SchoolDirectoryService.searchDirectory('Kiambu')).length).toBeGreaterThanOrEqual(1);
      // 3. Codes
      expect((await SchoolDirectoryService.searchDirectory('AHS-NEM-99')).length).toBe(1);
      expect((await SchoolDirectoryService.searchDirectory('AHS-KNEC-99')).length).toBe(1);
    });
  });

  // --- SECTION 6: CLAIM WORKFLOW & TENANT ISOLATION ---
  describe('Claim and Activation Workflow', () => {
    test('transitions school to ECG_ACTIVE and assigns claiming user as SCHOOL_ADMIN', async () => {
      // Find a seeded directory school (e.g. Mombasa Primary School)
      const list = await SchoolDirectoryService.searchDirectory('Mombasa Primary School');
      expect(list.length).toBe(1);
      const dirSchool = list[0];
      expect(dirSchool.ecgStatus).toBe('DIRECTORY_ONLY');

      // Claim it
      const activeProfile = await SchoolDirectoryService.claimAndActivateSchool(
        dirSchool.directorySchoolId,
        currentUserId
      );

      expect(activeProfile).toBeDefined();
      expect(activeProfile.name).toBe('Mombasa Primary School');
      expect(activeProfile.county).toBe('Mombasa');

      // Verify directory record status update
      const updatedList = await SchoolDirectoryService.searchDirectory('Mombasa Primary School');
      expect(updatedList[0].ecgStatus).toBe('ECG_ACTIVE');
      expect(updatedList[0].ecgSchoolId).toBe(activeProfile.id);

      // Verify claiming teacher is active SCHOOL_ADMIN
      const isAuthorized = SchoolMembershipService.validateAccess(currentUserId, activeProfile.id);
      expect(isAuthorized).toBe(true);

      const membership = SchoolMembershipService.getMemberships(currentUserId)[0];
      expect(membership.role).toBe('SCHOOL_ADMIN');
      expect(membership.status).toBe('ACTIVE');
    });

    test('registering a missing school creates an UNVERIFIED directory record and active profile', async () => {
      const activeProfile = await SchoolDirectoryService.registerMissingSchool({
        name: 'Custom Community School',
        schoolType: 'Primary',
        county: 'Bomet',
        subCounty: 'Bomet East'
      }, currentUserId);

      expect(activeProfile).toBeDefined();
      expect(activeProfile.name).toBe('Custom Community School');

      // Verify in directory search
      const dirList = await SchoolDirectoryService.searchDirectory('Custom Community School');
      expect(dirList.length).toBe(1);
      expect(dirList[0].verificationStatus).toBe('UNVERIFIED');
      expect(dirList[0].ecgStatus).toBe('ECG_ACTIVE');
    });
  });
});
