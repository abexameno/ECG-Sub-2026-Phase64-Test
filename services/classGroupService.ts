import { ClassGroup } from '../types/teachingAssignment.ts';
import { SchoolMembershipService } from './schoolMembershipService.ts';
import { AuditService } from './auditService.ts';
import { PersistentStateService } from './persistentStateService.ts';

const classGroupsStore: Map<string, ClassGroup> = new Map();

function initSeedClassGroups() {
  if (classGroupsStore.size > 0) return;

  // Default seed classes for LWPS
  const lwps3A: ClassGroup = {
    id: 'cg_lwps_g3a',
    schoolId: 'lwps',
    name: 'Grade 3A',
    gradeId: 'grade-3',
    academicYearId: 'ay_lwps_2026',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  classGroupsStore.set(lwps3A.id, lwps3A);

  const lwps3B: ClassGroup = {
    id: 'cg_lwps_g3b',
    schoolId: 'lwps',
    name: 'Grade 3B',
    gradeId: 'grade-3',
    academicYearId: 'ay_lwps_2026',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  classGroupsStore.set(lwps3B.id, lwps3B);

  const lwps4A: ClassGroup = {
    id: 'cg_lwps_g4a',
    schoolId: 'lwps',
    name: 'Grade 4A',
    gradeId: 'grade-4',
    academicYearId: 'ay_lwps_2026',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  classGroupsStore.set(lwps4A.id, lwps4A);

  const lwps8Sci: ClassGroup = {
    id: 'cg_lwps_g8a',
    schoolId: 'lwps',
    name: 'Grade 8A',
    gradeId: 'grade-8',
    academicYearId: 'ay_lwps_2026',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  classGroupsStore.set(lwps8Sci.id, lwps8Sci);

  // Default seed class for School B
  const schoolB7: ClassGroup = {
    id: 'cg_school-b_g7',
    schoolId: 'school-b',
    name: 'Grade 7',
    gradeId: 'grade-7',
    academicYearId: 'ay_school-b_2026',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  classGroupsStore.set(schoolB7.id, schoolB7);
}

initSeedClassGroups();

export const ClassGroupService = {
  clearStore(): void {
    classGroupsStore.clear();
    initSeedClassGroups();
  },

  createClassGroup(params: {
    id?: string;
    schoolId: string;
    name: string;
    gradeId: string;
    academicYearId: string;
    requestingUserId?: string;
  }): ClassGroup {
    // Validate authorization if requestingUserId is provided
    if (params.requestingUserId) {
      const isAuth = SchoolMembershipService.validateAccess(params.requestingUserId, params.schoolId, 'ACADEMIC_ADMIN');
      if (!isAuth) {
        AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', params.schoolId, {
          userId: params.requestingUserId,
          action: 'CREATE_CLASS_GROUP',
        });
        throw new Error(`Unauthorized: User ${params.requestingUserId} is not authorized to create classes in school ${params.schoolId}`);
      }
    }

    const normalizedName = params.name.trim();
    if (!normalizedName) {
      throw new Error('Class group name cannot be empty');
    }

    // Check idempotency / duplicates in same school & academic year
    for (const existing of classGroupsStore.values()) {
      if (
        existing.schoolId === params.schoolId &&
        existing.academicYearId === params.academicYearId &&
        existing.name.toLowerCase() === normalizedName.toLowerCase() &&
        existing.status === 'ACTIVE'
      ) {
        return existing; // Idempotent return
      }
    }

    const classGroup: ClassGroup = {
      id: params.id || `cg_${params.schoolId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      schoolId: params.schoolId,
      name: normalizedName,
      gradeId: params.gradeId,
      academicYearId: params.academicYearId,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    classGroupsStore.set(classGroup.id, classGroup);
    PersistentStateService.persistClassGroup(classGroup);

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'CLASS_GROUP_CREATED',
      classGroupId: classGroup.id,
      className: classGroup.name,
      gradeId: classGroup.gradeId,
      createdBy: params.requestingUserId,
    });

    return classGroup;
  },

  getClassGroupById(classGroupId: string): ClassGroup | null {
    return classGroupsStore.get(classGroupId) || null;
  },

  getClassGroupsBySchool(schoolId: string): ClassGroup[] {
    return Array.from(classGroupsStore.values()).filter(
      (cg) => cg.schoolId === schoolId && cg.status === 'ACTIVE'
    );
  },

  getClassGroupsByGrade(schoolId: string, gradeId: string): ClassGroup[] {
    return Array.from(classGroupsStore.values()).filter(
      (cg) => cg.schoolId === schoolId && cg.gradeId === gradeId && cg.status === 'ACTIVE'
    );
  },

  updateClassGroup(
    classGroupId: string,
    updates: Partial<Pick<ClassGroup, 'name' | 'status'>>,
    requestingUserId: string
  ): ClassGroup {
    const cg = classGroupsStore.get(classGroupId);
    if (!cg) {
      throw new Error(`ClassGroup ${classGroupId} not found.`);
    }

    const isAuth = SchoolMembershipService.validateAccess(requestingUserId, cg.schoolId, 'ACADEMIC_ADMIN');
    if (!isAuth) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', cg.schoolId, {
        userId: requestingUserId,
        action: 'UPDATE_CLASS_GROUP',
        classGroupId,
      });
      throw new Error(`Unauthorized: User ${requestingUserId} cannot modify class group in school ${cg.schoolId}`);
    }

    if (updates.name !== undefined) cg.name = updates.name.trim();
    if (updates.status !== undefined) cg.status = updates.status;
    cg.updatedAt = new Date().toISOString();

    classGroupsStore.set(cg.id, cg);
    PersistentStateService.persistClassGroup(cg);

    AuditService.log('ARTIFACT_UPDATED', cg.schoolId, {
      action: 'CLASS_GROUP_UPDATED',
      classGroupId: cg.id,
      updatedBy: requestingUserId,
    });

    return cg;
  },
};

PersistentStateService.registerDomainService('ClassGroupService', {
  clearInMemoryOnly: () => {
    ClassGroupService.clearStore();
  },
  ingestState: (data: { schoolId?: string; classGroups?: ClassGroup[] }) => {
    if (Array.isArray(data?.classGroups)) {
      for (const cg of data.classGroups) {
        if (cg?.id) {
          classGroupsStore.set(cg.id, cg);
        }
      }
    }
  },
});
