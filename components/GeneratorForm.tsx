import React, { useRef, useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FormState,
  ContentType,
  QuestionType,
  QuestionDifficulty,
  ROWCLessonEntry,
} from "../types.ts";
import { SchoolConfigService } from "../services/schoolConfigService.ts";
import { CanonicalCurriculumService } from "../services/canonicalCurriculumService.ts";
import { SowSchedulingService } from "../services/sowSchedulingService.ts";
import {
  GRADES,
  CONTENT_TYPES,
  ASSESSMENT_QUESTION_TYPES,
  SUBJECTS_BY_GRADE,
} from "../constants.tsx";
import { getCurriculumByTerm } from "../curriculumData.ts";
import { parseDocument } from "../services/documentParser.ts";
import { CustomSelect } from "./CustomSelect.tsx";
import { CheckboxDropdown, CheckboxOption } from "./CheckboxDropdown.tsx";
import { CurriculumTopicPanel } from "./CurriculumTopicPanel.tsx";
import { ContentTypeIcon } from "./ContentTypeIcon.tsx";
import { Tooltip } from "./Tooltip.tsx";
import { GeneratorGuide } from "./GeneratorGuide.tsx";
import { ContextHelp } from "./ContextHelp.tsx";
import {
  GraduationCap,
  BookOpen,
  Calendar,
  BarChart,
  Sparkles,
  Settings,
  FileText,
  Info,
  GraduationCap as Cap,
  Clock,
  CheckCircle,
  HelpCircle,
  Plus,
  Trash2,
  Users,
  Upload,
  Lock,
  X,
  Layers,
  ListFilter,
} from "lucide-react";

interface GeneratorFormProps {
  formState: FormState;
  setFormState: React.Dispatch<React.SetStateAction<FormState>>;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  progress?: number;
  onStartNew: () => void;
  onAddSchoolClick?: () => void;
}

