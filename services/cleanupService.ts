import { collection, query, getDocs, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { GeneratedContent } from '../types';

export const purgeOldLibraryItems = async (userId: string, daysOld: number = 30) => {
    const libraryRef = collection(db, 'users', userId, 'library');
    const snapshot = await getDocs(libraryRef);
    const now = new Date().getTime();
    const threshold = daysOld * 24 * 60 * 60 * 1000;
    
    let purgedCount = 0;
    
    for (const document of snapshot.docs) {
        const item = document.data() as GeneratedContent;
        const savedAt = item.savedAt ? new Date(item.savedAt).getTime() : 0;
        const isEmpty = !item.body && (!item.questions || item.questions.length === 0);
        const isOld = (now - savedAt) > threshold && savedAt !== 0;
        
        if (isEmpty || isOld) {
            await deleteDoc(doc(db, 'users', userId, 'library', document.id));
            purgedCount++;
        }
    }
    
    return purgedCount;
};
