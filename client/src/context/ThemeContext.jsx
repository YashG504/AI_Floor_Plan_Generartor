import { createContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    // Default to dark if no preference, or check system preference
    if (savedTheme) {
      return savedTheme;
    }
    return 'dark'; // Defaulting to dark as per current design
  });

  useEffect(() => {
    const root = window.document.documentElement;

    // Remove both to prevent conflicts (though usually only one is present)
    root.classList.remove('light', 'dark');

    // Add current theme class
    root.classList.add(theme);

    // Save to local storage
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
