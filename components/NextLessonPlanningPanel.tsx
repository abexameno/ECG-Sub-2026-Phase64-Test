import React, { useState, useEffect } from 'react';
import { User } from '../types.ts';
import { TeachingReflectionService } from '../services/teachingReflectionService.ts';
import { NextLessonRecommendation, RecommendationType, NextLessonPlan } from '../types/teachingReflection.ts';
import { Sparkles, CheckCircle2, ArrowRight, BookOpen, RefreshCw, Layers } from 'lucide-react';

interface NextLessonPlanningPanelProps {
  currentUser: User | null;
  schoolId: string;
  classGroupId: string;
  lessonReviewId: string;
  teachingPlanId: string;
  teachingAllocationId: string;
  curriculumVersionId: string;
  learningAreaId: string;
  learningOutcomeIds: string[];
}

export const NextLessonPlanningPanel: React.FC<NextLessonPlanningPanelProps> = ({
  currentUser,
  schoolId,
  classGroupId,
  lessonReviewId,
  teachingPlanId,
  teachingAllocationId,
  curriculumVersionId,
  learningAreaId,
  learningOutcomeIds,
}) => {
  const teacherId = currentUser?.id || 'teacher_default';
  const [recommendation, setRecommendation] = useState<NextLessonRecommendation | null>(null);
  const [reusableResources, setReusableResources] = useState<any[]>([]);
  const [selectedAction, setSelectedAction] = useState<RecommendationType>('REINFORCE');
  const [objective, setObjective] = useState('');
  const [isAccepted, setIsAccepted] = useState(false);
  const [createdPlan, setCreatedPlan] = useState<NextLessonPlan | null>(null);

  useEffect(() => {
    try {
      const rec = TeachingReflectionService.generateNextLessonRecommendation(lessonReviewId, schoolId, teacherId);
      setRecommendation(rec);
      setSelectedAction(rec.recommendationType);
      setObjective(`Next Lesson Focus (${rec.recommendationType}): Reinforce and apply learning outcomes.`);

      const resources = TeachingReflectionService.searchReusableResources(schoolId, learningOutcomeIds, learningAreaId);
      setReusableResources(resources);
    } catch (err: any) {
      console.error('Error generating recommendation:', err);
    }
  }, [lessonReviewId, schoolId, teacherId]);

  const handleAccept = () => {
    if (!recommendation) return;
    try {
      TeachingReflectionService.handleTeacherDecision(recommendation.id, schoolId, teacherId, 'ACCEPTED');
      const plan = TeachingReflectionService.createNextLessonPlan({
        schoolId,
        teacherId,
        classGroupId,
        sourceLessonReviewId: lessonReviewId,
        teachingPlanId,
        teachingAllocationId,
        curriculumVersionId,
        learningOutcomeIds,
        actionType: selectedAction,
        objective,
        resourceReferences: reusableResources.map(r => r.id),
        groupReferences: ['grp_default_core'],
        plannedDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      });
      setCreatedPlan(plan);
      setIsAccepted(true);
    } catch (err: any) {
      alert(`Error accepting recommendation: ${err.message}`);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Next-Lesson Planning & Adaptation</h2>
          <p className="text-xs text-slate-500 font-medium">Review deterministic recommendations and prepare the next learning experience.</p>
        </div>
        <span className="px-3 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded-full border border-purple-200">
          Teacher-Authored Decision
        </span>
      </div>

      {isAccepted && createdPlan ? (
        <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-4 animate-fade-in">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-emerald-900">Next Lesson Planned Successfully</h3>
              <p className="text-xs text-emerald-700">Authoritative working plan established without silent curriculum mutation.</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-emerald-100 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="font-bold text-slate-500">Action Type:</span>
              <span className="font-black text-slate-900">{createdPlan.actionType}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-slate-500">Objective:</span>
              <span className="font-medium text-slate-900">{createdPlan.objective}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-slate-500">Planned Date:</span>
              <span className="font-medium text-slate-900">{createdPlan.plannedDate}</span>
            </div>
          </div>
        </div>
      ) : recommendation ? (
        <div className="space-y-6">
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Recommended Next Step</span>
              <span className="px-3 py-1 bg-slate-900 text-white text-xs font-black rounded-lg">
                {recommendation.recommendationType}
              </span>
            </div>
            <p className="text-sm font-bold text-slate-900">{recommendation.reason}</p>
            <div className="pt-2 border-t border-slate-200/60 space-y-1">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Supporting Evidence:</span>
              <ul className="list-disc list-inside text-xs text-slate-600 space-y-0.5">
                {recommendation.evidenceReferences.map((ref, idx) => (
                  <li key={idx}>{ref}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Adjust Action Type (Optional Teacher Override)</label>
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value as RecommendationType)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-slate-400"
              >
                <option value="PROCEED">Proceed to Next Outcome</option>
                <option value="REINFORCE">Reinforce Core Concepts</option>
                <option value="RETEACH">Reteach Core Concepts</option>
                <option value="REASSESS">Reassess / Collect Evidence</option>
                <option value="EXTEND">Extend / Advanced Challenge</option>
                <option value="CONTINUE_SUPPORT">Continue Differentiated Support</option>
                <option value="REGROUP">Regroup Learners</option>
                <option value="TEACHER_DEFINED">Teacher Defined Action</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Next Lesson Objective</label>
              <input
                type="text"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-slate-400"
                placeholder="Enter objective for next lesson..."
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Reusable Resources ({reusableResources.length} Found)</label>
                <span className="text-xs text-slate-500 font-medium">Reuse-First Policy</span>
              </div>
              {reusableResources.length > 0 ? (
                <div className="space-y-2">
                  {reusableResources.slice(0, 3).map((res, i) => (
                    <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <BookOpen className="w-4 h-4 text-slate-500" />
                        <span className="font-bold text-slate-800">{res.title || 'Curriculum Resource Artifact'}</span>
                      </div>
                      <span className="text-slate-500 font-medium">{res.contentType || 'Lesson Plan'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl border border-slate-200">No pre-existing resources found. New content artifact can be generated if needed.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleAccept}
              className="px-6 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition-all flex items-center space-x-2"
            >
              <span>Accept Recommendation & Create Plan</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500 italic">Loading recommendations...</p>
      )}
    </div>
  );
};
