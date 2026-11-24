
import React from 'react';

// Section component for consistent styling
const Section: React.FC<{ title: string; children: React.ReactNode; icon: React.ReactElement }> = ({ title, children, icon }) => (
 <div className="app-card p-6 mb-8">
 <div className="flex items-center mb-3">
 <div className="flex-shrink-0 bg-mint rounded-full p-2 mr-3 text-emerald-800">{icon}</div>
 <h3 className="text-xl font-bold text-slate-900">{title}</h3>
 </div>
 <div className="pl-12 text-slate-600 space-y-3 prose prose-sm max-w-none prose-p:text-slate-600 prose-li:text-slate-600 prose-strong:text-slate-900">
 {children}
 </div>
 </div>
);

// Icon components
const IconStep1 = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
const IconFeatures = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.375 3.375 0 0014 18.442V21a1 1 0 11-2 0v-2.558a3.375 3.375 0 00-1.452-.995l-.548-.547z" /></svg>;
const IconManage = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>;
const IconTips = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconCreditCard = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
const IconCredits = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconFeedback = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;


const HelpGuide: React.FC = () => {
 return (
 <div className="app-card p-6 sm:p-8">
  <h2 className="text-3xl font-bold text-slate-900 border-b border-slate-200 pb-4 mb-6">
  User Guide & Help
  </h2>

  <p className="mb-8 text-slate-700">Welcome to the Exameno CBC Content Generator (ECG)! This guide will walk you through the key features to help you create high-quality, curriculum-aligned educational materials efficiently.</p>

  <Section title="Subscription & Credits" icon={<IconCredits />}>
  <p>Exameno operates on a simple pay-as-you-go credit system. There are no monthly fees; you only pay for what you generate.</p>
  
  <h4 className="font-bold text-slate-900 mt-4">How Credits Work</h4>
  <ul className="list-disc pl-5 space-y-1">
   <li><strong>Credit Costs:</strong> Generating content deducts credits based on the content type:
   <ul className="list-disc pl-5 mt-1 mb-2">
    <li><strong>Scheme of Work (SOW):</strong> 2 credits</li>
    <li><strong>Competency-Based Assessment (CBA):</strong> 2 credits</li>
    <li><strong>Lesson Plan:</strong> 1 credit</li>
    <li><strong>Lesson Notes:</strong> 1 credit</li>
    <li><strong>Quizzes:</strong> 1 credit</li>
    <li><strong>Record of Work Covered (ROWC):</strong> 1 credit</li>
   </ul>
   </li>
   <li><strong>Failed Generations:</strong> If the system fails to generate content due to an error, <strong>no credits are deducted</strong>. Your balance is safe.</li>
   <li><strong>New Accounts:</strong> Every new account starts with <strong>5 Free Credits</strong> to test the system.</li>
  </ul>

  <h4 className="font-bold text-slate-900 mt-4">How to Buy Credits</h4>
  <p className="text-sm mb-3">The current subscription and credit purchase process is as follows:</p>
  <ol className="list-decimal pl-5 space-y-3">
   <li>
    <span className="font-bold">STEP 1:</span> Your ECG account includes <span className="font-bold">5 FREE credits</span> when you start.
   </li>
   <li>
    <span className="font-bold">STEP 2:</span> Credits are used when generating supported content.
    <div className="mt-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
     <p className="font-bold text-xs uppercase mb-2">Current credit costs:</p>
     <ul className="list-disc pl-5 space-y-1 text-xs">
      <li>SOW / CBA = 2 credits</li>
      <li>Lesson Plan = 1 credit</li>
      <li>Quiz / ROWC = 1 credit</li>
     </ul>
    </div>
   </li>
   <li>
    <span className="font-bold">STEP 3:</span> When credits are low or exhausted, choose <span className="font-bold">"Buy More Credits"</span> in the Subscription tab.
   </li>
   <li>
    <span className="font-bold">STEP 4:</span> Select a package:
    <ul className="list-disc pl-5 mt-2 text-xs">
     <li><span className="font-bold text-slate-900">Basic:</span> 10 credits — KES 200</li>
     <li><span className="font-bold text-slate-900">Standard:</span> 20 credits — KES 400</li>
     <li><span className="font-bold text-slate-900">Premium:</span> 30 credits — KES 500</li>
    </ul>
   </li>
   <li>
    <span className="font-bold">STEP 5:</span> Pay via M-Pesa to: <span className="font-bold text-emerald-700">0717 713 493 (Abraham Tumuti)</span>
   </li>
   <li>
    <span className="font-bold">STEP 6:</span> Enter your M-Pesa transaction number in ECG.
   </li>
   <li>
    <span className="font-bold">STEP 7:</span> Send payment confirmation through WhatsApp to: <span className="font-bold text-emerald-700">0717 713 493 (Abraham Tumuti)</span>
   </li>
   <li>
    <span className="font-bold">STEP 8:</span> An administrator manually verifies the payment.
   </li>
   <li>
    <span className="font-bold">STEP 9:</span> After verification, the administrator activates the purchased credits.
   </li>
   <li>
    <span className="font-bold">STEP 10:</span> Continue generating content.
   </li>
  </ol>
  
  <div className="mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
   <p className="text-emerald-900 font-bold text-sm mb-2">Important Information:</p>
   <ul className="list-disc pl-5 space-y-1 text-xs text-emerald-800">
    <li>Credits are deducted <span className="font-bold">only after successful content generation</span>.</li>
    <li>A failed generation does not deduct credits.</li>
    <li>Manual verification ensures your payment is processed securely by our team.</li>
   </ul>
  </div>
  </Section>

  <Section title="Getting Started: 5 Simple Steps" icon={<IconStep1 />}>
  <ol>
   <li><strong>Select Grade & Subject:</strong> Start by choosing the appropriate grade level and subject from the dropdowns. The curriculum options will update automatically.</li>
   <li><strong>Choose Content Type:</strong> Select the type of material you want to create (e.g., Lesson Plan, Quiz, Scheme of Work).</li>
   <li><strong>Specify Your Topic:</strong> You can select a topic from the curriculum dropdowns or enter one manually.</li>
   <li><strong>Generate & Save:</strong> Click "Generate Content". Once generated, click "Save to Library" to keep it.</li>
  </ol>
  </Section>

  <Section title="How to Generate Specific Content" icon={<IconFeatures />}>
  <div className="space-y-4">
   <div>
   <h4 className="font-bold text-gray-900">1. Schemes of Work (SOW)</h4>
   <p>To generate a professional Scheme of Work:</p>
   <ul className="list-disc pl-5 space-y-1">
    <li>Select <strong>Scheme of Work</strong> as the Content Type.</li>
    <li><strong>Important:</strong> You must select at least one <strong>Term</strong> (Term 1, 2, or 3) in the Topic & Source section.</li>
    <li>Check "Strict Curriculum Adherence" to ensure the SOW matches the official lesson breakdown week-by-week.</li>
    <li>The AI will generate a table with Weeks, Lessons, Strands, Sub-strands, Learning Outcomes, and Resources.</li>
   </ul>
   </div>

   <div>
   <h4 className="font-bold text-gray-900">2. Lesson Plans</h4>
   <p>To create a specific Lesson Plan:</p>
   <ul className="list-disc pl-5 space-y-1">
    <li>Select <strong>Lesson Plan</strong> as the Content Type.</li>
    <li>Select a <strong>Term</strong>.</li>
    <li>A new section called <strong>"Lesson Scheduling"</strong> will appear under the Term selector.</li>
    <li>Select the <strong>Week</strong> and <strong>Lesson Number</strong> you want to teach (e.g., Week 2, Lesson 1).</li>
    <li>Click "Add Lesson to Plan". You can add multiple lessons to generate a batch of plans at once.</li>
   </ul>
   </div>

   <div>
   <h4 className="font-bold text-gray-900">3. Assessments (Quizzes & CBC Exams)</h4>
   <p>To create tests and quizzes:</p>
   <ul className="list-disc pl-5 space-y-1">
    <li>Select <strong>Assessment</strong> or <strong>Quiz</strong>.</li>
    <li>Go to the <strong>Questions & Marks</strong> tab (next to Topic & Source).</li>
    <li>Specify the exact number of questions for each type (e.g., 10 Multiple Choice, 2 Essays).</li>
    <li>You can also upload a <strong>Marking Scheme</strong> document if you want the AI to base questions on specific answers.</li>
   </ul>
   </div>

   <div>
   <h4 className="font-bold text-gray-900">4. Lesson Notes</h4>
   <p>To create reading materials for teachers:</p>
   <ul className="list-disc pl-5 space-y-1">
    <li>Select <strong>Lesson Notes</strong>.</li>
    <li>Select the specific <strong>Topic/Strand</strong> from the curriculum dropdown, or type a custom topic.</li>
   </ul>
   </div>

   <div>
   <h4 className="font-bold text-gray-900">5. Record of Work Covered (ROWC)</h4>
   <p>To digitize your records:</p>
   <ul className="list-disc pl-5 space-y-1">
    <li>Select <strong>Record of Work Covered</strong>.</li>
    <li>A special form will appear. Enter the <strong>Week Range</strong>.</li>
    <li>Add lesson entries. You can fill in brief details, and the AI will expand them into full professional remarks and activity descriptions.</li>
   </ul>
   </div>
  </div>
  </Section>

  <Section title="Managing Your Content" icon={<IconManage />}>
  <h4>Saving to Your Library</h4>
  <p>Once you're happy with a piece of generated content, click the <strong>"Save to Library"</strong> button. This adds it to your personal, persistent library.</p>
  
  <h4>Exporting</h4>
  <p>You can export your content to <strong>PDF</strong>, <strong>Word (.docx)</strong>, or <strong>Excel (.xlsx)</strong>. Before exporting, you can choose to include a professional header with your school's name and logo in the "Export Options" panel.</p>
  </Section>

  <Section title="Providing Feedback & Support" icon={<IconFeedback />}>
  <div className="space-y-4">
    <p>Your feedback is valuable for improving the application. If you encounter issues or need assistance, we are here to help.</p>
    
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
        <h5 className="font-bold text-slate-900 text-sm mb-2">WhatsApp Support</h5>
        <p className="text-emerald-700 font-black text-lg">0717 713 493</p>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Abraham Tumuti</p>
      </div>
      
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
        <h5 className="font-bold text-slate-900 text-sm mb-2">Email Support</h5>
        <p className="text-emerald-700 font-black">abexameno@gmail.com</p>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Technical Assistance</p>
      </div>
    </div>

    <p className="text-xs text-slate-500 italic mt-4">
      Navigate to the <strong>"Feedback"</strong> tab within the app to report specific bugs or suggest new features directly.
    </p>
  </div>
  </Section>

  <Section title="Tips for Best Results" icon={<IconTips />}>
  <ul>
   <li><strong>Be Specific:</strong> The more context you give in "Additional Instructions", the better the result. E.g., "Focus on local Kenyan examples."</li>
   <li><strong>Use Source Documents:</strong> Uploading a text file allows the AI to generate questions based exactly on your material.</li>
   <li><strong>Review:</strong> Always review the generated content. While powerful, AI is a tool to assist, not replace, your professional judgment.</li>
  </ul>
  </Section>

 </div>
 );
};

export default HelpGuide;