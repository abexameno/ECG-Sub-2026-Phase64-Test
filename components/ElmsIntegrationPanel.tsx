import React, { useState, useEffect } from 'react';
import { User } from '../types.ts';
import {
  ElmsResourcePublication,
  ElmsLearnerMapping,
  ElmsClassMapping,
  ElmsLearningEvent,
  ElmsSyncStatus,
  ElmsReconciliationReport,
} from '../types/elmsIntegration.ts';
import { ElmsIntegrationService } from '../services/elmsIntegrationService.ts';
import { ContentArtifactRepository } from '../services/contentArtifactRepository.ts';
import { LearnerRosterService } from '../services/learnerRosterService.ts';
import { ClassGroupService } from '../services/classGroupService.ts';
import {
  Globe,
  RefreshCw,
  Send,
  CheckCircle,
  AlertTriangle,
  Clock,
  Link,
  ShieldCheck,
  Layers,
  Users,
  BookOpen,
  ArrowRightLeft,
  FileCheck,
} from 'lucide-react';

interface ElmsIntegrationPanelProps {
  currentUser: User | null;
}

export const ElmsIntegrationPanel: React.FC<ElmsIntegrationPanelProps> = ({ currentUser }) => {
  const schoolId = 'lwps'; // Default school scope
  const [activeTab, setActiveTab] = useState<'overview' | 'publications' | 'mappings' | 'events'>('overview');
  
  const [syncStatus, setSyncStatus] = useState<ElmsSyncStatus>({
    totalReceived: 0,
    totalProcessed: 0,
    totalFailed: 0,
    totalPending: 0,
    unresolvedIssuesCount: 0,
  });

  const [publications, setPublications] = useState<ElmsResourcePublication[]>([]);
  const [learnerMappings, setLearnerMappings] = useState<ElmsLearnerMapping[]>([]);
  const [classMappings, setClassMappings] = useState<ElmsClassMapping[]>([]);
  const [events, setEvents] = useState<ElmsLearningEvent[]>([]);
  const [reconciliationReport, setReconciliationReport] = useState<ElmsReconciliationReport | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Publication state
  const [publishArtifactId, setPublishArtifactId] = useState('');
  const [publishLearningArea, setPublishLearningArea] = useState('Mathematics');

  // New Mapping state
  const [mapEcgLearnerId, setMapEcgLearnerId] = useState('');
  const [mapElmsLearnerId, setMapElmsLearnerId] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = () => {
    try {
      const status = ElmsIntegrationService.getSyncStatus(schoolId);
      setSyncStatus(status);

      const pubs = ElmsIntegrationService.listPublications(schoolId);
      setPublications(pubs);

      const evts = ElmsIntegrationService.listEvents(schoolId);
      setEvents(evts);

      // Learners in school
      const learners = LearnerRosterService.getLearnersBySchool(schoolId);
      const lMappings: ElmsLearnerMapping[] = [];
      for (const l of learners) {
        const elmsId = ElmsIntegrationService.getElmsLearnerId(schoolId, l.id);
        if (elmsId) {
          lMappings.push({
            id: `map_${l.id}`,
            schoolId,
            ecgLearnerId: l.id,
            elmsLearnerId: elmsId,
            status: 'ACTIVE',
            mappedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
      setLearnerMappings(lMappings);

      // Class mappings
      const classes = ClassGroupService.getClassGroupsBySchool(schoolId);
      const cMappings: ElmsClassMapping[] = [];
      for (const c of classes) {
        const elmsCId = ElmsIntegrationService.getElmsClassGroupId(schoolId, c.id);
        if (elmsCId) {
          cMappings.push({
            id: `map_${c.id}`,
            schoolId,
            ecgClassGroupId: c.id,
            elmsClassGroupId: elmsCId,
            status: 'ACTIVE',
            mappedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
      setClassMappings(cMappings);
    } catch (e: any) {
      console.error('Error loading ELMS data:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, [schoolId]);

  const handleReconcile = () => {
    setIsReconciling(true);
    try {
      const report = ElmsIntegrationService.reconcile(schoolId);
      setReconciliationReport(report);
      loadData();
      showToast(`Reconciliation completed: ${report.processedEventsCount} processed, ${report.failedEventsCount} failed.`);
    } catch (err: any) {
      showToast(`Reconciliation error: ${err.message}`);
    } finally {
      setIsReconciling(false);
    }
  };

  const handlePublishResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishArtifactId.trim()) {
      showToast('Please enter or select an artifact ID to publish');
      return;
    }
    try {
      const teacherId = currentUser?.id || 't_lwps_1';
      // If artifact doesn't exist, create mock seed in repo for immediate testing
      try {
        ContentArtifactRepository.getById(publishArtifactId.trim(), schoolId);
      } catch {
        ContentArtifactRepository.save({
          id: publishArtifactId.trim(),
          schoolId,
          version: 1,
          artifactType: 'scheme_of_work',
          status: 'published',
          source: 'human_created',
          curriculumId: 'curr_ke_primary',
          curriculumVersion: 'kicd_cbe_2026',
          gradeLevelId: 'grade-3',
          learningAreaId: publishLearningArea,
          curriculumReferences: [
            {
              learningAreaId: publishLearningArea,
              gradeLevelId: 'grade-3',
              strandId: 'numbers',
              subStrandId: 'whole_numbers',
              learningOutcomeIds: ['slo_g3_math_01'],
            },
          ],
          generationMetadata: {
            generationId: 'gen_manual_seed',
            model: 'gemini-2.5-flash',
            promptVersion: '1.0',
            generatedAt: new Date().toISOString(),
          },
          content: { summary: 'Curriculum-aligned practice module' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      ElmsIntegrationService.publishResource({
        schoolId,
        teacherId,
        ecgArtifactId: publishArtifactId.trim(),
        learningAreaId: publishLearningArea,
        curriculumVersionId: 'kicd_cbe_2026',
        teachingPlanId: 'tp_lwps_term1_2026',
        teachingAllocationId: 'week_1_lesson_1',
        learningOutcomeIds: ['slo_g3_math_01'],
      });

      setPublishArtifactId('');
      loadData();
      showToast(`Resource ${publishArtifactId} successfully published to ELMS!`);
    } catch (err: any) {
      showToast(`Publication failed: ${err.message}`);
    }
  };

  const handleMapLearner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapEcgLearnerId.trim() || !mapElmsLearnerId.trim()) {
      showToast('Both ECG Learner ID and ELMS Learner ID are required');
      return;
    }
    try {
      ElmsIntegrationService.mapLearner({
        schoolId,
        ecgLearnerId: mapEcgLearnerId.trim(),
        elmsLearnerId: mapElmsLearnerId.trim(),
        requestingUserId: currentUser?.id || 't_lwps_1',
      });
      setMapEcgLearnerId('');
      setMapElmsLearnerId('');
      loadData();
      showToast('Learner mapped successfully!');
    } catch (err: any) {
      showToast(`Mapping error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-xl border border-slate-700 shadow-2xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900">ECG ↔ ELMS 2026 Integration Hub</h2>
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full uppercase tracking-wider border border-emerald-300">
                Phase 29 Certified
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Authoritative curriculum & resource publication with bi-directional learning evidence synchronization.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReconcile}
            disabled={isReconciling}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin' : ''}`} />
            {isReconciling ? 'Reconciling...' : 'Reconcile Sync'}
          </button>
        </div>
      </div>

      {/* Architectural Guarantee Card */}
      <div className="bg-slate-900 text-slate-200 rounded-2xl p-4 border border-slate-800 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <div className="font-bold text-white uppercase tracking-wider text-[10px]">
            System-of-Record Architectural Constitution
          </div>
          <div className="text-slate-300 leading-relaxed">
            <strong className="text-emerald-400">ECG (WHAT / WHEN)</strong> governs Curriculum, Teaching Plans, Allocations, and Content Artifacts.{' '}
            <strong className="text-blue-400">ELMS (DELIVERY)</strong> governs Learner Access, Submissions, and Learner Activity Events. External events cannot alter authoritative teaching plans or curriculum designs.
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
            activeTab === 'overview'
              ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Overview & Metrics
        </button>
        <button
          onClick={() => setActiveTab('publications')}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
            activeTab === 'publications'
              ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Published Resources ({publications.length})
        </button>
        <button
          onClick={() => setActiveTab('mappings')}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
            activeTab === 'mappings'
              ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Identity Mappings ({learnerMappings.length + classMappings.length})
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
            activeTab === 'events'
              ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Learning Events Log ({events.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Published to ELMS</span>
              <BookOpen className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2">{publications.length}</div>
            <div className="text-[10px] text-slate-400 mt-1">Active learning resources</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Events Processed</span>
              <FileCheck className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2">{syncStatus.totalProcessed}</div>
            <div className="text-[10px] text-slate-400 mt-1">Idempotent learning records</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Learner Mappings</span>
              <Users className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2">{learnerMappings.length}</div>
            <div className="text-[10px] text-slate-400 mt-1">Cross-system active identities</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Sync Status</span>
              {syncStatus.totalFailed === 0 ? (
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              )}
            </div>
            <div className="text-2xl font-black text-emerald-600 mt-2">
              {syncStatus.totalFailed === 0 ? 'Healthy' : `${syncStatus.totalFailed} Issues`}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {syncStatus.lastSyncAt ? `Last: ${new Date(syncStatus.lastSyncAt).toLocaleTimeString()}` : 'Live listener ready'}
            </div>
          </div>

          {reconciliationReport && (
            <div className="md:col-span-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <div>
                  <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider">Latest Reconciliation Report</h4>
                  <p className="text-[11px] text-emerald-700">
                    Processed: {reconciliationReport.processedEventsCount} | Mappings: {reconciliationReport.learnerMappingsCount} learners, {reconciliationReport.classMappingsCount} classes | Unresolved: {reconciliationReport.failedEventsCount}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-emerald-800">
                {new Date(reconciliationReport.generatedAt).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>
      )}

      {activeTab === 'publications' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Publish New Form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 h-fit">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-3 flex items-center gap-2">
              <Send className="w-3.5 h-3.5 text-emerald-600" />
              Publish Resource to ELMS
            </h3>
            <form onSubmit={handlePublishResource} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Content Artifact ID
                </label>
                <input
                  type="text"
                  value={publishArtifactId}
                  onChange={(e) => setPublishArtifactId(e.target.value)}
                  placeholder="e.g. art_math_g3_wk1"
                  className="w-full text-xs font-medium px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Learning Area
                </label>
                <select
                  value={publishLearningArea}
                  onChange={(e) => setPublishLearningArea(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2 border border-slate-200 rounded-xl focus:outline-none"
                >
                  <option value="Mathematics">Mathematics</option>
                  <option value="Science and Technology">Science and Technology</option>
                  <option value="English Language">English Language</option>
                  <option value="Kiswahili Lugha">Kiswahili Lugha</option>
                  <option value="Social Studies">Social Studies</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl uppercase tracking-wider transition-colors shadow-sm"
              >
                Publish with Stable Contract
              </button>
            </form>
          </div>

          {/* List of Publications */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Published Resources Ledger
              </h3>
              <span className="text-[10px] text-slate-500 font-bold">{publications.length} Active</span>
            </div>

            {publications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No resources published yet. Use the form to publish curriculum artifacts to ELMS.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {publications.map((pub) => (
                  <div key={pub.publicationId} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-black text-slate-900">{pub.ecgArtifactId}</h4>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-bold">
                          v{pub.artifactVersion}
                        </span>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[9px] font-bold">
                          {pub.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-3">
                        <span>ELMS Resource: {pub.elmsResourceId}</span>
                        <span>Area: {pub.learningAreaId}</span>
                        <span>Plan: {pub.teachingPlanId}</span>
                      </div>
                    </div>
                    <div className="text-right text-[10px] text-slate-400">
                      Published: {new Date(pub.publishedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'mappings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Mapping Form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 h-fit">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-3 flex items-center gap-2">
              <ArrowRightLeft className="w-3.5 h-3.5 text-purple-600" />
              Map Learner Identity
            </h3>
            <form onSubmit={handleMapLearner} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  ECG Learner ID
                </label>
                <input
                  type="text"
                  value={mapEcgLearnerId}
                  onChange={(e) => setMapEcgLearnerId(e.target.value)}
                  placeholder="e.g. lrn_101"
                  className="w-full text-xs font-medium px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  ELMS Learner ID
                </label>
                <input
                  type="text"
                  value={mapElmsLearnerId}
                  onChange={(e) => setMapElmsLearnerId(e.target.value)}
                  placeholder="e.g. elms_user_992"
                  className="w-full text-xs font-medium px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black rounded-xl uppercase tracking-wider transition-colors shadow-sm"
              >
                Establish Cross-System Mapping
              </button>
            </form>
          </div>

          {/* List of Mappings */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Learner Identity Mappings
                </h3>
                <span className="text-[10px] text-slate-500 font-bold">{learnerMappings.length} Active</span>
              </div>
              {learnerMappings.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No active learner mappings found. Enter mapping details to link ECG learners with ELMS student accounts.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {learnerMappings.map((m) => (
                    <div key={m.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-900">ECG: {m.ecgLearnerId}</span>
                        <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-bold text-purple-700">ELMS: {m.elmsLearnerId}</span>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-bold">
                        {m.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Class Group Mappings
                </h3>
                <span className="text-[10px] text-slate-500 font-bold">{classMappings.length} Active</span>
              </div>
              {classMappings.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs">
                  Classes are mapped automatically upon class roster synchronization.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {classMappings.map((cm) => (
                    <div key={cm.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="font-bold text-slate-900">ECG: {cm.ecgClassGroupId}</span>
                        <ArrowRightLeft className="w-3 h-3 text-slate-400" />
                        <span className="font-bold text-blue-700">ELMS: {cm.elmsClassGroupId}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-bold">{cm.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Synchronized Learning Events
            </h3>
            <span className="text-[10px] text-slate-500 font-bold">{events.length} Total Events</span>
          </div>

          {events.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No learning events received yet. Live ELMS learner activity, assessment submissions, and completions will appear here in real-time.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {events.map((evt) => (
                <div key={evt.eventId} className="p-4 flex items-center justify-between hover:bg-slate-50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900">{evt.eventType}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                          evt.status === 'PROCESSED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : evt.status === 'FAILED'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {evt.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-3">
                      <span>Event ID: {evt.eventId}</span>
                      {evt.learnerId && <span>Learner: {evt.learnerId}</span>}
                      {evt.resourceId && <span>Resource: {evt.resourceId}</span>}
                      <span>Idempotency: {evt.idempotencyKey}</span>
                    </div>
                    {evt.processingError && (
                      <div className="text-[10px] text-red-600 font-semibold">
                        Error: {evt.processingError}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-[10px] text-slate-400">
                    {new Date(evt.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ElmsIntegrationPanel;
