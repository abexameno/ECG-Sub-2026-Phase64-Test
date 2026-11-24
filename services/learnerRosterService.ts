import { Learner, ClassRoster } from '../types/teachingAssignment.ts';
import { SchoolMembershipService } from './schoolMembershipService.ts';
import { ClassGroupService } from './classGroupService.ts';
import { AuditService } from './auditService.ts';
import { PersistentStateService } from './persistentStateService.ts';

const learnersStore: Map<string, Learner> = new Map();
const classRostersStore: Map<string, ClassRoster> = new Map();

function initSeedLearners() {
  if (learnersStore.size > 0) return;

  // Seed learners for Grade 3A LWPS
  const lwps3ALearners = [
    { id: 'lrn_lwps_301', name: 'Amani Kimani', identifier: 'ADM-301' },
    { id: 'lrn_lwps_302', name: 'Baraka Omondi', identifier: 'ADM-302' },
    { id: 'lrn_lwps_303', name: 'Chausiku Mutua', identifier: 'ADM-303' },
    { id: 'lrn_lwps_304', name: 'Dan Wanjala', identifier: 'ADM-304' },
    { id: 'lrn_lwps_305', name: 'Esther Njeri', identifier: 'ADM-305' },
  ];

  lwps3ALearners.forEach((item) => {
    const lrn: Learner = {
      id: item.id,
      schoolId: 'lwps',
      displayName: item.name,
      learnerIdentifier: item.identifier,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    learnersStore.set(lrn.id, lrn);

    const rst: ClassRoster = {
      id: `rst_${lrn.id}_g3a`,
      schoolId: 'lwps',
      classGroupId: 'cg_lwps_g3a',
      learnerId: lrn.id,
      academicYearId: 'ay_lwps_2026',
      effectiveFrom: '2026-01-05',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    classRostersStore.set(rst.id, rst);
  });

  // Seed learners for School B
  const schoolBLearners = [
    { id: 'lrn_sb_701', name: 'Samuel Otieno', identifier: 'SB-701' },
    { id: 'lrn_sb_702', name: 'Mercy Cherono', identifier: 'SB-702' },
  ];

  schoolBLearners.forEach((item) => {
    const lrn: Learner = {
      id: item.id,
      schoolId: 'school-b',
      displayName: item.name,
      learnerIdentifier: item.identifier,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    learnersStore.set(lrn.id, lrn);

    const rst: ClassRoster = {
      id: `rst_${lrn.id}_g7`,
      schoolId: 'school-b',
      classGroupId: 'cg_school-b_g7',
      learnerId: lrn.id,
      academicYearId: 'ay_school-b_2026',
      effectiveFrom: '2026-01-12',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    classRostersStore.set(rst.id, rst);
  });
}

initSeedLearners();

export const LearnerRosterService = {
  clearStore(): void {
    learnersStore.clear();
    classRostersStore.clear();
    initSeedLearners();
  },

  addLearner(params: {
    id?: string;
    schoolId: string;
    displayName: string;
    learnerIdentifier?: string;
    classGroupId: string;
    academicYearId: string;
    requestingUserId: string;
  }): { learner: Learner; roster: ClassRoster } {
    // Authorization Check: Must be active member in school with admin role
    const isAuth = SchoolMembershipService.validateAccess(params.requestingUserId, params.schoolId, 'ACADEMIC_ADMIN');
    if (!isAuth) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', params.schoolId, {
        userId: params.requestingUserId,
        action: 'ADD_LEARNER',
      });
      throw new Error(`Unauthorized: User ${params.requestingUserId} is not authorized to add learners in school ${params.schoolId}`);
    }

    const classGroup = ClassGroupService.getClassGroupById(params.classGroupId);
    if (!classGroup || classGroup.schoolId !== params.schoolId) {
      throw new Error(`Invalid class group ${params.classGroupId} for school ${params.schoolId}`);
    }

    const cleanName = params.displayName.trim();
    if (!cleanName) {
      throw new Error('Learner name cannot be empty');
    }

    // Deterministic Deduplication Check within school
    let existingLearner: Learner | null = null;
    for (const lrn of learnersStore.values()) {
      if (lrn.schoolId === params.schoolId && lrn.status === 'ACTIVE') {
        if (
          params.learnerIdentifier &&
          lrn.learnerIdentifier &&
          lrn.learnerIdentifier.toLowerCase() === params.learnerIdentifier.trim().toLowerCase()
        ) {
          existingLearner = lrn;
          break;
        } else if (
          !params.learnerIdentifier &&
          lrn.displayName.toLowerCase() === cleanName.toLowerCase()
        ) {
          existingLearner = lrn;
          break;
        }
      }
    }

    const learner: Learner = existingLearner || {
      id: params.id || `lrn_${params.schoolId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      schoolId: params.schoolId,
      displayName: cleanName,
      learnerIdentifier: params.learnerIdentifier?.trim(),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!existingLearner) {
      learnersStore.set(learner.id, learner);
      PersistentStateService.persistLearner(learner);
    }

    // Check if already in class roster (idempotent roster entry)
    let existingRoster: ClassRoster | null = null;
    for (const rst of classRostersStore.values()) {
      if (
        rst.schoolId === params.schoolId &&
        rst.classGroupId === params.classGroupId &&
        rst.learnerId === learner.id &&
        rst.status === 'ACTIVE'
      ) {
        existingRoster = rst;
        break;
      }
    }

    const roster: ClassRoster = existingRoster || {
      id: `rst_${learner.id}_${params.classGroupId}`,
      schoolId: params.schoolId,
      classGroupId: params.classGroupId,
      learnerId: learner.id,
      academicYearId: params.academicYearId,
      effectiveFrom: new Date().toISOString().split('T')[0],
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!existingRoster) {
      classRostersStore.set(roster.id, roster);
      PersistentStateService.persistClassRoster(roster);
    }

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'LEARNER_ROSTER_ADDED',
      learnerId: learner.id,
      classGroupId: params.classGroupId,
      addedBy: params.requestingUserId,
    });

    return { learner, roster };
  },

  getLearnerById(learnerId: string, requestingSchoolId: string): Learner | null {
    const learner = learnersStore.get(learnerId);
    if (!learner) return null;
    // Cross-school security check
    if (learner.schoolId !== requestingSchoolId) {
      return null;
    }
    return learner;
  },

  getLearner(learnerId: string, requestingSchoolId: string): Learner | null {
    return this.getLearnerById(learnerId, requestingSchoolId);
  },

  getLearnersBySchool(schoolId: string): Learner[] {
    initSeedLearners();
    return Array.from(learnersStore.values()).filter(
      (lrn) => lrn.schoolId === schoolId && lrn.status === 'ACTIVE'
    );
  },

  getLearnersForClassGroup(classGroupId: string, requestingSchoolId: string): Learner[] {
    const classGroup = ClassGroupService.getClassGroupById(classGroupId);
    if (!classGroup || classGroup.schoolId !== requestingSchoolId) {
      return [];
    }

    const activeRosters = Array.from(classRostersStore.values()).filter(
      (rst) =>
        rst.schoolId === requestingSchoolId &&
        rst.classGroupId === classGroupId &&
        rst.status === 'ACTIVE'
    );

    const learners: Learner[] = [];
    for (const rst of activeRosters) {
      const lrn = learnersStore.get(rst.learnerId);
      if (lrn && lrn.schoolId === requestingSchoolId && lrn.status === 'ACTIVE') {
        learners.push(lrn);
      }
    }

    return learners;
  },

  transferLearnerClass(params: {
    learnerId: string;
    fromClassGroupId: string;
    toClassGroupId: string;
    schoolId: string;
    requestingUserId: string;
  }): void {
    const isAuth = SchoolMembershipService.validateAccess(params.requestingUserId, params.schoolId, 'ACADEMIC_ADMIN');
    if (!isAuth) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', params.schoolId, {
        userId: params.requestingUserId,
        action: 'TRANSFER_LEARNER_CLASS',
      });
      throw new Error(`Unauthorized: User ${params.requestingUserId} cannot transfer learners.`);
    }

    const learner = learnersStore.get(params.learnerId);
    if (!learner || learner.schoolId !== params.schoolId) {
      throw new Error(`Learner ${params.learnerId} not found in school ${params.schoolId}`);
    }

    // Deactivate existing roster entry (preserve history)
    for (const rst of classRostersStore.values()) {
      if (
        rst.schoolId === params.schoolId &&
        rst.classGroupId === params.fromClassGroupId &&
        rst.learnerId === params.learnerId &&
        rst.status === 'ACTIVE'
      ) {
        rst.status = 'INACTIVE';
        rst.effectiveTo = new Date().toISOString().split('T')[0];
        rst.updatedAt = new Date().toISOString();
        PersistentStateService.persistClassRoster(rst);
      }
    }

    // Create new roster entry
    const newClassGroup = ClassGroupService.getClassGroupById(params.toClassGroupId);
    if (!newClassGroup || newClassGroup.schoolId !== params.schoolId) {
      throw new Error(`Destination class group ${params.toClassGroupId} not found in school ${params.schoolId}`);
    }

    const newRoster: ClassRoster = {
      id: `rst_${params.learnerId}_${params.toClassGroupId}_${Date.now()}`,
      schoolId: params.schoolId,
      classGroupId: params.toClassGroupId,
      learnerId: params.learnerId,
      academicYearId: newClassGroup.academicYearId,
      effectiveFrom: new Date().toISOString().split('T')[0],
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    classRostersStore.set(newRoster.id, newRoster);
    PersistentStateService.persistClassRoster(newRoster);

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'LEARNER_TRANSFERRED_CLASS',
      learnerId: params.learnerId,
      fromClass: params.fromClassGroupId,
      toClass: params.toClassGroupId,
      transferredBy: params.requestingUserId,
    });
  },
};

PersistentStateService.registerDomainService('LearnerRosterService', {
  clearInMemoryOnly: () => {
    LearnerRosterService.clearStore();
  },
  ingestState: (data: { schoolId?: string; learners?: Learner[]; rosters?: ClassRoster[] }) => {
    if (Array.isArray(data?.learners)) {
      for (const lrn of data.learners) {
        if (lrn?.id) {
          learnersStore.set(lrn.id, lrn);
        }
      }
    }
    if (Array.isArray(data?.rosters)) {
      for (const rst of data.rosters) {
        if (rst?.id) {
          classRostersStore.set(rst.id, rst);
        }
      }
    }
  },
});
