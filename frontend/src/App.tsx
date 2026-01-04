import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CreateRequest from './pages/CreateRequest';
import RequestDetails from './pages/RequestDetails';
import Analytics from './pages/Analytics';
import UserManagement from './pages/UserManagement';
import DepartmentManagement from './pages/DepartmentManagement';
import DepartmentBudgets from './pages/DepartmentBudgets';

const App: React.FC = () => {
  const { i18n } = useTranslation();

  useEffect(() => {
    // Set initial direction based on language
    const lang = i18n.language || localStorage.getItem('i18nextLng') || 'en';
    const isRTL = lang.startsWith('fa');
    document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
    
    // Listen for language changes
    const handleLanguageChanged = (lng: string) => {
      const isRTL = lng.startsWith('fa');
      document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
      document.documentElement.setAttribute('lang', lng);
    };

    i18n.on('languageChanged', handleLanguageChanged);
    
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/requests/new" element={<CreateRequest />} />
        <Route path="/requests/:id" element={<RequestDetails />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/departments" element={<DepartmentManagement />} />
        <Route path="/departments/budgets" element={<DepartmentBudgets />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
