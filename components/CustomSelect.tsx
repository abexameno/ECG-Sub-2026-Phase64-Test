import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
  description?: string;
}

export interface CustomSelectProps {
  options: (SelectOption | string)[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  className?: string;
  variant?: 'default' | 'neo' | 'ecg' | 'purple';
  labelClassName?: string;
  noBorder?: boolean;
  id?: string;
  allowClear?: boolean;
  helpText?: string;
  footerAction?: {
    label: string;
    onClick: () => void;
  };
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  label,
  placeholder = 'Select an option',
  disabled = false,
  searchable = false,
  className = '',
  variant = 'ecg',
  labelClassName = 'text-slate-700',
  noBorder = false,
  id,
  allowClear = false,
  helpText,
  footerAction,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalize options to SelectOption interface
  const normalizedOptions: SelectOption[] = options.map(opt => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  // Filter options based on search query
  const filteredOptions = normalizedOptions.filter(opt =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (opt.description && opt.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectedOption = normalizedOptions.find(opt => opt.value === value);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when filtered options or open state changes
  useEffect(() => {
    setHighlightedIndex(0);
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen, searchQuery, searchable]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          filteredOptions.length > 0 ? (prev + 1) % filteredOptions.length : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          filteredOptions.length > 0 ? (prev - 1 + filteredOptions.length) % filteredOptions.length : 0
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions.length > 0 && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          onChange(filteredOptions[highlightedIndex].value);
          setIsOpen(false);
        }
        break;
      case 'Escape':
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  // Scroll highlighted option into view
  useEffect(() => {
    if (listRef.current && highlightedIndex >= 0) {
      const listElement = listRef.current;
      const highlightedElement = listElement.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        const listHeight = listElement.clientHeight;
        const listScrollTop = listElement.scrollTop;
        const elementHeight = highlightedElement.clientHeight;
        const elementOffsetTop = highlightedElement.offsetTop;

        if (elementOffsetTop < listScrollTop) {
          listElement.scrollTop = elementOffsetTop;
        } else if (elementOffsetTop + elementHeight > listScrollTop + listHeight) {
          listElement.scrollTop = elementOffsetTop + elementHeight - listHeight;
        }
      }
    }
  }, [highlightedIndex]);

  const handleSelectOption = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  // Styling constants matching Exameno ECG Dark Purple & Light Lavender theme
  const buttonBaseClass = "relative w-full text-left transition-all duration-150 focus:outline-none flex items-center justify-between text-slate-900 min-h-[44px]";
  
  let buttonBorderClass = "border border-slate-200 rounded-xl py-2.5 px-3.5 bg-white hover:border-[#3b1464] hover:bg-purple-50/20 focus:ring-2 focus:ring-purple-400/40 focus:border-[#3b1464] shadow-xs";
  if (noBorder) {
    buttonBorderClass = "border-0 py-2 px-2 bg-transparent";
  } else if (variant === 'default') {
    buttonBorderClass = "bg-white border border-slate-300 rounded-xl py-2.5 px-3.5 hover:border-slate-400 focus:border-[#3b1464] focus:ring-2 focus:ring-purple-400/30";
  }

  const dropdownBorderClass = "border border-slate-200 rounded-2xl bg-white overflow-hidden mt-1.5 shadow-xl shadow-purple-950/10";
  const labelId = id ? `${id}-label` : label ? `label-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`} onKeyDown={handleKeyDown}>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <label id={labelId} className={`block text-xs font-black uppercase tracking-wider ${labelClassName}`}>
            {label}
          </label>
          {allowClear && value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[10px] font-bold text-slate-400 hover:text-rose-600 flex items-center gap-0.5"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      )}
      
      <button
        id={id}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`${buttonBaseClass} ${buttonBorderClass} ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer'}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={labelId}
      >
        <span className="flex items-center gap-2 min-w-0 truncate mr-1">
          {selectedOption?.icon && (
            <span className="flex-shrink-0 text-[#3b1464]">{selectedOption.icon}</span>
          )}
          <span 
            className={`block truncate text-xs sm:text-sm ${selectedOption ? 'font-bold text-slate-900' : 'text-slate-400 font-medium'}`}
            title={selectedOption ? selectedOption.label : placeholder}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {allowClear && value && !disabled && !label && (
            <span
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#3b1464]' : ''}`} />
        </div>
      </button>

      {helpText && <p className="text-[11px] text-slate-500 mt-1">{helpText}</p>}

      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className={`absolute z-50 w-full ${dropdownBorderClass}`}
          >
            {searchable && (
              <div className="p-2 border-b border-slate-200 flex items-center gap-2 bg-purple-50/40">
                <Search className="w-4 h-4 text-purple-900/60 flex-shrink-0 ml-1" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search options..."
                  className="w-full text-xs font-medium bg-transparent border-none outline-none py-1 text-slate-800 placeholder-slate-400 focus:ring-0"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            <ul
              ref={listRef}
              className="max-h-60 overflow-y-auto py-1 divide-y divide-slate-50 custom-scrollbar"
              role="listbox"
              aria-labelledby={labelId}
            >
              {filteredOptions.length === 0 ? (
                <li className="py-4 px-4 text-xs font-medium text-slate-400 text-center">
                  No matching options
                </li>
              ) : (
                filteredOptions.map((option, idx) => {
                  const isSelected = value === option.value;
                  const isHighlighted = idx === highlightedIndex;
                  
                  return (
                    <li
                      key={option.value}
                      onClick={() => handleSelectOption(option.value)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`relative flex items-center justify-between py-2.5 px-3.5 cursor-pointer select-none transition-colors duration-100
                      ${isSelected ? 'bg-purple-100 text-purple-950 font-bold' : 'text-slate-700'}
                      ${isHighlighted && !isSelected ? 'bg-purple-50/60 text-[#3b1464]' : ''}
                      `}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <span className="flex items-center gap-2 min-w-0 truncate text-xs sm:text-sm">
                        {option.icon && (
                          <span className="flex-shrink-0 text-purple-800">{option.icon}</span>
                        )}
                        <span className="truncate">
                          <span className={`block truncate ${isSelected ? 'font-bold' : 'font-medium'}`}>
                            {option.label}
                          </span>
                          {option.description && (
                            <span className="block text-[10px] text-slate-500 font-normal truncate">
                              {option.description}
                            </span>
                          )}
                        </span>
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-[#3b1464] flex-shrink-0 ml-1.5" />
                      )}
                    </li>
                  );
                })
              )}
            </ul>
            {footerAction && (
              <div className="border-t border-slate-200 p-2 bg-slate-50 flex justify-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    footerAction.onClick();
                  }}
                  className="w-full text-center py-2 text-xs font-black text-purple-900 hover:text-purple-950 hover:bg-purple-100/60 rounded-xl transition-all border border-purple-200/40 bg-white shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>{footerAction.label}</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomSelect;
