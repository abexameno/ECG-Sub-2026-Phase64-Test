import { useState } from 'react';

export type LoadingState = 'idle' | 'Drafting Questions' | 'Generating Images' | 'Aligning Curriculum' | 'Exporting';

export function useLoading() {
  const [loading, setLoading] = useState<LoadingState>('idle');
  return { loading, setLoading };
}
