import { ElmsConnectionService } from './services/elmsConnectionService.ts';
import { SchoolConfigService } from './services/schoolConfigService.ts';
import { SchoolMembershipService } from './services/schoolMembershipService.ts';

describe('PHASE 53 — ECG → ELMS Connection Foundation', () => {
  const schoolA = 'lwps';
  const schoolB = 'school-b';
  const teacherA = '2'; // Seeded active teacher in lwps
  const teacherB = '4'; // Seeded active teacher in school-b
  const unauthorizedTeacher = 'unauthorized_stranger_99';

  beforeEach(() => {
    ElmsConnectionService.clearStore();

    // Configure school profiles
    try {
      SchoolConfigService.getSchoolProfile(schoolA);
    } catch {
      SchoolConfigService.saveSchoolProfile({
        id: schoolA,
        name: 'Lightweight Primary School',
        county: 'Nairobi',
        subCounty: 'Westlands',
        curriculumType: 'CBC_CBE',
        gradesSupported: ['grade-1', 'grade-2', 'grade-3', 'grade-[#3b1464]'],
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    try {
      SchoolConfigService.getSchoolProfile(schoolB);
    } catch {
      SchoolConfigService.saveSchoolProfile({
        id: schoolB,
        name: 'Hillcrest Academy',
        county: 'Mombasa',
        subCounty: 'Nyali',
        curriculumType: 'CBC_CBE',
        gradesSupported: ['grade-1', 'grade-2', 'grade-3'],
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  });

  describe('1. Connection Status & School Context', () => {
    it('should retrieve pre-seeded connection record for school A (lwps)', () => {
      const conn = ElmsConnectionService.getConnection(schoolA);
      expect(conn).toBeDefined();
      expect(conn.schoolId).toBe(schoolA);
      expect(conn.status).toBe('CONNECTED');
      expect(conn.portalUrl).toContain('portal?school=lwps');
    });

    it('should return NOT_CONNECTED by default for unconnected school B', () => {
      const conn = ElmsConnectionService.getConnection(schoolB);
      expect(conn).toBeDefined();
      expect(conn.schoolId).toBe(schoolB);
      expect(conn.status).toBe('NOT_CONNECTED');
    });

    it('should connect an authorized school tenant to ELMS', () => {
      const updated = ElmsConnectionService.connectSchool({
        schoolId: schoolB,
        teacherId: teacherB,
      });

      expect(updated.status).toBe('CONNECTED');
      expect(updated.connectedBy).toBe(teacherB);
      expect(updated.connectedAt).toBeDefined();

      const retrieved = ElmsConnectionService.getConnection(schoolB);
      expect(retrieved.status).toBe('CONNECTED');
    });

    it('should disconnect an authorized school tenant from ELMS', () => {
      const disconnected = ElmsConnectionService.disconnectSchool({
        schoolId: schoolA,
        teacherId: teacherA,
      });

      expect(disconnected.status).toBe('NOT_CONNECTED');
      const retrieved = ElmsConnectionService.getConnection(schoolA);
      expect(retrieved.status).toBe('NOT_CONNECTED');
    });
  });

  describe('2. Authorization & Tenant Isolation', () => {
    it('should REJECT connecting to ELMS if teacher is not an active member of the school', () => {
      expect(() => {
        ElmsConnectionService.connectSchool({
          schoolId: schoolA,
          teacherId: unauthorizedTeacher,
        });
      }).toThrow(/not an active member/i);
    });

    it('should REJECT disconnecting ELMS if teacher is not an active member of the school', () => {
      expect(() => {
        ElmsConnectionService.disconnectSchool({
          schoolId: schoolA,
          teacherId: unauthorizedTeacher,
        });
      }).toThrow(/not authorized/i);
    });

    it('should REJECT launch URL generation if teacher is from a different school (IDOR Protection)', () => {
      expect(() => {
        ElmsConnectionService.generateSecureLaunchUrl({
          schoolId: schoolA,
          teacherId: teacherB, // Teacher B belongs to school B, not school A
        });
      }).toThrow(/Access Denied/i);
    });
  });

  describe('3. Secure Launch & Deep Linking', () => {
    it('should generate a secure signed launch token with expiration for authorized connected teacher', () => {
      const launch = ElmsConnectionService.generateSecureLaunchUrl({
        schoolId: schoolA,
        teacherId: teacherA,
        classGroupId: 'cg_g3_east',
        targetView: 'class',
      });

      expect(launch).toBeDefined();
      expect(launch.launchUrl).toContain('stoken=');
      expect(launch.launchUrl).toContain('exp=');
      expect(launch.launchUrl).toContain('schoolId=lwps');
      expect(launch.launchUrl).toContain('classGroupId=cg_g3_east');
      expect(launch.expiresAt).toBeDefined();
    });

    it('should REJECT launch URL generation if connection status is NOT_CONNECTED', () => {
      expect(() => {
        ElmsConnectionService.generateSecureLaunchUrl({
          schoolId: schoolB, // school B is not connected
          teacherId: teacherB,
        });
      }).toThrow(/connection is not active/i);
    });

    it('should provide a clean student portal link for a school context', () => {
      const portalUrl = ElmsConnectionService.getPortalLink(schoolA);
      expect(portalUrl).toBe('https://exameno-cbe-online-learning-801909250548.europe-west2.run.app/portal?school=lwps');
    });
  });

  describe('4. Health & Verification', () => {
    it('should verify health and update lastVerifiedAt timestamp for active connection', () => {
      const result = ElmsConnectionService.verifyConnection(schoolA, teacherA);
      expect(result.healthy).toBe(true);
      expect(result.record.lastVerifiedAt).toBeDefined();
    });
  });
});
