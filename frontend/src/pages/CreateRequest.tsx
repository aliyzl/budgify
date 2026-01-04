import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Department {
    id: number;
    name: string;
    monthlyBudget: number;
}

const CreateRequest: React.FC = () => {
    const { t } = useTranslation();
    const [departments, setDepartments] = useState<Department[]>([]);
    const [formData, setFormData] = useState({
        platformName: '',
        cost: '',
        currency: 'USD',
        departmentId: '',
        paymentFrequency: 'MONTHLY',
        planType: '',
        url: '',
        username: '',
        password: '',
    });
    const [screenshot, setScreenshot] = useState<File | null>(null);
    const [budgetWarning, setBudgetWarning] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const token = localStorage.getItem('token');
                
                // The backend already filters departments based on user role
                // Managers only get departments they have access to
                const res = await axios.get(`${API_URL}/departments`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setDepartments(res.data);
            } catch (err) {
                console.error('Failed to load departments', err);
            }
        };
        fetchDepartments();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const newFormData = { ...formData, [e.target.name]: e.target.value };
        setFormData(newFormData);
        
        // Check budget when cost or department changes
        if ((e.target.name === 'cost' || e.target.name === 'departmentId') && newFormData.cost && newFormData.departmentId) {
            checkBudgetWarning(newFormData);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setScreenshot(e.target.files[0]);
        }
    };

    const checkBudgetWarning = async (data: typeof formData) => {
        if (!data.cost || !data.departmentId) return;
        
        try {
            const dept = departments.find(d => d.id === Number(data.departmentId));
            if (!dept) return;

            // Calculate current usage (simplified - in real app, fetch from API)
            // For now, we'll show warning if cost exceeds budget
            const cost = Number(data.cost);
            if (cost > dept.monthlyBudget) {
                setBudgetWarning({
                    show: true,
                    message: t('createRequest.budgetWarning', { currency: data.currency, cost, budget: dept.monthlyBudget })
                });
            } else {
                setBudgetWarning({ show: false, message: '' });
            }
        } catch (err) {
            console.error('Error checking budget:', err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const formDataToSend = new FormData();
            
            formDataToSend.append('platformName', formData.platformName);
            formDataToSend.append('cost', formData.cost);
            formDataToSend.append('currency', formData.currency);
            formDataToSend.append('departmentId', formData.departmentId);
            formDataToSend.append('paymentFrequency', formData.paymentFrequency);
            if (formData.planType) formDataToSend.append('planType', formData.planType);
            if (formData.url) formDataToSend.append('url', formData.url);
            
            // Format and include credentials if username is provided
            if (formData.username.trim()) {
                const credentials = `Username: ${formData.username}\nPassword: ${formData.password || '(not provided)'}`;
                formDataToSend.append('credentials', credentials);
            }
            
            if (screenshot) formDataToSend.append('screenshot', screenshot);

            const response = await axios.post(`${API_URL}/requests`, formDataToSend, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            // Show budget warning if returned from server
            if (response.data.budgetWarning) {
                const dept = departments.find(d => d.id === Number(formData.departmentId));
                setBudgetWarning({
                    show: true,
                    message: t('createRequest.budgetWarningExceeds', { budget: dept?.monthlyBudget || 'N/A' })
                });
                // Don't navigate, let user see the warning
                return;
            }

            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.error || t('createRequest.failedToCreate'));
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8 flex justify-center">
            <div className="w-full max-w-lg bg-white rounded-lg shadow p-6 relative">
                <div className="absolute top-4 right-4">
                    <LanguageSwitcher />
                </div>
                <h2 className="text-2xl font-bold mb-6 text-gray-900">{t('createRequest.title')}</h2>
                {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
                
                {budgetWarning.show && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 rounded">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-yellow-700 font-semibold">{budgetWarning.message}</p>
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('createRequest.platformName')}</label>
                        <input name="platformName" required value={formData.platformName} onChange={handleChange} className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" placeholder={t('createRequest.platformPlaceholder')} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('common.cost')}</label>
                            <input name="cost" type="number" step="0.01" required value={formData.cost} onChange={handleChange} className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('common.currency')}</label>
                            <select name="currency" value={formData.currency} onChange={handleChange} className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('createRequest.paymentFrequency')}</label>
                        <select name="paymentFrequency" value={formData.paymentFrequency} onChange={handleChange} className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">
                            <option value="MONTHLY">{t('paymentFrequency.monthly')}</option>
                            <option value="YEARLY">{t('paymentFrequency.yearly')}</option>
                            <option value="ONE_TIME">{t('paymentFrequency.oneTime')}</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('createRequest.department')}</label>
                        <select name="departmentId" required value={formData.departmentId} onChange={handleChange} className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">
                            <option value="">{t('createRequest.selectDepartment')}</option>
                            {departments.map(dept => (
                                <option key={dept.id} value={dept.id}>{dept.name} ({t('createRequest.budget', { amount: dept.monthlyBudget })})</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('createRequest.planType')}</label>
                        <input name="planType" value={formData.planType} onChange={handleChange} className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" placeholder={t('createRequest.planTypePlaceholder')} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('createRequest.url')}</label>
                        <input name="url" type="url" value={formData.url} onChange={handleChange} className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" placeholder={t('createRequest.urlPlaceholder')} />
                    </div>

                    <div className="border-t pt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('createRequest.credentials')}</label>
                        <p className="text-xs text-gray-500 mb-3">{t('createRequest.credentialsNote')}</p>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">{t('createRequest.username')}</label>
                                <input 
                                    name="username" 
                                    type="text" 
                                    value={formData.username} 
                                    onChange={handleChange} 
                                    className="block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" 
                                    placeholder={t('createRequest.usernamePlaceholder')} 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">{t('common.password')}</label>
                                <input 
                                    name="password" 
                                    type="password" 
                                    value={formData.password} 
                                    onChange={handleChange} 
                                    className="block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" 
                                    placeholder={t('createRequest.passwordPlaceholder')} 
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('createRequest.screenshot')}</label>
                        <input 
                            name="screenshot" 
                            type="file" 
                            accept="image/*" 
                            onChange={handleFileChange}
                            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        />
                        {screenshot && (
                            <p className="mt-1 text-sm text-gray-500">{t('createRequest.selectedFile', { filename: screenshot.name })}</p>
                        )}
                    </div>

                    <div className="pt-4 flex justify-end space-x-3">
                        <button type="button" onClick={() => navigate('/dashboard')} className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">{t('common.cancel')}</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 rounded text-sm text-white hover:bg-indigo-700">{t('createRequest.submitRequest')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateRequest;
