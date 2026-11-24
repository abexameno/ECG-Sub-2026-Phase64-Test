import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Theme } from '../types.ts';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark');
    root.classList.add('light');
    try {
      localStorage.setItem('examenoTheme', 'light');
    } catch (e) {}
  }, []);

  const toggleTheme = () => {};

  return React.createElement(ThemeContext.Provider, { value: { theme: 'light', toggleTheme } }, children);
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};