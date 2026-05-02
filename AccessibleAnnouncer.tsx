import React, { createContext, useContext, useState, useCallback } from 'react';

interface AnnouncerContextType {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
}

const AnnouncerContext = createContext<AnnouncerContextType>({ announce: () => {} });

export const useAnnouncer = () => useContext(AnnouncerContext);

export const AnnouncerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (priority === 'assertive') {
      setAssertiveMessage('');
      requestAnimationFrame(() => setAssertiveMessage(message));
    } else {
      setPoliteMessage('');
      requestAnimationFrame(() => setPoliteMessage(message));
    }
  }, []);

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        role="status"
        className="sr-only"
      >
        {politeMessage}
      </div>
      <div
        aria-live="assertive"
        aria-atomic="true"
        role="alert"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </AnnouncerContext.Provider>
  );
};
