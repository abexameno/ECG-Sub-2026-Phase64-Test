#!/bin/bash
files=("App.tsx" \
"components/IllustrationEditor.tsx" \
"components/SubscriptionPanel.tsx" \
"components/TeacherDashboard.tsx" \
"components/TeacherResourceHub.tsx" \
"components/Tooltip.tsx" \
"components/AIChatAssistant.tsx" \
"components/CustomSelect.tsx" \
"components/ImageEditorModal.tsx" \
"components/FeedbackPanel.tsx" \
"components/Header.tsx" \
"components/ContentDisplay.tsx" \
"components/ExportControls.tsx" \
"components/StudentDashboard.tsx" \
"components/HistoryPanel.tsx" \
"components/ErrorBoundary.tsx" \
"components/StudentElmsPanel.tsx" \
"components/EmailHistoryPanel.tsx" \
"components/LoadingSpinner.tsx" \
"components/LoginScreen.tsx" \
"components/HelpTourButton.tsx" \
"components/LmsPanel.tsx" \
"components/GeneratorForm.tsx" \
"components/SettingsPanel.tsx")

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "Processing $file"
        sed -i 's/shadow-\[[^"]*\]//g' "$file"
        sed -i -E 's/shadow-(sm|md|lg|xl|2xl)//g' "$file"
    fi
done
