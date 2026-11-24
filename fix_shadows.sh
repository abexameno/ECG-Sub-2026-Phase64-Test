#!/bin/bash
files=(
"App.tsx"
"components/AIChatAssistant.tsx"
"components/AdminPanel.tsx"
"components/AppBackupRestorePanel.tsx"
"components/BuyCredits.tsx"
"components/ContentDisplay.tsx"
"components/ContentTypeIcon.tsx"
"components/CustomSelect.tsx"
"components/EmailHistoryPanel.tsx"
"components/ErrorBoundary.tsx"
"components/ExamenoLogo.tsx"
"components/ExportControls.tsx"
"components/FeedbackPanel.tsx"
"components/GeneratorForm.tsx"
"components/GuidedTourOverlay.tsx"
"components/Header.tsx"
"components/HelpGuide.tsx"
"components/HelpTourButton.tsx"
"components/HistoryPanel.tsx"
"components/IllustrationEditor.tsx"
"components/ImageEditorModal.tsx"
"components/LmsPanel.tsx"
"components/LoadingSpinner.tsx"
"components/LoginScreen.tsx"
"components/NotificationManagementPanel.tsx"
"components/ReferralHub.tsx"
"components/ReferralManagementPanel.tsx"
"components/SettingsPanel.tsx"
"components/StudentDashboard.tsx"
"components/StudentElmsPanel.tsx"
"components/SubscriptionPanel.tsx"
"components/TeacherDashboard.tsx"
"components/TeacherResourceHub.tsx"
"components/Tooltip.tsx"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "Processing $file"
        # Remove shadow- classes
        sed -i -E 's/shadow-[a-zA-Z0-9\[\-\._]+//g' "$file"
        # Remove drop-shadow- classes
        sed -i -E 's/drop-shadow-[a-zA-Z0-9\[\-\._]+//g' "$file"
        # Replace gray/slate/zinc/neutral/stone borders with border-black
        sed -i -E 's/border-(slate|gray|zinc|neutral|stone)-[0-9]{2,3}/border-black/g' "$file"
        # Cleanup extra spaces left behind
        sed -i 's/  / /g' "$file"
        sed -i 's/  / /g' "$file"
        sed -i 's/  / /g' "$file"
    fi
done
