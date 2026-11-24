export interface KenyaSchoolDirectoryRecord {
  // Existing Properties
  directorySchoolId: string;
  schoolName: string;
  normalizedSchoolName: string;

  // Official Identifiers
  nemisCode?: string;
  knecCode?: string;
  moeRegistrationNumber?: string;
  officialSchoolCode?: string;

  // Classification
  schoolType: string; // e.g. Primary, Secondary, Junior Secondary, Pre-Primary
  educationLevel?: string;
  institutionCategory?: string; // e.g. Public, Private
  ownership?: string;
  genderCategory?: string; // e.g. Mixed, Girls, Boys
  specialNeedsIndicator?: string;

  // Location
  county: string;
  subCounty?: string;
  ward?: string;
  constituency?: string;
  locality?: string;

  // ECG Status
  ecgSchoolId?: string; // linked ECG School Tenant ID
  ecgStatus: 'DIRECTORY_ONLY' | 'ECG_ACTIVE' | 'UNVERIFIED';
  claimedAt?: string;
  claimedBy?: string;
  activatedAt?: string;

  // Source Info
  source: string;
  sourceRecordId?: string;
  sourceUpdatedAt?: string;
  importedAt: string;
  lastVerifiedAt?: string;
  verificationStatus: 'VERIFIED' | 'UNVERIFIED';

  // Canonical Phase 51 Extensions
  id?: string; // Alias of directorySchoolId
  normalizedName?: string; // Alias of normalizedSchoolName
  uic?: string; // Alias of nemisCode
  institutionType?: string; // Alias of schoolType
  location?: string; // Alias of locality
  kpsea2025Participant?: boolean;
  kjsea2025Participant?: boolean;
  isTestData?: boolean;
  dataSources?: string[]; // e.g. ["NEMIS", "KPSEA_2025", "KJSEA_2025"]
  sourceReferences?: Record<string, any>;
  claimedBySchoolId?: string; // Alias of ecgSchoolId
  createdAt?: string;
  updatedAt?: string;
}

export interface DirectoryFilters {
  county?: string;
  subCounty?: string;
  schoolType?: string;
  ownership?: string;
  educationLevel?: string;
  nemisCode?: string;
  knecCode?: string;
}

export interface DirectoryCSVValidationResult {
  fileName: string;
  fileSize: number;
  rowsDiscovered: number;
  columnsDetected: string[];
  previewRecords: Partial<KenyaSchoolDirectoryRecord>[];
  validationStatus: 'VALIDATED' | 'INVALID';
  validationErrors: string[];
}

export interface DirectoryCSVImportResult {
  fileName: string;
  totalDiscovered: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsRejected: number;
  duplicatesDetected: number;
  recordsRequiringReview: number;
  timestamp: string;
}

export interface DirectoryImportLogEntry {
  id: string;
  timestamp: string;
  fileName: string;
  recordsProcessed: number;
  recordsImported: number;
  recordsRequiringReview: number;
  stats: DirectoryCSVImportResult;
}

export interface ImportPipelineStats {
  totalSourceRecordsFound: number;
  totalRecordsProcessed: number;
  totalImported: number;
  duplicatesDetected: number;
  duplicatesSkipped: number;
  invalidRecords: number;
  recordsMissingOfficialCodes: number;
  recordsRequiringVerification: number;
  recordsRejected: number;
  sourceCoverage: string;
  countiesCovered: string[];
  subCountiesCovered: string[];
  educationLevelsCovered: string[];
  publicPrivateCoverage: {
    public: number;
    private: number;
    unknown: number;
  };
}
