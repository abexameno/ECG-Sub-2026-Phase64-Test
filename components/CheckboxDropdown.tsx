import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ChevronDown, Check, BookOpen, CheckSquare, Square, X } from 'lucide-react';

export interface CheckboxOption {
  value: string;
  label: string;
  group?: string;
  description?: string;
}

interface CheckboxDropdownProps {
  label: string;
  options: CheckboxOption[];
  selectedValues: string[];
  onChange: (selectedValues: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  selectAllLabel?: string;
  className?: string;
  helpText?: string;
}

export const CheckboxDropdown: React.FC<CheckboxDropdownProps> = ({
  label,
  options,
  selectedValues,
  onChange,
  placeholder = 'Select options...',
  disabled = false,
  searchable = true,
  selectAllLabel = 'Select All',
  className = '',
  helpText
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen, searchable]);

  // Filter options by search query
  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (opt.group && opt.group.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const isAllSelected = options.length > 0 && selectedValues.length === options.length;
  const isSomeSelected = selectedValues.length > 0 && !isAllSelected;

  const handleToggleAll = () => {
    if (isAllSelected) {
      onChange([]);
    } else {
      onChange(options.map(o => o.value));
    }
  };

  const handleToggleItem = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter(v => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  // Group options if group field is present
  const groupedOptions = filteredOptions.reduce((acc, opt) => {
    const key = opt.group || 'Default';
    if (!acc[key]) acc[key] = [];
    acc[key].push(opt);
    return acc;
  }, {} as Record<string, CheckboxOption[]>);

  const hasGroups = Object.keys(groupedOptions).some(k => k !== 'Default');

  // Display text for button trigger
  const getButtonText = () => {
    if (disabled) return placeholder;
    if (selectedValues.length === 0) return placeholder;
    if (isAllSelected && options.length > 1) return `All Selected (${options.length})`;
    if (selectedValues.length === 1) {
      const match = options.find(o => o.value === selectedValues[0]);
      return match ? match.label : selectedValues[0];
    }
    return `${selectedValues.length} Selected`;
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
            {label}
          </label>
          {selectedValues.length > 0 && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[10px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-0.5"
            >
              <X className="w-3 h-3" /> Clear ({selectedValues.length})
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-left transition-all duration-200 border-2 bg-white text-slate-900 shadow-sm ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200'
            : isOpen
            ? 'border-emerald-600 ring-2 ring-emerald-500/20'
            : 'border-slate-800 hover:border-slate-900'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          <BookOpen className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span
            className={`block truncate text-xs sm:text-sm ${
              selectedValues.length > 0 ? 'font-bold text-slate-900' : 'text-slate-400 font-medium'
            }`}
            title={getButtonText()}
          >
            {getButtonText()}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {selectedValues.length > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-black bg-emerald-100 text-emerald-800 rounded-full">
              {selectedValues.length}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {helpText && <p className="text-[11px] text-slate-500 mt-1">{helpText}</p>}

      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 left-0 right-0 mt-1 bg-white border-2 border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-80 flex flex-col"
          >
            {/* Header controls: Search & Select All */}
            <div className="p-2 border-b border-slate-200 bg-slate-50 space-y-2 flex-shrink-0">
              {searchable && options.length > 4 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search options..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:border-emerald-600"
                  />
                </div>
              )}

              {options.length > 0 && (
                <div
                  onClick={handleToggleAll}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-200/60 cursor-pointer transition-colors text-xs font-bold text-slate-700"
                >
                  <span className="flex items-center gap-2">
                    {isAllSelected ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : isSomeSelected ? (
                      <div className="w-4 h-4 border-2 border-emerald-600 rounded bg-emerald-100 flex items-center justify-center">
                        <div className="w-2 h-0.5 bg-emerald-700" />
                      </div>
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                    <span>{selectAllLabel}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    ({selectedValues.length}/{options.length})
                  </span>
                </div>
              )}
            </div>

            {/* Options list */}
            <div className="overflow-y-auto custom-scrollbar p-1.5 space-y-1 flex-1">
              {filteredOptions.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 italic">
                  No matching options found
                </div>
              ) : hasGroups ? (
                Object.entries(groupedOptions).map(([groupName, groupOpts]) => (
                  <div key={groupName} className="space-y-1">
                    {groupName !== 'Default' && (
                      <div className="px-2.5 pt-2 pb-1 text-[10px] font-black text-emerald-800 uppercase tracking-wider bg-emerald-50/70 rounded-md">
                        {groupName}
                      </div>
                    )}
                    {groupOpts.map(opt => {
                      const checked = selectedValues.includes(opt.value);
                      return (
                        <div
                          key={opt.value}
                          onClick={e => handleToggleItem(opt.value, e)}
                          className={`flex items-start gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-colors text-xs ${
                            checked
                              ? 'bg-emerald-50 text-emerald-950 font-semibold'
                              : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <div className="pt-0.5 flex-shrink-0">
                            {checked ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="break-words leading-tight">{opt.label}</div>
                            {opt.description && (
                              <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                                {opt.description}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              ) : (
                filteredOptions.map(opt => {
                  const checked = selectedValues.includes(opt.value);
                  return (
                    <div
                      key={opt.value}
                      onClick={e => handleToggleItem(opt.value, e)}
                      className={`flex items-start gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-colors text-xs ${
                        checked
                          ? 'bg-emerald-50 text-emerald-950 font-semibold'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="pt-0.5 flex-shrink-0">
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="break-words leading-tight">{opt.label}</div>
                        {opt.description && (
                          <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                            {opt.description}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer summary bar */}
            <div className="p-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-[11px] text-slate-600 font-medium">
              <span>
                {selectedValues.length === 0
                  ? 'No items selected'
                  : `${selectedValues.length} item(s) selected`}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-2.5 py-1 text-[10px] font-bold bg-slate-800 text-white hover:bg-slate-900 rounded-md transition-colors"
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
