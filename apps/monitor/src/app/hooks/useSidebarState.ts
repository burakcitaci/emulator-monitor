import { useState, useEffect } from 'react';

export const useSidebarState = () => {
  const [isOpen, setIsOpen] = useState(() => {
    // Read initial state from cookie
    const cookieStore = document.cookie
      .split('; ')
      .map((v) => v.split('='))
      .reduce(
        (acc, [key, value]) => {
          acc[key] = value;
          return acc;
        },
        {} as Record<string, string>,
      );

    return cookieStore['sidebar_state'] === 'true';
  });

  // Update cookie when sidebar state changes
  useEffect(() => {
    document.cookie = `sidebar_state=${isOpen}; path=/; max-age=31536000`; // 1 year
  }, [isOpen]);

  const toggleSidebar = () => setIsOpen((prev) => !prev);
  const openSidebar = () => setIsOpen(true);
  const closeSidebar = () => setIsOpen(false);

  return {
    isOpen,
    toggleSidebar,
    openSidebar,
    closeSidebar,
  };
};