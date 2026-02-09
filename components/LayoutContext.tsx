
import React, { createContext, useContext, useState } from 'react';

interface LayoutContextType {
    isSidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    toggleSidebar: () => void;
}

const LayoutContext = createContext<LayoutContextType>({
    isSidebarOpen: false,
    setSidebarOpen: () => { },
    toggleSidebar: () => { },
});

export const useLayout = () => useContext(LayoutContext);

export const LayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isSidebarOpen, setSidebarOpen] = useState(false);

    const toggleSidebar = () => setSidebarOpen(prev => !prev);
    

    return (
        <LayoutContext.Provider value={{ isSidebarOpen, setSidebarOpen, toggleSidebar }}>
            {children}
        </LayoutContext.Provider>
    );
};