const MultiSelectDropdown: React.FC<{
  options: string[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}> = ({
  options,
  selectedOptions,
  onChange,
  placeholder,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleOptionToggle = (option: string) => {
    const newSelection = selectedOptions.includes(option)
      ? selectedOptions.filter((item) => item !== option)
      : [...selectedOptions, option];
    onChange(newSelection.sort());
  };

  const displayText =
    selectedOptions.length > 0 ? selectedOptions.join(", ") : placeholder;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="block w-full text-left bg-white border border-slate-200 text-slate-900 rounded-md p-2 truncate disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <span className="flex justify-between items-center">
          <span className="truncate pr-2">{displayText}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 text-gray-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>
      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-mint border border-slate-200 rounded-md max-h-60 overflow-auto">
          {options.map((option) => (
            <label
              key={option}
              className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-white/50 border-b border-slate-200 last:border-b-0"
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-200 text-emerald-600 focus:ring-emerald-500"
                checked={selectedOptions.includes(option)}
                onChange={() => handleOptionToggle(option)}
              />
              <span className="text-sm text-gray-700">{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

const StrandItem: React.FC<{
  strand: string;
  subStrands: string[];
  selection: string[] | undefined;
  onStrandChange: (strand: string, checked: boolean) => void;
  onSubStrandChange: (
    strand: string,
    subStrand: string,
    checked: boolean,
  ) => void;
}> = ({ strand, subStrands, selection, onStrandChange, onSubStrandChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const strandCheckboxRef = useRef<HTMLInputElement>(null);

  const isFullStrandSelected =
    selection !== undefined && selection.length === 0;
  const selectedSubStrandCount = Array.isArray(selection)
    ? selection.length
    : 0;
  const totalSubStrands = Array.isArray(subStrands) ? subStrands.length : 0;

  const areAllSubStrandsSelected =
    isFullStrandSelected ||
    (selectedSubStrandCount > 0 && selectedSubStrandCount === totalSubStrands);
  const isPartiallySelected =
    !isFullStrandSelected &&
    selectedSubStrandCount > 0 &&
    selectedSubStrandCount < totalSubStrands;

  useEffect(() => {
    if (strandCheckboxRef.current) {
      strandCheckboxRef.current.indeterminate = isPartiallySelected;
    }
  }, [isPartiallySelected]);

  return (
    <div className="py-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center space-x-3 cursor-pointer p-2 flex-grow hover:bg-white/50 rounded-md">
          <input
            ref={strandCheckboxRef}
            type="checkbox"
            className="h-4 w-4 rounded border-slate-200 text-emerald-600 focus:ring-emerald-500"
            checked={areAllSubStrandsSelected}
            onChange={(e) => onStrandChange(strand, e.target.checked)}
          />
          <span className="font-semibold text-gray-800">{strand}</span>
        </label>
        {totalSubStrands > 0 && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
            aria-expanded={isExpanded}
            aria-label={
              isExpanded ? "Collapse sub-strands" : "Expand sub-strands"
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
      {isExpanded && totalSubStrands > 0 && (
        <div className="pl-8 pt-1 space-y-1 border-l-2 border-slate-200 ml-4">
          {subStrands.map((subStrand) => {
            const isChecked =
              isFullStrandSelected || (selection?.includes(subStrand) ?? false);
            return (
              <label
                key={subStrand}
                className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-white/50 rounded-md"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-200 text-emerald-600 focus:ring-emerald-500"
                  checked={isChecked}
                  onChange={(e) =>
                    onSubStrandChange(strand, subStrand, e.target.checked)
                  }
                />
                <span className="text-sm text-gray-600">{subStrand}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const GeneratorForm: React.FC<GeneratorFormProps> = ({
  formState,
  setFormState,
  onSubmit,
  isLoading,
  progress = 0,
  onStartNew,
  onAddSchoolClick,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const markingSchemeFileInputRef = useRef<HTMLInputElement>(null);

  const [fileError, setFileError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const [markingSchemeFileError, setMarkingSchemeFileError] = useState<
    string | null
  >(null);
  const [markingSchemeFileInfo, setMarkingSchemeFileInfo] = useState<
    string | null
  >(null);
  const [isProcessingMarkingScheme, setIsProcessingMarkingScheme] =
    useState(false);

  const [activeSection, setActiveSection] = useState<"topic" | "assessment">(
    "topic",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [termChangeWarning, setTermChangeWarning] = useState<string | null>(null);

  const [loadingStep, setLoadingStep] = useState(0);
  const loadingMessages = [
    "Analyzing curriculum requirements...",
    "Structuring document flow...",
    "Generating content...",
    "Formatting for Kenyan standards...",
    "Finalizing options...",
    "Applying teacher nuances...",
  ];

  useEffect(() => {
    let interval: any;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingMessages.length);
      }, 2500);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const [subjectOptions, setSubjectOptions] = useState<string[]>(
    SUBJECTS_BY_GRADE[formState.grade] || [],
  );

  const contentTypeOptions = useMemo(() => {
    return CONTENT_TYPES.map((c) => ({
      value: c,
      label: c,
      icon: <ContentTypeIcon type={c} className="h-5 w-5" />,
    }));
  }, []);

  const gradeOptions = useMemo(() => {
    return GRADES.map((g) => ({
      value: g,
      label: g,
      icon: <GraduationCap className="h-4 w-4" />,
    }));
  }, []);

  const getSubjectOptions = (grade: string) => {
    const subjects = SUBJECTS_BY_GRADE[grade] || [];
    return subjects.map((s) => ({
      value: s,
      label: s,
      icon: <BookOpen className="h-4 w-4" />,
    }));
  };

  const currentSubjectOptions = useMemo(() => {
    const subjects = SUBJECTS_BY_GRADE[formState.grade] || [];
    return subjects.map((s) => ({
      value: s,
      label: s,
      icon: <BookOpen className="h-4 w-4" />,
    }));
  }, [formState.grade]);

  const isRowcType = formState.contentType === ContentType.RecordOfWorkCovered;
  const isSchemeOfWorkType = formState.contentType === ContentType.SchemeOfWork;
  const isLessonPlan = formState.contentType === ContentType.LessonPlan;
  const isAssessmentType = [
    ContentType.Assessment,
    ContentType.Quiz,
    ContentType.TopicExam,
    ContentType.TermExam,
  ].includes(formState.contentType);

  const termOptions = useMemo(() => {
    const baseTerms = ["Term 1", "Term 2", "Term 3"];
    const options = isSchemeOfWorkType
      ? baseTerms
      : ["All Terms", ...baseTerms];
    return options.map((t) => ({
      value: t,
      label: t === "All Terms" ? "All Terms (Full Academic Year)" : t,
      icon: <Calendar className="h-4 w-4" />,
    }));
  }, [isSchemeOfWorkType]);

  const [selectedStrand, setSelectedStrand] = useState<string>("");
  const [selectedSubStrand, setSelectedSubStrand] = useState<string>("");

  // Currently selected strand names
  const selectedStrandNames = useMemo(() => {
    return Object.keys(formState.multiSelectTopics || {});
  }, [formState.multiSelectTopics]);

  // Dynamically load curriculum based on Term selection
  const subjectCurriculum = useMemo(() => {
    const selectedTerms =
      formState.terms && formState.terms.length > 0
        ? formState.terms
        : formState.term
          ? [formState.term]
          : ["All Terms"];
    return getCurriculumByTerm(
      formState.grade,
      formState.subject,
      selectedTerms,
    );
  }, [formState.grade, formState.subject, formState.terms, formState.term]);

  const availableStrands = useMemo(() => {
    return subjectCurriculum ? Object.keys(subjectCurriculum) : [];
  }, [subjectCurriculum]);

  // Options for Strand Checkbox Dropdown
  const strandCheckboxOptions: CheckboxOption[] = useMemo(() => {
    return availableStrands.map((s) => ({
      value: s,
      label: s,
    }));
  }, [availableStrands]);

  // Options for Sub-strand Checkbox Dropdown
  const subStrandCheckboxOptions: CheckboxOption[] = useMemo(() => {
    const opts: CheckboxOption[] = [];
    selectedStrandNames.forEach((strand) => {
      const subStrands = subjectCurriculum?.[strand] || [];
      subStrands.forEach((ss) => {
        opts.push({
          value: `${strand}:::${ss}`,
          label: ss,
          group: selectedStrandNames.length > 1 ? strand : undefined,
        });
      });
    });
    return opts;
  }, [selectedStrandNames, subjectCurriculum]);

  // Currently selected sub-strand values
  const selectedSubStrandValues = useMemo(() => {
    const values: string[] = [];
    selectedStrandNames.forEach((strand) => {
      const subStrandList = formState.multiSelectTopics?.[strand] || [];
      const allSubStrandsForStrand = subjectCurriculum?.[strand] || [];

      if (subStrandList.length === 0) {
        allSubStrandsForStrand.forEach((ss) => {
          values.push(`${strand}:::${ss}`);
        });
      } else {
        subStrandList.forEach((ss) => {
          values.push(`${strand}:::${ss}`);
        });
      }
    });
    return values;
  }, [selectedStrandNames, formState.multiSelectTopics, subjectCurriculum]);

  // Requested terms for SOW capacity evaluation
  const requestedSowTerms = useMemo(() => {
    return formState.terms && formState.terms.length > 0
      ? formState.terms
      : formState.term
        ? [formState.term]
        : ["Term 1"];
  }, [formState.terms, formState.term]);

  const effectiveTeachingWeeks = Number(
    formState.teachingWeeks !== undefined
      ? formState.teachingWeeks
      : (formState.schoolId && formState.schoolId !== 'independent'
          ? SchoolConfigService.getTeachingConfig(formState.schoolId).teachingWeeksPerTerm
          : 10)
  ) || 10;

  const effectiveLessonsPerWeek = Number(
    formState.lessonsPerWeek !== undefined
      ? formState.lessonsPerWeek
      : (formState.schoolId && formState.schoolId !== 'independent'
          ? SchoolConfigService.getTeachingConfig(formState.schoolId).lessonsPerWeek
          : 5)
  ) || 5;

  const capacityEvaluation = useMemo(() => {
    if (!isSchemeOfWorkType || !formState.grade || !formState.subject) return null;
    return SowSchedulingService.evaluateCapacity({
      grade: formState.grade,
      subject: formState.subject,
      terms: requestedSowTerms,
      teachingWeeks: effectiveTeachingWeeks,
      lessonsPerWeek: effectiveLessonsPerWeek,
    });
  }, [isSchemeOfWorkType, formState.grade, formState.subject, requestedSowTerms, effectiveTeachingWeeks, effectiveLessonsPerWeek]);

  useEffect(() => {
    setSelectedStrand("");
    setSelectedSubStrand("");
  }, [formState.grade, formState.subject, formState.term]);

  useEffect(() => {
    if (
      isSchemeOfWorkType &&
      (formState.term === "All Terms" || formState.terms?.includes("All Terms"))
    ) {
      setFormState((prev) => ({
        ...prev,
        term: "Term 1",
        terms: ["Term 1"],
        multiSelectTopics: {},
      }));
    }
  }, [isSchemeOfWorkType, formState.term, formState.terms, setFormState]);

  // Enable curriculum accordion for SOW, Plans, and Notes
  const enableCurriculumAccordion = !isRowcType;

  // Enforce Strict Curriculum Adherence for Schemes of Work
  useEffect(() => {
    if (isSchemeOfWorkType && !formState.strictCurriculumAdherence) {
      setFormState((prev) => ({ ...prev, strictCurriculumAdherence: true }));
    }
  }, [isSchemeOfWorkType, formState.strictCurriculumAdherence, setFormState]);

  // Effect to set professional template for lesson plans
  useEffect(() => {
    if (formState.contentType === ContentType.LessonPlan) {
      setFormState((prev) => ({
        ...prev,
        additionalInstructions:
          "Template: Structured & Professional (Best for Portfolios)",
      }));
    }
  }, [formState.contentType, setFormState]);

  // Effect to set default question counts and marks when switching to Assessment types
  useEffect(() => {
    if (isAssessmentType) {
      const currentTotal = Object.values(formState.questionCounts).reduce(
        (a: number, b: number | undefined) => a + (b || 0),
        0,
      );

      if (currentTotal === 0) {
        setFormState((prev) => ({
          ...prev,
          distributionMode: "manual",
          totalQuestions: 25,
          generateImages: false, // Do not automatically generate diagrams for CBA/Quizzes
          questionCounts: {
            [QuestionType.MultipleChoice]: 20,
            [QuestionType.ShortAnswer]: 5,
            [QuestionType.TrueFalse]: 0,
            [QuestionType.Essay]: 0,
            [QuestionType.Discussion]: 0,
          },
          questionMarks: {
            [QuestionType.MultipleChoice]: 1,
            [QuestionType.TrueFalse]: 1,
            [QuestionType.ShortAnswer]: 2,
            [QuestionType.Essay]: 0,
            [QuestionType.Discussion]: 0,
          },
        }));
      } else {
        // Ensure generateImages is off when switching to assessment type
        setFormState((prev) => ({ ...prev, generateImages: false }));
      }
    }
  }, [formState.contentType, isAssessmentType, setFormState]);

  useEffect(() => {
    const newSubjectOptions = SUBJECTS_BY_GRADE[formState.grade] || [];
    setSubjectOptions(newSubjectOptions);

    if (formState.teacherActionContext || formState.sowLessonContext) {
      return;
    }

    if (!newSubjectOptions.includes(formState.subject)) {
      setFormState((prev) => ({
        ...prev,
        subject: newSubjectOptions[0] || "",
        multiSelectTopics: {},
        topic: "",
      }));
    } else {
      setFormState((prev) => ({
        ...prev,
        multiSelectTopics: {},
        topic: prev.topicInputMode === "curriculum" ? "" : prev.topic,
      }));
    }
  }, [formState.grade, formState.subject, formState.teacherActionContext, formState.sowLessonContext, setFormState]);

  useEffect(() => {
    if (formState.topicInputMode === "manual" || isRowcType) return;

    const { multiSelectTopics } = formState;
    const hasMultiSelectTopics =
      multiSelectTopics && Object.keys(multiSelectTopics).length > 0;

    if (hasMultiSelectTopics && subjectCurriculum) {
      const topicParts = Object.entries(multiSelectTopics).map(
        ([strand, subStrands]) => {
          if (!Array.isArray(subStrands)) return null;
          if (subStrands.length === 0) {
            const allSubStrands = subjectCurriculum[strand] || [];
            if (allSubStrands.length > 0) {
              return `${strand} (covering: ${allSubStrands.join(", ")})`;
            }
            return strand;
          } else {
            return `${strand} (specifically covering: ${subStrands.join(", ")})`;
          }
        },
      );

      const topicList = topicParts
        .filter(Boolean)
        .map((part, index) => `${index + 1}. ${part}`)
        .join("\n");
      const fullTopic = `Content covering the following curriculum topics:\n${topicList}`;

      setFormState((prev) => {
        if (prev.topic !== fullTopic) {
          return { ...prev, topic: fullTopic };
        }
        return prev;
      });
    } else {
      setFormState((prev) => {
        if (prev.topic !== "") {
          return { ...prev, topic: "" };
        }
        return prev;
      });
    }
  }, [
    formState.topicInputMode,
    formState.multiSelectTopics,
    formState.grade,
    formState.subject,
    isRowcType,
    subjectCurriculum,
    setFormState,
  ]);

  useEffect(() => {
    if (!formState.documentFile && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (!formState.markingSchemeFile && markingSchemeFileInputRef.current) {
      markingSchemeFileInputRef.current.value = "";
    }
  }, [formState.documentFile, formState.markingSchemeFile]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === "checkbox";
    const checked = isCheckbox
      ? (e.target as HTMLInputElement).checked
      : undefined;

    if (name in formState.questionCounts) {
      const parsedValue = parseInt(value, 10);
      const finalValue =
        isNaN(parsedValue) || parsedValue < 0 ? 0 : parsedValue;

      setFormState((prev) => ({
        ...prev,
        questionCounts: { ...prev.questionCounts, [name]: finalValue },
      }));

      if (errors.questionCounts) {
        setErrors((prev) => {
          const updatedErrors = { ...prev };
          delete updatedErrors.questionCounts;
          return updatedErrors;
        });
      }
    } else {
      setFormState((prev) => ({
        ...prev,
        [name]: isCheckbox ? checked : value,
      }));
    }
    if (errors[name]) {
      setErrors((prev) => {
        const updatedErrors = { ...prev };
        delete updatedErrors[name];
        return updatedErrors;
      });
    }
  };

  const handleMarksChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const type = name.replace("mark_", "") as QuestionType;
    const parsedValue = parseInt(value, 10);
    const finalValue = isNaN(parsedValue) || parsedValue < 0 ? 0 : parsedValue;

    setFormState((prev) => ({
      ...prev,
      questionMarks: { ...prev.questionMarks, [type]: finalValue },
    }));
  };

  const handleTermSelectChange = (val: string) => {
    const value = val as "Term 1" | "Term 2" | "Term 3" | "All Terms" | "";
    const hasExistingTopics = Object.keys(formState.multiSelectTopics || {}).length > 0;

    setFormState((prev) => ({
      ...prev,
      term: value as any,
      terms:
        value === "All Terms" ? ["All Terms"] : value ? [value as any] : [],
      multiSelectTopics: {},
    }));
    setSelectedStrand("");
    setSelectedSubStrand("");

    if (hasExistingTopics) {
      setTermChangeWarning(
        `Academic Term changed to ${value}. Curriculum topics were refreshed for the new term and previous topic selections reset.`
      );
    } else {
      setTermChangeWarning(null);
    }

    if (errors.terms) {
      setErrors((prev) => {
        const updatedErrors = { ...prev };
        delete updatedErrors.terms;
        return updatedErrors;
      });
    }
  };

  const handleStrandCheckboxChange = (newSelectedStrandNames: string[]) => {
    setFormState((prev) => {
      const updatedTopics: { [strand: string]: string[] } = {};
      newSelectedStrandNames.forEach((s) => {
        updatedTopics[s] = prev.multiSelectTopics?.[s] || [];
      });
      return { ...prev, multiSelectTopics: updatedTopics };
    });
    if (errors.topic) {
      setErrors((prev) => {
        const updatedErrors = { ...prev };
        delete updatedErrors.topic;
        return updatedErrors;
      });
    }
  };

  const handleSubStrandCheckboxChange = (newSelectedValues: string[]) => {
    setFormState((prev) => {
      const updatedTopics: { [strand: string]: string[] } = {};
      selectedStrandNames.forEach((strand) => {
        const allSubStrandsForStrand = subjectCurriculum?.[strand] || [];
        const selectedForThisStrand = newSelectedValues
          .filter((val) => val.startsWith(`${strand}:::`))
          .map((val) => val.replace(`${strand}:::`, ""));

        if (
          selectedForThisStrand.length === allSubStrandsForStrand.length ||
          selectedForThisStrand.length === 0
        ) {
          updatedTopics[strand] = [];
        } else {
          updatedTopics[strand] = selectedForThisStrand;
        }
      });
      return { ...prev, multiSelectTopics: updatedTopics };
    });
  };

  const handleSelectAllStrands = () => {
    const allTopics: { [strand: string]: string[] } = {};
    availableStrands.forEach((s) => {
      allTopics[s] = [];
    });
    setFormState((prev) => ({ ...prev, multiSelectTopics: allTopics }));
  };

  const handleClearStrandSelection = () => {
    setFormState((prev) => ({ ...prev, multiSelectTopics: {} }));
  };

  const handleAddWeek = () => {
    if (formState.week) {
      setFormState((prev) => {
        const currentWeeks = prev.selectedWeeks || [];
        if (currentWeeks.length >= 3) {
          alert("Maximum of 3 weeks can be selected.");
          return prev;
        }
        if (currentWeeks.includes(prev.week!)) {
          return prev; // already added
        }
        return {
          ...prev,
          selectedWeeks: [...currentWeeks, prev.week!],
        };
      });
    }
  };

  const handleRemoveWeek = (weekToRemove: string) => {
    setFormState((prev) => ({
      ...prev,
      selectedWeeks: prev.selectedWeeks?.filter((w) => w !== weekToRemove),
    }));
  };

  const handleAddLesson = () => {
    if (formState.week && formState.lessonNumber) {
      setFormState((prev) => ({
        ...prev,
        selectedLessons: [
          ...(prev.selectedLessons || []),
          { week: prev.week!, lesson: prev.lessonNumber! },
        ],
      }));
    }
  };

  const handleRemoveLesson = (index: number) => {
    setFormState((prev) => ({
      ...prev,
      selectedLessons: prev.selectedLessons?.filter((_, i) => i !== index),
    }));
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    fileType: "documentFile" | "markingSchemeFile",
  ) => {
    const file = e.target.files?.[0];
    const isDoc = fileType === "documentFile";
    const setError = isDoc ? setFileError : setMarkingSchemeFileError;
    const setInfo = isDoc ? setFileInfo : setMarkingSchemeFileInfo;
    const setProcessing = isDoc
      ? setIsProcessingFile
      : setIsProcessingMarkingScheme;

    setFormState((prev) => ({
      ...prev,
      [isDoc ? "documentFile" : "markingSchemeFile"]: undefined,
      [isDoc ? "documentText" : "markingSchemeText"]: "",
      [isDoc ? "documentImageBase64" : "markingSchemeImageBase64"]: undefined,
      [isDoc ? "documentImageMimeType" : "markingSchemeImageMimeType"]:
        undefined,
    }));
    setError(null);
    setInfo(null);
    e.target.value = "";

    if (!file) return;

    const MAX_FILE_SIZE_MB = 10;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File is too large. Max size is ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    const allowedExtensions = [
      ".txt",
      ".pdf",
      ".doc",
      ".docx",
      ".jpg",
      ".jpeg",
      ".png",
    ];
    const fileExtension = `.${file.name.split(".").pop()?.toLowerCase()}`;

    if (!allowedExtensions.includes(fileExtension)) {
      setError(
        `Unsupported file. Please upload: ${allowedExtensions.join(", ")}`,
      );
      return;
    }

    setFormState((prev) => ({
      ...prev,
      [isDoc ? "documentFile" : "markingSchemeFile"]: file,
    }));
    setProcessing(true);

    try {
      if ([".jpg", ".jpeg", ".png"].includes(fileExtension)) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          const base64 = dataUrl.split(",")[1];
          setFormState((prev) => ({
            ...prev,
            [isDoc ? "documentImageBase64" : "markingSchemeImageBase64"]:
              base64,
            [isDoc ? "documentImageMimeType" : "markingSchemeImageMimeType"]:
              file.type,
            ...(isDoc ? { topicInputMode: "manual", topic: "" } : {}),
          }));
          setProcessing(false);
        };
        reader.readAsDataURL(file);
      } else {
        const textContent = await parseDocument(file);

        if (!textContent || textContent.trim() === "") {
          throw new Error("No text content could be extracted from the file.");
        }

        setFormState((prev) => ({
          ...prev,
          [isDoc ? "documentText" : "markingSchemeText"]: textContent,
          ...(isDoc ? { topicInputMode: "manual", topic: "" } : {}),
        }));

        setInfo(`Successfully extracted ${textContent.length} characters.`);
        setProcessing(false);
      }
    } catch (err: any) {
      console.error("File processing error:", err);
      setError(err.message || "Failed to process the file.");
      setProcessing(false);
    }
  };

  const handleTotalQuestionsChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const val = parseInt(e.target.value, 10);
    setFormState((prev) => ({
      ...prev,
      totalQuestions: isNaN(val) || val < 1 ? 1 : val,
    }));
    if (errors.totalQuestions) {
      setErrors((prev) => {
        const updatedErrors = { ...prev };
        delete updatedErrors.totalQuestions;
        return updatedErrors;
      });
    }
  };

  const handleROWCToggleChange = (
    lessonId: string,
    field: "strandInputMode" | "subStrandInputMode",
    value: "curriculum" | "manual",
  ) => {
    setFormState((prev) => {
      if (!prev.rowcData || !Array.isArray(prev.rowcData.lessons)) return prev;
      const updatedLessons = prev.rowcData.lessons.map((lesson) => {
        if (lesson.id === lessonId) {
          const updatedLesson = { ...lesson, [field]: value };
          if (value === "curriculum") {
            if (field === "strandInputMode") updatedLesson.strand = "";
            if (field === "subStrandInputMode") updatedLesson.subStrand = "";
          }
          return updatedLesson;
        }
        return lesson;
      });
      return {
        ...prev,
        rowcData: { ...prev.rowcData, lessons: updatedLessons },
      };
    });
  };

  const handleROWCLessonChange = (
    id: string,
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormState((prev) => {
      if (!prev.rowcData || !Array.isArray(prev.rowcData.lessons)) return prev;
      const updatedLessons = prev.rowcData.lessons.map((lesson) => {
        if (lesson.id === id) {
          const updatedLesson: ROWCLessonEntry = {
            ...lesson,
            [name as keyof ROWCLessonEntry]: value,
          };
          if (name === "grade") {
            updatedLesson.subject = "";
            updatedLesson.strand = "";
            updatedLesson.subStrand = "";
          } else if (name === "subject") {
            updatedLesson.strand = "";
            updatedLesson.subStrand = "";
          } else if (name === "strand") {
            updatedLesson.subStrand = "";
          }
          return updatedLesson;
        }
        return lesson;
      });
      return {
        ...prev,
        rowcData: { ...prev.rowcData, lessons: updatedLessons },
      };
    });
    const lessonIndex = formState.rowcData!.lessons.findIndex(
      (l) => l.id === id,
    );
    const errorKey = `lesson_${lessonIndex}_${name}`;
    if (errors[errorKey]) {
      setErrors((prev) => {
        const updatedErrors = { ...prev };
        delete updatedErrors[errorKey];
        return updatedErrors;
      });
    }
  };

  const addROWCLesson = () => {
    setFormState((prev) => {
      const newLesson: ROWCLessonEntry = {
        id: `lesson_${Date.now()}`,
        date: "",
        grade: "",
        subject: "",
        term: "",
        strand: "",
        subStrand: "",
        strandInputMode: "curriculum",
        subStrandInputMode: "curriculum",
        lessonTitle: "",
        learningActivities: "",
        resources: "",
        assessment: "",
        remarks: "",
      };
      const lessons = prev.rowcData?.lessons || [];
      return {
        ...prev,
        rowcData: { ...prev.rowcData!, lessons: [...lessons, newLesson] },
      };
    });
  };

  const removeROWCLesson = (id: string) => {
    setFormState((prev) => {
      if (!prev.rowcData) return prev;
      return {
        ...prev,
        rowcData: {
          ...prev.rowcData,
          lessons: prev.rowcData.lessons.filter((l) => l.id !== id),
        },
      };
    });
  };

  const handleStrandChange = (strand: string, isChecked: boolean) => {
    setFormState((prev) => {
      const updatedTopics: { [strand: string]: string[] } = {
        ...(prev.multiSelectTopics || {}),
      };
      if (isChecked) {
        updatedTopics[strand] = [];
      } else {
        delete updatedTopics[strand];
      }
      return { ...prev, multiSelectTopics: updatedTopics };
    });
    if (errors.topic) {
      setErrors((prev) => {
        const updatedErrors = { ...prev };
        delete updatedErrors.topic;
        return updatedErrors;
      });
    }
  };

  const handleSubStrandChange = (
    strand: string,
    subStrand: string,
    isChecked: boolean,
  ) => {
    setFormState((prev) => {
      const allSubStrandsForStrand = subjectCurriculum?.[strand] || [];
      const updatedTopics: { [strand: string]: string[] } = {
        ...(prev.multiSelectTopics || {}),
      };

      const currentSelection =
        updatedTopics[strand]?.length === 0 &&
        updatedTopics.hasOwnProperty(strand)
          ? allSubStrandsForStrand
          : updatedTopics[strand] || [];

      let newSelection: string[];

      if (isChecked) {
        newSelection = [...new Set([...currentSelection, subStrand])];
      } else {
        newSelection = currentSelection.filter((ss) => ss !== subStrand);
      }

      if (newSelection.length === 0) {
        delete updatedTopics[strand];
      } else if (
        allSubStrandsForStrand.length > 0 &&
        newSelection.length === allSubStrandsForStrand.length
      ) {
        updatedTopics[strand] = [];
      } else {
        updatedTopics[strand] = newSelection.sort();
      }

      return { ...prev, multiSelectTopics: updatedTopics };
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const {
      contentType,
      topic,
      topicInputMode,
      multiSelectTopics,
      totalQuestions,
      questionCounts,
      terms,
      rowcData,
      selectedLessons,
    } = formState;

    if (!formState.grade) newErrors.grade = "Grade is required.";
    if (!formState.subject) newErrors.subject = "Subject is required.";

    const needsTopic = ![
      ContentType.SchemeOfWork,
      ContentType.TermExam,
      ContentType.RecordOfWorkCovered,
    ].includes(contentType);

    const hasSelectedLessons =
      isLessonPlan && selectedLessons && selectedLessons.length > 0;
    const hasUploadedContent =
      !!formState.documentText || !!formState.documentImageBase64;

    if (needsTopic && !hasUploadedContent && !hasSelectedLessons) {
      if (topicInputMode === "manual" && (!topic || !topic.trim())) {
        newErrors.topic = "Please enter a topic or paste content manually.";
      }
      if (
        topicInputMode === "curriculum" &&
        (!multiSelectTopics || Object.keys(multiSelectTopics).length === 0)
      ) {
        if (formState.topic && !enableCurriculumAccordion) {
        } else if (!formState.topic || formState.topic.trim() === "") {
          newErrors.topic = "Please select at least one curriculum topic.";
        }
      }
    }

    if (isAssessmentType) {
      const counts = questionCounts || {};
      let totalManualQuestions = 0;
      for (const count of Object.values(counts)) {
        totalManualQuestions += Number(count) || 0;
      }

      if (totalManualQuestions < 1) {
        newErrors.questionCounts =
          "Please specify a count for at least one question type (Total must be > 0).";
        setActiveSection("assessment");
      }
    }

    if (isSchemeOfWorkType) {
      if (!terms || terms.length === 0) {
        newErrors.terms = "Please select a term for the Scheme of Work.";
      }
      if (capacityEvaluation && !capacityEvaluation.canGenerate) {
        newErrors.teachingSchedule = capacityEvaluation.message;
      }
    }

    if (isRowcType) {
      if (!rowcData?.weekRange.trim()) {
        newErrors.weekRange = "Week Range is required.";
      }
      if (rowcData?.lessons && rowcData.lessons.length > 0) {
        rowcData.lessons.forEach((lesson, index) => {
          if (!lesson.date)
            newErrors[`lesson_${index}_date`] = "Date required.";
          if (!lesson.grade)
            newErrors[`lesson_${index}_grade`] = "Grade required.";
          if (!lesson.subject)
            newErrors[`lesson_${index}_subject`] = "Subject required.";
          if (!lesson.term)
            newErrors[`lesson_${index}_term`] = "Term required.";
          if (lesson.strandInputMode === "manual" && !lesson.strand.trim())
            newErrors[`lesson_${index}_strand`] = "Strand required.";
          if (
            lesson.subStrandInputMode === "manual" &&
            !lesson.subStrand.trim()
          )
            newErrors[`lesson_${index}_subStrand`] = "Sub-strand required.";
          if (!lesson.lessonTitle.trim())
            newErrors[`lesson_${index}_lessonTitle`] = "Lesson Title required.";
        });
      }
    }

    if (formState.sowLessonContext) {
      const ctx = formState.sowLessonContext;
      if (formState.week && ctx.week && formState.week !== ctx.week) {
        newErrors.sowContext = "Curriculum mismatch: Selected week does not match the inherited SOW lesson.";
      }
      if (formState.lessonNumber && ctx.lesson && formState.lessonNumber !== ctx.lesson) {
        newErrors.sowContext = "Curriculum mismatch: Selected lesson does not match the inherited SOW lesson.";
      }
    }

    if (formState.teacherActionContext) {
      const actCtx = formState.teacherActionContext;
      if (actCtx.grade && formState.grade !== actCtx.grade) {
        newErrors.actionContext = "Curriculum mismatch: Selected grade does not match the Teacher Action Plan.";
      }
      if (actCtx.subject && formState.subject !== actCtx.subject) {
        newErrors.actionContext = "Curriculum mismatch: Selected subject does not match the Teacher Action Plan.";
      }
      if (actCtx.term && formState.term && formState.term !== actCtx.term) {
        newErrors.actionContext = "Curriculum mismatch: Selected term does not match the Teacher Action Plan.";
      }
    }

    setErrors(newErrors);

    if (
      newErrors.questionCounts ||
      newErrors.totalQuestions ||
      newErrors.difficulty
    ) {
      setActiveSection("assessment");
    } else if (newErrors.topic || newErrors.terms) {
      setActiveSection("topic");
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitWithValidation = (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessingFile || isProcessingMarkingScheme) {
      alert(
        "Please wait for the file to finish processing before generating content.",
      );
      return;
    }
    if (validateForm()) {
      onSubmit(e);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const questionTypeLabels: { [key in QuestionType]?: string } = {
    [QuestionType.ShortAnswer]: "Structured Questions (Short Answer)",
    [QuestionType.Discussion]: "Discussion Questions",
    [QuestionType.Essay]: "Essay Questions",
  };

  const tabButtonStyle = (isActive: boolean) =>
    `flex-1 px-3 py-2.5 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-x-2 border border-slate-200 ${
      isActive
        ? "bg-mint text-emerald-800 "
        : "bg-white text-gray-500 hover:bg-mint/50 hover:text-gray-700"
    }`;

  const inputClasses = (fieldName: string) =>
    `mt-1 block w-full sm:text-sm bg-white border text-slate-900 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-200 ${errors[fieldName] ? "border-red-500" : "border-slate-200"}`;

  const selectClasses = (fieldName: string) =>
    `mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white border text-slate-900 outline-none focus:ring-2 focus:ring-emerald-200 rounded-lg ${errors[fieldName] ? "border-red-500" : "border-slate-200"}`;

  const isStep1Enabled = true;
  const isStep2Enabled = !!formState.contentType;
  const isStep3Enabled = isStep2Enabled && !!formState.grade;
  const isStep4Enabled = isStep3Enabled && !!formState.subject;

  const currentTermValue =
    formState.term ||
    (formState.terms?.[0] === "All Terms"
      ? "All Terms"
      : formState.terms?.[0]) ||
    (isSchemeOfWorkType ? "Term 1" : "All Terms");

  const isStep5Enabled = isStep4Enabled && !!currentTermValue;
  const isStep6Enabled = isStep5Enabled && selectedStrandNames.length > 0;

  return (
    <div className="space-y-6">
      <form
        id="tour-generator-form"
        onSubmit={handleSubmitWithValidation}
        className="space-y-6 bg-white p-5 sm:p-7 rounded-2xl border border-slate-300 shadow-xs transition-colors duration-300 relative overflow-hidden"
      >
        <GeneratorGuide />
        
        {/* Inherited Teacher Action Context Banner (Phase 30) */}
        {formState.teacherActionContext && (
          <div className="bg-indigo-50 border-2 border-indigo-300 rounded-2xl p-4 mb-6 shadow-sm animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="bg-indigo-600 text-white p-2.5 rounded-xl shrink-0 shadow-xs mt-0.5 sm:mt-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-indigo-900 bg-indigo-200/80 px-2.5 py-0.5 rounded-md border border-indigo-300">
                      Supporting Resource • Teacher Action Plan
                    </span>
                    <span className="text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {formState.teacherActionContext.actionType.replace(/_/g, " ")} ({formState.teacherActionContext.scope.replace(/_/g, " ")})
                    </span>
                    <span className="text-xs font-bold text-indigo-800 bg-white px-2 py-0.5 rounded-md border border-indigo-200 flex items-center gap-1">
                      <Lock className="h-3 w-3" /> {formState.grade} • {formState.subject}
                    </span>
                  </div>
                  <p className="text-sm font-black text-slate-900 mt-1.5">
                    {formState.teacherActionContext.strand} &rsaquo; {formState.teacherActionContext.subStrand}
                  </p>
                  <p className="text-xs text-slate-700 font-medium mt-1">
                    <span className="font-bold text-indigo-800">Focus Area:</span> {formState.teacherActionContext.focusArea}
                  </p>
                  <p className="text-xs text-slate-700 font-medium line-clamp-2 mt-0.5">
                    <span className="font-bold text-indigo-800">SLO:</span> {formState.teacherActionContext.learningOutcomes}
                  </p>
                  <p className="text-[11px] text-indigo-700 font-semibold mt-1.5">
                    Authoritative KICD curriculum context is locked to your Teacher Action Plan. You may adjust resource type, question count, difficulty, and pedagogical instructions below.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFormState(prev => ({
                    ...prev,
                    teacherActionId: undefined,
                    sourceTeacherActionId: undefined,
                    sourceInterpretationId: undefined,
                    ecgArtifactId: undefined,
                    teacherActionContext: undefined,
                  }));
                }}
                className="shrink-0 px-3.5 py-2 text-xs font-black text-slate-700 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all border border-slate-300 flex items-center gap-1.5 self-start sm:self-auto bg-white shadow-2xs"
                title="Exit Teacher Action mode and unlock curriculum selectors"
              >
                <X className="h-4 w-4" />
                Exit Action Context
              </button>
            </div>
          </div>
        )}

        {/* Inherited SOW Context Banner (Phase 25A) */}
        {formState.sowLessonContext && (
          <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 mb-6 shadow-sm animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="bg-emerald-600 text-white p-2.5 rounded-xl shrink-0 shadow-xs mt-0.5 sm:mt-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-900 bg-emerald-200/80 px-2.5 py-0.5 rounded-md border border-emerald-300">
                      Inherited from Scheme of Work
                    </span>
                    <span className="text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      Week {formState.sowLessonContext.week}, Lesson {formState.sowLessonContext.lesson}
                    </span>
                  </div>
                  <p className="text-sm font-black text-slate-900 mt-1.5">
                    {formState.sowLessonContext.strand} &rsaquo; {formState.sowLessonContext.subStrand}
                  </p>
                  <p className="text-xs text-slate-700 font-medium line-clamp-2 mt-1">
                    <span className="font-bold text-emerald-800">SLO:</span> {formState.sowLessonContext.learningOutcomes}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFormState(prev => ({
                    ...prev,
                    parentArtifactId: undefined,
                    masterSowId: undefined,
                    curriculumLessonId: undefined,
                    scheduledLessonId: undefined,
                    sowLessonContext: undefined,
                  }));
                }}
                className="shrink-0 px-3.5 py-2 text-xs font-black text-slate-700 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all border border-slate-300 flex items-center gap-1.5 self-start sm:self-auto bg-white shadow-2xs"
                title="Clear inherited SOW context and start a blank form"
              >
                <X className="h-4 w-4" />
                Clear SOW Context
              </button>
            </div>
          </div>
        )}

        {Object.keys(errors).length > 0 && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">
            <h4 className="font-bold mb-2">Please fix the following errors to generate content:</h4>
            <ul className="list-disc list-inside text-sm">
              {Object.entries(errors).map(([key, msg]) => (
                <li key={key}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Primary Settings Section */}
        <div className="bg-slate-50/70 p-4 sm:p-6 rounded-2xl border border-slate-200/90 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100/80 border border-emerald-300/60 flex items-center justify-center flex-shrink-0 shadow-2xs">
                <BarChart className="h-5 w-5 text-emerald-700" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Set Up Your Resource
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Choose your class, subject, resource and curriculum topics.
                </p>
              </div>
            </div>
            <span className="self-start sm:self-auto px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white rounded-full border border-slate-200 shadow-2xs">
              KICD Aligned
            </span>
          </div>

          <div className="space-y-5">
            {/* STEP 1: CONTENT TYPE */}
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-sm transition-colors ${formState.contentType ? 'bg-emerald-600 text-white' : 'bg-[#3b1464] text-white'}`}>
                    1
                  </span>
                  <FileText className={`w-4 h-4 ${formState.contentType ? 'text-emerald-600' : 'text-[#3b1464]'}`} />
                  CONTENT TYPE
                  <ContextHelp 
                    title="Content Type" 
                    content="Select what kind of teaching resource you want to generate. Each type is tailored to KICD standards for lesson delivery, assessment, or planning."
                  />
                </label>
                {formState.contentType && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" /> Selected
                  </span>
                )}
              </div>
              <Tooltip text="Select Content Type: Schemes of Work (SOW) provide termly plans. Competency-Based Assessments (CBA) focus on evaluating learner progress. Lesson Plans provide granular session instructions.">
                <CustomSelect
                  options={contentTypeOptions}
                  value={formState.contentType}
                  onChange={(value) =>
                    setFormState((prev) => ({
                      ...prev,
                      contentType: value as ContentType,
                    }))
                  }
                  placeholder="Select Content Type..."
                />
              </Tooltip>
            </div>

            {!isRowcType && (
              <>
                {/* STEP 2: GRADE LEVEL */}
                <div className={`w-full space-y-2 transition-all duration-200 ${!isStep2Enabled ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-sm transition-colors ${
                        formState.grade ? "bg-emerald-600 text-white" : isStep2Enabled ? "bg-[#3b1464] text-white" : "bg-slate-200 text-slate-500"
                      }`}>
                        2
                      </span>
                      <GraduationCap className={`w-4 h-4 ${isStep2Enabled ? "text-emerald-600" : "text-slate-400"}`} />
                      GRADE LEVEL
                      <ContextHelp 
                        title="Grade Level" 
                        content="ECG supports Grades 1-10. Choose the grade to load the relevant CBC/CBE curriculum strands and learning areas."
                      />
                    </label>
                    {!isStep2Enabled ? (
                      <span className="text-[11px] font-semibold text-slate-400 italic flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Select Content Type above
                      </span>
                    ) : formState.grade ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Selected
                      </span>
                    ) : null}
                  </div>
                  <CustomSelect
                    options={gradeOptions}
                    value={formState.grade}
                    disabled={!isStep2Enabled || !!formState.teacherActionContext || !!formState.sowLessonContext}
                    onChange={(value) => {
                      setFormState((prev) => ({ ...prev, grade: value }));
                      if (errors.grade) {
                        setErrors((prev) => {
                          const updated = { ...prev };
                          delete updated.grade;
                          return updated;
                        });
                      }
                    }}
                    placeholder={isStep2Enabled ? "Select Grade Level..." : "Select Content Type first"}
                  />
                  {errors.grade && (
                    <p className="text-red-500 text-xs font-bold mt-1">{errors.grade}</p>
                  )}
                </div>

                {/* STEP 3: SUBJECT / LEARNING AREA */}
                <div className={`w-full space-y-2 transition-all duration-200 ${!isStep3Enabled ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-sm transition-colors ${
                        formState.subject ? "bg-emerald-600 text-white" : isStep3Enabled ? "bg-[#3b1464] text-white" : "bg-slate-200 text-slate-500"
                      }`}>
                        3
                      </span>
                      <BookOpen className={`w-4 h-4 ${isStep3Enabled ? "text-emerald-600" : "text-slate-400"}`} />
                      SUBJECT
                      <ContextHelp 
                        title="Subject" 
                        content="The list of subjects is automatically filtered based on your selected grade level."
                      />
                    </label>
                    {!isStep3Enabled ? (
                      <span className="text-[11px] font-semibold text-slate-400 italic flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Select Grade Level above
                      </span>
                    ) : formState.subject ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Selected
                      </span>
                    ) : null}
                  </div>
                  <CustomSelect
                    options={currentSubjectOptions}
                    value={formState.subject}
                    disabled={!isStep3Enabled || !!formState.teacherActionContext || !!formState.sowLessonContext}
                    onChange={(value) => {
                      setFormState((prev) => ({ ...prev, subject: value }));
                      if (errors.subject) {
                        setErrors((prev) => {
                          const updated = { ...prev };
                          delete updated.subject;
                          return updated;
                        });
                      }
                    }}
                    placeholder={isStep3Enabled ? "Select Subject..." : "Select Grade Level first"}
                  />
                  {errors.subject && (
                    <p className="text-red-500 text-xs font-bold mt-1">{errors.subject}</p>
                  )}
                </div>

                {/* STEP 4: ACADEMIC TERM */}
                <div className={`w-full space-y-2 transition-all duration-200 ${!isStep4Enabled ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-sm transition-colors ${
                        currentTermValue ? "bg-emerald-600 text-white" : isStep4Enabled ? "bg-[#3b1464] text-white" : "bg-slate-200 text-slate-500"
                      }`}>
                        4
                      </span>
                      <Calendar className={`w-4 h-4 ${isStep4Enabled ? "text-emerald-600" : "text-slate-400"}`} />
                      ACADEMIC TERM
                      <ContextHelp 
                        title="Academic Term" 
                        content="Selecting a term loads the specific topics and strands intended for that period of the school year."
                      />
                    </label>
                    {!isStep4Enabled ? (
                      <span className="text-[11px] font-semibold text-slate-400 italic flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Select Subject above
                      </span>
                    ) : currentTermValue ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Selected
                      </span>
                    ) : null}
                  </div>
                  <CustomSelect
                    options={termOptions}
                    value={currentTermValue}
                    disabled={!isStep4Enabled || !!formState.teacherActionContext || !!formState.sowLessonContext}
                    onChange={(val) => handleTermSelectChange(val)}
                    placeholder={isStep4Enabled ? "Select Academic Term..." : "Select Subject first"}
                  />
                  {errors.terms && (
                    <p className="text-red-500 text-xs font-bold mt-1">{errors.terms}</p>
                  )}
                  {termChangeWarning && (
                    <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center justify-between mt-2 animate-fade-in">
                      <span>{termChangeWarning}</span>
                      <button
                        type="button"
                        onClick={() => setTermChangeWarning(null)}
                        className="text-amber-600 hover:text-amber-900 font-bold ml-2 shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* SCHOOL PROFILE & TEACHING SCHEDULE */}
                <div className={`w-full space-y-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/90 transition-all duration-200 ${!isStep4Enabled ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-black shadow-2xs">
                          S
                        </span>
                        <GraduationCap className="w-4 h-4 text-slate-700" />
                        YOUR SCHOOL & TEACHING SCHEDULE
                        <ContextHelp 
                          title="Teaching Schedule" 
                          content="KICD curriculum determines WHAT must be taught. Your school schedule determines WHEN it is taught. You can select a school profile or enter custom teaching weeks and lessons per week as an independent teacher."
                        />
                      </label>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5 ml-8">
                        Select a school profile or customize teaching weeks and lessons per week.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 bg-white px-2.5 py-0.5 rounded-full border border-slate-200">
                      Flexible Calendar
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider">
                          School Profile (Optional)
                        </label>
                        {formState.schoolId && formState.schoolId !== 'independent' && onAddSchoolClick && (
                          <button
                            type="button"
                            onClick={onAddSchoolClick}
                            className="text-[10px] font-bold text-[#3b1464] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            <span>Manage Profile</span>
                          </button>
                        )}
                      </div>
                      <CustomSelect
                        options={[
                          { value: 'independent', label: 'Independent / Custom Schedule' },
                          ...SchoolConfigService.getAllSchools().map(s => ({
                            value: s.id,
                            label: `${s.name} (${s.teachingConfig.lessonsPerWeek} lsns/wk, ${s.teachingConfig.teachingWeeksPerTerm} wks/term)`
                          }))
                        ]}
                        value={formState.schoolId || 'lwps'}
                        onChange={(value) => {
                          const selectedId = value as string;
                          if (selectedId === 'independent') {
                            setFormState((prev) => ({
                              ...prev,
                              schoolId: 'independent',
                            }));
                          } else {
                            const profile = SchoolConfigService.getSchoolProfile(selectedId);
                            setFormState((prev) => ({
                              ...prev,
                              schoolId: selectedId,
                              teachingWeeks: profile?.teachingConfig.teachingWeeksPerTerm ?? prev.teachingWeeks,
                              lessonsPerWeek: profile?.teachingConfig.lessonsPerWeek ?? prev.lessonsPerWeek,
                            }));
                          }
                        }}
                        placeholder="Select School..."
                        footerAction={onAddSchoolClick ? {
                          label: "+ Add a School",
                          onClick: onAddSchoolClick
                        } : undefined}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 leading-snug">
                        Teaching Weeks <span className="font-medium text-slate-400 normal-case">(per term)</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={effectiveTeachingWeeks}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setFormState(prev => ({ ...prev, teachingWeeks: val }));
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="e.g. 10"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 leading-snug">
                        Lessons per Week
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={15}
                        value={effectiveLessonsPerWeek}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setFormState(prev => ({ ...prev, lessonsPerWeek: val }));
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="e.g. 5"
                      />
                    </div>
                  </div>

                  {/* Dynamic SOW Capacity Evaluation Card */}
                  {isSchemeOfWorkType && capacityEvaluation && (
                    <div className={`mt-2 p-3.5 rounded-xl border text-xs transition-all ${
                      capacityEvaluation.status === 'EXACT_MATCH'
                        ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                        : capacityEvaluation.status === 'EXCESS_CAPACITY'
                        ? 'bg-blue-50/90 border-blue-300 text-blue-950'
                        : 'bg-rose-50/90 border-rose-300 text-rose-950'
                    }`}>
                      <div className="flex flex-wrap items-center justify-between gap-2 font-extrabold pb-2 border-b border-current/15 mb-2">
                        <span className="flex items-center gap-1.5 uppercase tracking-wide text-[11px] font-black">
                          {capacityEvaluation.status === 'EXACT_MATCH' && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />}
                          {capacityEvaluation.status === 'EXCESS_CAPACITY' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
                          {capacityEvaluation.status === 'INSUFFICIENT_CAPACITY' && <X className="w-4 h-4 text-rose-600 shrink-0" />}
                          <span className="break-words">KICD Curriculum vs School Timetable Capacity</span>
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                          capacityEvaluation.status === 'EXACT_MATCH'
                            ? 'bg-emerald-600 text-white'
                            : capacityEvaluation.status === 'EXCESS_CAPACITY'
                            ? 'bg-blue-600 text-white'
                            : 'bg-rose-600 text-white'
                        }`}>
                          {capacityEvaluation.status === 'EXACT_MATCH' ? 'Exact Match' : capacityEvaluation.status === 'EXCESS_CAPACITY' ? 'Excess Capacity' : 'Insufficient Capacity'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-1">
                        <div className="bg-white/80 p-2.5 rounded-lg border border-current/10">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">KICD Required</p>
                          <p className="text-sm font-black text-slate-900">{capacityEvaluation.canonicalLessonCount} <span className="text-[10px] font-normal text-slate-500">lessons</span></p>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-lg border border-current/10">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">School Capacity</p>
                          <p className="text-sm font-black text-slate-900">{capacityEvaluation.totalAvailablePeriods} <span className="text-[10px] font-normal text-slate-500">periods</span></p>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-lg border border-current/10">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Scheduling Status</p>
                          <p className={`text-xs font-black ${capacityEvaluation.canGenerate ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {capacityEvaluation.status === 'EXACT_MATCH' && '100% Scheduled'}
                            {capacityEvaluation.status === 'EXCESS_CAPACITY' && `+${capacityEvaluation.unusedCapacity} Available`}
                            {capacityEvaluation.status === 'INSUFFICIENT_CAPACITY' && `-${capacityEvaluation.unscheduledLessons} Unscheduled`}
                          </p>
                        </div>
                      </div>

                      <p className="mt-2 text-[11px] font-medium leading-relaxed">
                        {capacityEvaluation.message}
                      </p>
                      
                      {errors.teachingSchedule && (
                        <p className="mt-1 text-xs font-black text-rose-700 flex items-center gap-1">
                          <X className="w-3.5 h-3.5" /> {errors.teachingSchedule}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* STEPS 5 & 6: STRANDS & SUB-STRANDS */}
                <div className="pt-3 border-t border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
                      Topic Selection Source
                      <ContextHelp 
                        title="Strands / Main Topics" 
                        content="Choose the curriculum strands and topics you want ECG to cover. KICD Curriculum uses structured content, while Manual/File lets you use your own topics."
                      />
                    </span>
                    <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 text-xs font-bold shadow-2xs">
                      <button
                        type="button"
                        onClick={() =>
                          setFormState((prev) => ({
                            ...prev,
                            topicInputMode: "curriculum",
                          }))
                        }
                        className={`px-3 py-1 rounded-md transition-all ${
                          formState.topicInputMode === "curriculum"
                            ? "bg-emerald-600 text-white font-extrabold shadow-2xs"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        KICD Curriculum
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormState((prev) => ({
                            ...prev,
                            topicInputMode: "manual",
                          }))
                        }
                        className={`px-3 py-1 rounded-md transition-all ${
                          formState.topicInputMode === "manual"
                            ? "bg-emerald-600 text-white font-extrabold shadow-2xs"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Manual / File
                      </button>
                    </div>
                  </div>

                  {formState.topicInputMode === "curriculum" ? (
                    <CurriculumTopicPanel
                      availableStrands={availableStrands}
                      selectedStrandNames={selectedStrandNames}
                      subjectCurriculum={subjectCurriculum}
                      selectedSubStrandValues={selectedSubStrandValues}
                      onStrandsChange={handleStrandCheckboxChange}
                      onSubStrandsChange={handleSubStrandCheckboxChange}
                      onSelectAll={handleSelectAllStrands}
                      onClear={handleClearStrandSelection}
                      error={errors.topic}
                      isStep5Enabled={isStep5Enabled}
                      isStep6Enabled={isStep6Enabled}
                    />
                  ) : (
                    <div className="space-y-4 pt-1">
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black">
                            5
                          </span>
                          Topic / Content Description
                        </label>
                        <textarea
                          id="topic"
                          name="topic"
                          value={formState.topic}
                          onChange={handleChange}
                          disabled={!!formState.teacherActionContext || !!formState.sowLessonContext}
                          rows={4}
                          className={`w-full p-3.5 bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-xs font-medium text-slate-900 ${formState.teacherActionContext || formState.sowLessonContext ? "bg-slate-100 text-slate-600 cursor-not-allowed" : ""}`}
                          placeholder="Enter custom topic, learning outcome, or paste reference content..."
                        ></textarea>
                        {errors.topic && (
                          <p className="text-red-500 text-xs font-bold">{errors.topic}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black">
                            6
                          </span>
                          Upload Reference Document (Optional)
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <label className="flex flex-col items-center justify-center p-5 border border-dashed border-slate-300 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 hover:border-emerald-500 transition-all">
                            <Upload className="w-5 h-5 text-slate-400 mb-1" />
                            <p className="text-xs font-bold text-slate-600">Click to Upload Document</p>
                            <p className="text-[10px] text-slate-400">PDF, DOCX, TXT, or Image</p>
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => handleFileChange(e, "documentFile")}
                              disabled={isProcessingFile}
                            />
                          </label>
                          {formState.documentFile && (
                            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                              <span className="text-xs font-bold text-emerald-800 truncate">
                                {formState.documentFile.name}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setFormState((s) => ({
                                    ...s,
                                    documentFile: undefined,
                                    documentText: "",
                                    documentImageBase64: undefined,
                                  }))
                                }
                                className="text-emerald-500 hover:text-rose-600 p-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {isRowcType && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-xl font-black text-slate-800 mb-4">
              Record of Work Details
            </h3>
            <div>
              <Tooltip text="Define the week and date range this record covers.">
                <label
                  htmlFor="weekRange"
                  className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1"
                >
                  Week Range
                </label>
              </Tooltip>
              <input
                type="text"
                name="weekRange"
                id="weekRange"
                value={formState.rowcData?.weekRange || ""}
                onChange={(e) => {
                  setFormState((prev) => ({
                    ...prev,
                    rowcData: { ...prev.rowcData!, weekRange: e.target.value },
                  }));
                  if (errors.weekRange)
                    setErrors((prev) => {
                      const updatedErrors = { ...prev };
                      delete updatedErrors.weekRange;
                      return updatedErrors;
                    });
                }}
                placeholder="e.g., Week 1 - 25/03 to 29/03"
                className={inputClasses("weekRange")}
              />
              {errors.weekRange && (
                <p className="text-red-500 text-[10px] font-bold mt-1">
                  {errors.weekRange}
                </p>
              )}
            </div>
            <div className="space-y-4">
              {(formState.rowcData?.lessons || []).map((lesson, index) => {
                const lessonCurriculum = getCurriculumByTerm(
                  lesson.grade,
                  lesson.subject,
                  lesson.term ? [lesson.term as any] : [],
                );
                const rowcStrandOptions = lessonCurriculum
                  ? Object.keys(lessonCurriculum)
                  : [];
                const rowcSubStrandOptions =
                  lesson.strand &&
                  lessonCurriculum &&
                  lessonCurriculum[lesson.strand]
                    ? lessonCurriculum[lesson.strand]
                    : [];

                return (
                  <div
                    key={lesson.id}
                    className="p-6 border-2 border-slate-200 rounded-2xl space-y-4 bg-gray-50 relative overflow-hidden"
                  >
                    <div className="flex justify-between items-center bg-white -mx-6 -mt-6 p-4 border-b-2 border-slate-200">
                      <p className="font-black text-xs uppercase tracking-widest text-slate-500">
                        Lesson Entry {index + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeROWCLesson(lesson.id)}
                        className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"
                      >
                        ×
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase mb-1">
                          Date
                        </span>
                        <input
                          type="date"
                          name="date"
                          value={lesson.date}
                          onChange={(e) => handleROWCLessonChange(lesson.id, e)}
                          className="bg-transparent font-bold outline-none text-slate-900"
                        />
                      </div>
                      <div className="flex flex-col justify-end">
                        <CustomSelect
                          options={GRADES}
                          value={lesson.grade}
                          onChange={(val) =>
                            handleROWCLessonChange(lesson.id, {
                              target: { name: "grade", value: val },
                            } as any)
                          }
                          variant="default"
                          placeholder="Grade"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase mb-1">
                          Subject
                        </span>
                        <CustomSelect
                          options={getSubjectOptions(lesson.grade)}
                          value={lesson.subject}
                          onChange={(val) =>
                            handleROWCLessonChange(lesson.id, {
                              target: { name: "subject", value: val },
                            } as any)
                          }
                          variant="default"
                          placeholder="Subject"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase mb-1">
                          Term
                        </span>
                        <CustomSelect
                          options={["Term 1", "Term 2", "Term 3"]}
                          value={lesson.term}
                          onChange={(val) =>
                            handleROWCLessonChange(lesson.id, {
                              target: { name: "term", value: val },
                            } as any)
                          }
                          variant="default"
                          placeholder="Term"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase">
                            Strand(s)
                          </label>
                          <div className="flex bg-slate-100 p-0.5 rounded-lg h-6">
                            <button
                              type="button"
                              onClick={() =>
                                handleROWCToggleChange(
                                  lesson.id,
                                  "strandInputMode",
                                  "curriculum",
                                )
                              }
                              className={`px-2 text-[8px] font-black uppercase rounded ${lesson.strandInputMode !== "manual" ? "bg-white text-blue-600 " : "text-slate-400"}`}
                            >
                              Select
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleROWCToggleChange(
                                  lesson.id,
                                  "strandInputMode",
                                  "manual",
                                )
                              }
                              className={`px-2 text-[8px] font-black uppercase rounded ${lesson.strandInputMode === "manual" ? "bg-white text-blue-600 " : "text-slate-400"}`}
                            >
                              Manual
                            </button>
                          </div>
                        </div>
                        {lesson.strandInputMode === "manual" ? (
                          <input
                            type="text"
                            name="strand"
                            value={lesson.strand}
                            onChange={(e) =>
                              handleROWCLessonChange(lesson.id, e)
                            }
                            className="w-full text-sm font-bold bg-white p-2 rounded-xl border-2 border-slate-200 text-slate-900"
                          />
                        ) : (
                          <CustomSelect
                            options={rowcStrandOptions}
                            value={lesson.strand}
                            onChange={(val) =>
                              handleROWCLessonChange(lesson.id, {
                                target: { name: "strand", value: val },
                              } as any)
                            }
                            variant="default"
                            placeholder="Select Strand"
                          />
                        )}
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase">
                            Sub-strand(s)
                          </label>
                          <div className="flex bg-slate-100 p-0.5 rounded-lg h-6">
                            <button
                              type="button"
                              onClick={() =>
                                handleROWCToggleChange(
                                  lesson.id,
                                  "subStrandInputMode",
                                  "curriculum",
                                )
                              }
                              className={`px-2 text-[8px] font-black uppercase rounded ${lesson.subStrandInputMode !== "manual" ? "bg-white text-blue-600 " : "text-slate-400"}`}
                            >
                              Select
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleROWCToggleChange(
                                  lesson.id,
                                  "subStrandInputMode",
                                  "manual",
                                )
                              }
                              className={`px-2 text-[8px] font-black uppercase rounded ${lesson.subStrandInputMode === "manual" ? "bg-white text-blue-600 " : "text-slate-400"}`}
                            >
                              Manual
                            </button>
                          </div>
                        </div>
                        {lesson.subStrandInputMode === "manual" ? (
                          <input
                            type="text"
                            name="subStrand"
                            value={lesson.subStrand}
                            onChange={(e) =>
                              handleROWCLessonChange(lesson.id, e)
                            }
                            className="w-full text-sm font-bold bg-white p-2 rounded-xl border-2 border-slate-200 text-slate-900"
                          />
                        ) : (
                          <CustomSelect
                            options={rowcSubStrandOptions}
                            value={lesson.subStrand}
                            onChange={(val) =>
                              handleROWCLessonChange(lesson.id, {
                                target: { name: "subStrand", value: val },
                              } as any)
                            }
                            variant="default"
                            placeholder="Select Sub-strand"
                          />
                        )}
                      </div>
                    </div>
                    <div>
                      <input
                        type="text"
                        name="lessonTitle"
                        value={lesson.lessonTitle}
                        onChange={(e) => handleROWCLessonChange(lesson.id, e)}
                        placeholder="Lesson Title / Competency"
                        className="w-full text-lg font-black text-slate-800 placeholder:text-slate-200 bg-transparent outline-none border-b-2 border-slate-200 pb-2"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={addROWCLesson}
              className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black uppercase tracking-widest text-[10px] hover:border-emerald-500 hover:text-emerald-600 transition-all"
            >
              + Add Another Lesson Entry
            </button>
          </div>
        )}

        {isAssessmentType && !isRowcType && (
          <div className="bg-slate-50/70 p-4 sm:p-6 rounded-2xl border border-slate-200/90 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-lg">
                  <Settings className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight leading-none">
                    Assessment Questions & Marks Setup
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">
                    Configure question structure, difficulty & scoring.
                  </p>
                </div>
              </div>
            </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Tooltip text="Difficulty levels adapt the depth of Bloom's Taxonomy application in assessment questions.">
                      <CustomSelect
                        label="Target Difficulty"
                        options={Object.values(QuestionDifficulty).map((d) => ({
                          value: d,
                          label: d,
                          icon: <BarChart className="h-4 w-4" />,
                        }))}
                        value={formState.difficulty}
                        onChange={(value) =>
                          setFormState((prev) => ({
                            ...prev,
                            difficulty: value as QuestionDifficulty,
                          }))
                        }
                      />
                    </Tooltip>

                    <div className="bg-white p-4 border-2 border-slate-200 rounded-2xl flex flex-col justify-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        Total Questions
                      </span>
                      <div className="text-xl font-black text-slate-900">
                        {Object.values(formState.questionCounts).reduce(
                          (a: number, b: number | undefined) => a + (b || 0),
                          0,
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-col px-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Question Types & Scoring Configuration
                        </label>
                      </div>
                      {errors.questionCounts && (
                        <p className="text-red-500 text-xs font-bold mt-1">{errors.questionCounts}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {/* Header for Question Rows */}
                      <div className="hidden sm:flex items-center justify-between px-4 pb-1 text-[8px] font-black uppercase text-slate-400 tracking-widest">
                        <div className="flex-1">Question Type</div>
                        <div className="flex items-center gap-8 w-[160px] justify-center">
                          <div className="w-16 text-center">Questions</div>
                          <div className="w-16 text-center text-emerald-500">
                            Marks
                          </div>
                        </div>
                      </div>

                      {ASSESSMENT_QUESTION_TYPES.map((type) => {
                        let colorClasses = {
                          dot: "bg-blue-500",
                          borderHover: "hover:border-blue-200",
                          focus: "focus:border-blue-500",
                          checkbox: "text-blue-600 focus:ring-blue-500"
                        };
                        if (type === QuestionType.MultipleChoice) colorClasses = { dot: "bg-blue-500", borderHover: "hover:border-blue-300", focus: "focus:border-blue-500", checkbox: "text-blue-600 focus:ring-blue-500" };
                        else if (type === QuestionType.ShortAnswer) colorClasses = { dot: "bg-emerald-500", borderHover: "hover:border-emerald-300", focus: "focus:border-emerald-500", checkbox: "text-emerald-600 focus:ring-emerald-500" };
                        else if (type === QuestionType.TrueFalse) colorClasses = { dot: "bg-amber-500", borderHover: "hover:border-amber-300", focus: "focus:border-amber-500", checkbox: "text-amber-600 focus:ring-amber-500" };
                        else if (type === QuestionType.Essay) colorClasses = { dot: "bg-purple-500", borderHover: "hover:border-purple-300", focus: "focus:border-purple-500", checkbox: "text-purple-600 focus:ring-purple-500" };
                        else if (type === QuestionType.Discussion) colorClasses = { dot: "bg-rose-500", borderHover: "hover:border-rose-300", focus: "focus:border-rose-500", checkbox: "text-rose-600 focus:ring-rose-500" };

                        return (
                        <div
                          key={type}
                          className={`bg-white p-3 sm:p-4 border border-slate-200 rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 group ${colorClasses.borderHover}`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={
                                (formState.questionCounts[type] || 0) > 0
                              }
                              onChange={(e) => {
                                const isEnabled = e.target.checked;
                                setFormState((prev) => ({
                                  ...prev,
                                  questionCounts: {
                                    ...prev.questionCounts,
                                    [type]: isEnabled
                                      ? prev.questionCounts[type] || 5
                                      : 0,
                                  },
                                }));
                              }}
                              className={`h-5 w-5 rounded border-slate-300 ${colorClasses.checkbox}`}
                            />
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${colorClasses.dot}`} />
                              <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                                {type}
                              </span>
                            </div>
                            <p className="hidden sm:block text-[10px] text-slate-400 font-medium uppercase mt-1 sm:ml-3.5">
                              Format
                            </p>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6 bg-slate-50/50 p-2 sm:p-0 rounded-xl sm:bg-transparent">
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] sm:hidden text-slate-500 font-semibold uppercase mb-1 leading-none">
                                  Questions
                                </span>
                                <input
                                  type="number"
                                  value={formState.questionCounts[type] || 0}
                                  onChange={handleChange}
                                  name={type}
                                  min="0"
                                  disabled={
                                    (formState.questionCounts[type] || 0) === 0
                                  }
                                  className={`w-14 sm:w-16 h-8 sm:h-9 text-center font-semibold outline-none bg-white rounded-lg text-slate-700 border border-slate-200 ${colorClasses.focus} transition-all text-sm disabled:opacity-50 disabled:bg-slate-50`}
                                />
                              </div>

                              <div className="flex flex-col items-center">
                                <span className="text-[10px] sm:hidden text-slate-500 font-semibold uppercase mb-1 leading-none">
                                  Marks
                                </span>
                                <input
                                  type="number"
                                  name={`mark_${type}`}
                                  value={formState.questionMarks?.[type] ?? 0}
                                  onChange={handleMarksChange}
                                  min="0"
                                  disabled={
                                    (formState.questionCounts[type] || 0) === 0
                                  }
                                  className={`w-14 sm:w-16 h-8 sm:h-9 text-center font-semibold text-sm bg-slate-50 rounded-lg outline-none text-slate-700 border border-slate-200 ${colorClasses.focus} transition-all disabled:opacity-50`}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )})}
                    </div>

                    <div className="pt-4 border-t-2 border-slate-200">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                        <label
                          htmlFor="additionalInstructions"
                          className="text-[10px] font-black text-slate-400 uppercase tracking-widest"
                        >
                          Final Instructions for Assessment
                        </label>
                      </div>
                      <textarea
                        id="additionalInstructions"
                        name="additionalInstructions"
                        value={formState.additionalInstructions}
                        onChange={handleChange}
                        rows={3}
                        className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl outline-none text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 transition-colors"
                        placeholder="E.g., 'Answer all questions', 'Show rough work', 'Attempt any 4'..."
                      />
                    </div>
                  </div>
                </div>
              )}

        {/* Action Footer */}
        <div className="pt-8 border-t-2 border-slate-200 space-y-4">
          {isLoading && (
            <div className="space-y-3 py-2 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      repeat: Infinity,
                      duration: 1,
                      ease: "linear",
                    }}
                    className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full"
                  />
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={loadingStep}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="text-[11px] font-black uppercase tracking-widest text-slate-900"
                    >
                      {loadingMessages[loadingStep]}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <span className="text-sm font-black text-emerald-600">
                  {progress}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/5 ">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-emerald-500"
                />
              </div>
            </div>
          )}

          {/* FINAL GUIDANCE (Phase 50) */}
          {!isLoading && !isProcessingFile && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-6 flex items-start gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h4 className="text-[10px] font-black text-emerald-900 uppercase tracking-widest mb-0.5">Ready to Generate?</h4>
                <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                  Review your school, content type, grade, subject, term and topics, then generate your resource.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
            {!isRowcType && (
              <button
                type="button"
                onClick={onStartNew}
                className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-all py-3 px-5 flex items-center justify-center gap-2 order-2 sm:order-1"
              >
                <Trash2 className="w-4 h-4 shrink-0" /> Reset All
              </button>
            )}
            <motion.button
              type="submit"
              disabled={isLoading || isProcessingFile}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              className="sm:ml-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-[#3b1464] hover:bg-[#2a0e4a] text-white rounded-xl shadow-md font-bold uppercase tracking-wider text-xs disabled:opacity-50 transition-all flex items-center gap-3 justify-center order-1 sm:order-2"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Please wait...
                </span>
              ) : (
                "Generate Content"
              )}
            </motion.button>
          </div>
        </div>
      </form>
    </div>
  );
};
