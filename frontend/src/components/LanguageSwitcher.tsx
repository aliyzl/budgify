import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const LanguageSwitcher: React.FC = () => {
    const { i18n } = useTranslation();
    const [currentLang, setCurrentLang] = useState(i18n.language);

    useEffect(() => {
        // Set initial language from localStorage or default
        const savedLang = localStorage.getItem('i18nextLng') || 'en';
        const lang = savedLang.startsWith('fa') ? 'fa' : 'en';
        if (i18n.language !== lang) {
            i18n.changeLanguage(lang);
            setCurrentLang(lang);
        }
    }, [i18n]);

    const handleLanguageChange = async (lang: 'en' | 'fa') => {
        // Update i18n immediately
        await i18n.changeLanguage(lang);
        setCurrentLang(lang);
        
        // Save to localStorage
        localStorage.setItem('i18nextLng', lang);
        
        // Update document direction for RTL
        document.documentElement.setAttribute('dir', lang === 'fa' ? 'rtl' : 'ltr');
        document.documentElement.setAttribute('lang', lang);
        
        // Sync to backend if authenticated
        const token = localStorage.getItem('token');
        if (token) {
            try {
                await axios.patch(
                    `${API_URL}/users/me/language`,
                    { preferredLanguage: lang },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            } catch (error) {
                console.error('Failed to sync language preference to backend:', error);
                // Continue anyway - localStorage is already updated
            }
        }
    };

    // Set initial direction on mount
    useEffect(() => {
        const lang = currentLang === 'fa' ? 'fa' : 'en';
        document.documentElement.setAttribute('dir', lang === 'fa' ? 'rtl' : 'ltr');
        document.documentElement.setAttribute('lang', lang);
    }, [currentLang]);

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={() => handleLanguageChange('en')}
                className={`px-3 py-1.5 text-sm rounded transition ${
                    currentLang === 'en'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
                English
            </button>
            <button
                onClick={() => handleLanguageChange('fa')}
                className={`px-3 py-1.5 text-sm rounded transition ${
                    currentLang === 'fa'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
                فارسی
            </button>
        </div>
    );
};

export default LanguageSwitcher;

