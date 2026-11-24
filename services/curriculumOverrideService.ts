import { collection, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { LESSON_BREAKDOWNS } from '../data/curriculum/index.ts';

// This function will listen for overrides and mutate the LESSON_BREAKDOWNS object
// which is used throughout the app as a singleton/constant.
export function initializeCurriculumOverrides() {
    // Disabled early to prevent firestore errors
    return () => {};
}
