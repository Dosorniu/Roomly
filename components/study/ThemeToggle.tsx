'use client';
import { Moon, Sun } from 'lucide-react';
import { useAppTheme } from './AppTheme';
export function ThemeToggle() {
  const { theme, setTheme } = useAppTheme();
  const dark = theme === 'dark';
  return <button className="icon-button theme-toggle" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setTheme(dark ? 'light' : 'dark')}><Sun className="sun-icon" size={19}/><Moon className="moon-icon" size={19}/></button>;
}
