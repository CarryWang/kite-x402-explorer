import React, { useEffect } from 'react';

export const SearchShortcutListener: React.FC<{ onTrigger: () => void }> = ({ onTrigger }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onTrigger();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTrigger]);

  return null;
};

export default SearchShortcutListener;
