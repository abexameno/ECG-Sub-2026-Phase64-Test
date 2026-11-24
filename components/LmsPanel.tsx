import React from 'react';
import { ElmsIntegrationPanel } from './ElmsIntegrationPanel.tsx';
import { User } from '../types.ts';

interface LmsPanelProps {
  currentUser?: User | null;
}

const LmsPanel: React.FC<LmsPanelProps> = ({ currentUser = null }) => {
  return <ElmsIntegrationPanel currentUser={currentUser} />;
};

export default LmsPanel;
