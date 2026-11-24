import { Sparkles } from 'lucide-react';
import { startTour } from './GuidedTourOverlay';

export const HelpTourButton = () => {
 return (
 <button
 onClick={startTour}
 className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full transition-all hover:scale-105"
 title="Relaunch Guided Tour"
 >
 <Sparkles className="h-6 w-6" />
 <span className="sr-only">Relaunch Guided Tour</span>
 </button>
 );
};
