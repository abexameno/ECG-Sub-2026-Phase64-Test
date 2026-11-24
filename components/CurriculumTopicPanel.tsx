import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Search, 
  CheckSquare, 
  Square, 
  X, 
  CheckCircle, 
  Maximize2, 
  Check, 
  Sparkles,
  ChevronDown,
  ChevronRight,
  Layers,
  ListFilter,
  Lock
} from 'lucide-react';

export interface CurriculumTopicPanelProps {
  availableStrands: string[];
  selectedStrandNames: string[];
  subjectCurriculum: Record<string, string[]> | null;
  selectedSubStrandValues: string[];
  onStrandsChange: (selectedStrands: string[]) => void;
  onSubStrandsChange: (selectedSubStrandValues: string[]) => void;
  onSelectAll: () => void;
  onClear: () => void;
  error?: string;
  isStep5Enabled?: boolean;
  isStep6Enabled?: boolean;
}

export const CurriculumTopicPanel: React.FC<CurriculumTopicPanelProps> = ({
  availableStrands,
  selectedStrandNames,
  subjectCurriculum,
  selectedSubStrandValues,
  onStrandsChange,
  onSubStrandsChange,
  onSelectAll,
  onClear,
  error,
  isStep5Enabled = true,
  isStep6Enabled = true,
}) => {
  const [strandSearch, setStrandSearch] = useState('');
  const [subStrandSearch, setSubStrandSearch] = useState('');
  const [expandedStrands, setExpandedStrands] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Toggle expansion for a specific strand
  const toggleExpandStrand = (strand: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedStrands(prev => ({
      ...prev,
      [strand]: !prev[strand]
    }));
  };

  const handleExpandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    availableStrands.forEach(s => {
      allExpanded[s] = true;
    });
    setExpandedStrands(allExpanded);
  };

  const handleCollapseAll = () => {
    setExpandedStrands({});
  };

  // Toggle single strand
  const handleToggleStrand = (strandName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isStep5Enabled) return;

    if (selectedStrandNames.includes(strandName)) {
      onStrandsChange(selectedStrandNames.filter(s => s !== strandName));
    } else {
      onStrandsChange([...selectedStrandNames, strandName]);
      setExpandedStrands(prev => ({ ...prev, [strandName]: true }));
    }
  };

  // Toggle single sub-strand
  const handleToggleSubStrand = (value: string, strandName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isStep6Enabled) return;

    if (selectedSubStrandValues.includes(value)) {
      onSubStrandsChange(selectedSubStrandValues.filter(v => v !== value));
    } else {
      if (!selectedStrandNames.includes(strandName)) {
        onStrandsChange([...selectedStrandNames, strandName]);
      }
      onSubStrandsChange([...selectedSubStrandValues, value]);
    }
  };

  // Toggle all sub-strands under a specific strand
  const handleToggleAllSubStrandsForStrand = (strandName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isStep6Enabled) return;

    const subStrandsForStrand = subjectCurriculum?.[strandName] || [];
    const valuesForStrand = subStrandsForStrand.map(ss => `${strandName}:::${ss}`);
    const areAllSelected = valuesForStrand.every(v => selectedSubStrandValues.includes(v));

    if (areAllSelected) {
      onSubStrandsChange(selectedSubStrandValues.filter(v => !v.startsWith(`${strandName}:::`)));
    } else {
      if (!selectedStrandNames.includes(strandName)) {
        onStrandsChange([...selectedStrandNames, strandName]);
      }
      const newValues = Array.from(new Set([...selectedSubStrandValues, ...valuesForStrand]));
      onSubStrandsChange(newValues);
    }
  };

  // Filtered strands based on strandSearch
  const filteredStrands = useMemo(() => {
    const query = strandSearch.trim().toLowerCase();
    if (!query) return availableStrands;
    return availableStrands.filter(s => s.toLowerCase().includes(query));
  }, [availableStrands, strandSearch]);

  // Filtered sub-strands grouped by selected strand based on subStrandSearch
  const filteredSubStrandGroups = useMemo(() => {
    const query = subStrandSearch.trim().toLowerCase();
    return selectedStrandNames.map(strand => {
      const subStrands = subjectCurriculum?.[strand] || [];
      const matching = !query
        ? subStrands
        : subStrands.filter(ss => ss.toLowerCase().includes(query));
      return {
        strand,
        subStrands: matching,
      };
    });
  }, [selectedStrandNames, subjectCurriculum, subStrandSearch]);

  return (
    <div className="w-full space-y-6">
      {/* STEP 5: STRANDS */}
      <div className={`w-full space-y-2.5 transition-all duration-200 ${!isStep5Enabled ? 'opacity-60' : ''}`}>
        {/* Step Header */}
        <div className="flex items-center justify-between">
          <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-sm transition-colors ${
              selectedStrandNames.length > 0 ? 'bg-emerald-600 text-white' : isStep5Enabled ? 'bg-[#3b1464] text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              5
            </span>
            <Layers className={`w-4 h-4 ${isStep5Enabled ? 'text-emerald-600' : 'text-slate-400'}`} />
            Strands / Main Topics
          </label>

          {!isStep5Enabled ? (
            <span className="text-[11px] font-semibold text-slate-400 italic flex items-center gap-1">
              <Lock className="w-3 h-3" /> Select Academic Term above to unlock
            </span>
          ) : selectedStrandNames.length > 0 ? (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              {selectedStrandNames.length} Strand{selectedStrandNames.length > 1 ? 's' : ''} Selected
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-slate-500">
              {availableStrands.length} strand{availableStrands.length !== 1 ? 's' : ''} available
            </span>
          )}
        </div>

        {/* Locked Banner for Step 5 */}
        {!isStep5Enabled ? (
          <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400 font-medium">
            Complete Step 4 (Academic Term) above to load and select curriculum strands.
          </div>
        ) : (
          <div className="border border-slate-300 rounded-xl bg-white overflow-hidden space-y-0">
            {/* Strands Toolbar: Search + Action Buttons */}
            <div className="p-2.5 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={strandSearch}
                  onChange={e => setStrandSearch(e.target.value)}
                  placeholder="Search strands..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400"
                />
                {strandSearch && (
                  <button
                    type="button"
                    onClick={() => setStrandSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={onSelectAll}
                  disabled={availableStrands.length === 0}
                  className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> Select All
                </button>
                {selectedStrandNames.length > 0 && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="px-2 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-md"
                  title="Expand all sub-strand previews"
                >
                  Expand All
                </button>
              </div>
            </div>

            {/* Vertical List of Strands */}
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto custom-scrollbar">
              {filteredStrands.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 italic">
                  {availableStrands.length === 0
                    ? 'No strands available for this subject and term.'
                    : 'No strands matching search criteria.'}
                </div>
              ) : (
                filteredStrands.map(strand => {
                  const isSelected = selectedStrandNames.includes(strand);
                  const subStrands = subjectCurriculum?.[strand] || [];
                  const selectedSubForStrand = selectedSubStrandValues.filter(v =>
                    v.startsWith(`${strand}:::`)
                  );
                  const isExpanded = !!expandedStrands[strand];

                  return (
                    <div key={strand} className="w-full">
                      {/* Full-width Strand Row */}
                      <div
                        onClick={(e) => handleToggleStrand(strand, e)}
                        className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-emerald-50/70 hover:bg-emerald-100/60'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={(e) => handleToggleStrand(strand, e)}
                            className="p-0.5 rounded focus:outline-none flex-shrink-0"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 hover:text-slate-400" />
                            )}
                          </button>
                          <span className={`text-xs font-bold leading-snug break-words min-w-0 flex-1 ${
                            isSelected ? 'text-emerald-950' : 'text-slate-800'
                          }`}>
                            {strand}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                            selectedSubForStrand.length > 0
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {subStrands.length} sub-strand{subStrands.length !== 1 ? 's' : ''}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => toggleExpandStrand(strand, e)}
                            className={`p-1 text-slate-400 hover:text-slate-700 rounded-md transition-transform duration-200 ${
                              isExpanded ? 'rotate-180 text-emerald-700' : ''
                            }`}
                            title={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Smooth inline expanded preview of sub-strands */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18, ease: 'easeInOut' }}
                            className="overflow-hidden bg-slate-50/80 border-t border-b border-slate-100 pl-8 pr-3 py-2 space-y-1"
                          >
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                              Sub-strands preview:
                            </div>
                            {subStrands.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic">No sub-strands found.</p>
                            ) : (
                              subStrands.map(ss => {
                                const val = `${strand}:::${ss}`;
                                const isSubChecked = selectedSubStrandValues.includes(val);
                                return (
                                  <div
                                    key={val}
                                    onClick={(e) => handleToggleSubStrand(val, strand, e)}
                                    className={`py-1 px-2 rounded-md text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                      isSubChecked
                                        ? 'bg-emerald-100/80 text-emerald-900 font-semibold'
                                        : 'hover:bg-slate-200/60 text-slate-700'
                                    }`}
                                  >
                                    <span className="break-words leading-tight min-w-0 flex-1">{ss}</span>
                                    {isSubChecked && (
                                      <span className="text-[9px] font-bold text-emerald-700 bg-white px-1.5 py-0.2 rounded border border-emerald-300">
                                        Selected
                                      </span>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* STEP 6: SUB-STRANDS */}
      <div className={`w-full space-y-2.5 transition-all duration-200 ${!isStep6Enabled ? 'opacity-60' : ''}`}>
        {/* Step Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-sm transition-colors ${
              selectedSubStrandValues.length > 0 ? 'bg-emerald-600 text-white' : isStep6Enabled ? 'bg-[#3b1464] text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              6
            </span>
            <ListFilter className={`w-4 h-4 ${isStep6Enabled ? 'text-emerald-600' : 'text-slate-400'}`} />
            Sub-strands / Specific Topics
          </label>

          {!isStep6Enabled ? (
            <span className="text-[11px] font-semibold text-slate-400 italic flex items-center gap-1">
              <Lock className="w-3 h-3" /> Select at least 1 Strand above to unlock
            </span>
          ) : selectedSubStrandValues.length > 0 ? (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              {selectedSubStrandValues.length} Sub-strand{selectedSubStrandValues.length > 1 ? 's' : ''} Selected
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-slate-500">
              Select specific sub-topics
            </span>
          )}
        </div>

        {/* Locked Banner for Step 6 */}
        {!isStep6Enabled ? (
          <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400 font-medium">
            Select one or more strands in Step 5 above to view and select specific sub-strands.
          </div>
        ) : (
          <div className="border border-slate-300 rounded-xl bg-white overflow-hidden space-y-0">
            {/* Sub-strands Toolbar: Search */}
            <div className="p-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={subStrandSearch}
                  onChange={e => setSubStrandSearch(e.target.value)}
                  placeholder="Search sub-strands..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400"
                />
                {subStrandSearch && (
                  <button
                    type="button"
                    onClick={() => setSubStrandSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Sub-strands grouped list */}
            <div className="p-2.5 max-h-72 overflow-y-auto space-y-3 custom-scrollbar">
              {filteredSubStrandGroups.map(({ strand, subStrands }) => {
                const totalInStrand = subjectCurriculum?.[strand] || [];
                const selectedInStrand = totalInStrand.filter(ss =>
                  selectedSubStrandValues.includes(`${strand}:::${ss}`)
                );
                const areAllInStrandSelected =
                  totalInStrand.length > 0 && selectedInStrand.length === totalInStrand.length;

                return (
                  <div key={strand} className="space-y-1.5 border-b border-slate-100 pb-2.5 last:border-b-0">
                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200/80 gap-2">
                      <span className="text-[11px] font-black text-emerald-950 flex-1 min-w-0 break-words leading-tight">
                        {strand}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleToggleAllSubStrandsForStrand(strand, e)}
                        className="shrink-0 text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded transition-colors"
                      >
                        {areAllInStrandSelected ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-1 pl-1">
                      {subStrands.length === 0 ? (
                        <div className="p-2 text-xs text-slate-400 italic">
                          No matching sub-strands found for search.
                        </div>
                      ) : (
                        subStrands.map(subStrand => {
                          const val = `${strand}:::${subStrand}`;
                          const isChecked = selectedSubStrandValues.includes(val);

                          return (
                            <div
                              key={val}
                              onClick={(e) => handleToggleSubStrand(val, strand, e)}
                              className={`w-full py-2 px-3 rounded-lg flex items-center justify-between gap-3 cursor-pointer transition-all border ${
                                isChecked
                                  ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 font-semibold shadow-2xs'
                                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleSubStrand(val, strand, e)}
                                  className="p-0.5 rounded focus:outline-none flex-shrink-0"
                                >
                                  {isChecked ? (
                                    <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Square className="w-3.5 h-3.5 text-slate-300" />
                                  )}
                                </button>
                                <span className="text-xs break-words leading-tight">
                                  {subStrand}
                                </span>
                              </div>

                              {isChecked && (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex-shrink-0">
                                  Selected
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-red-500 text-xs font-bold pt-1">{error}</p>}
    </div>
  );
};
