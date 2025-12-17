import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Comment {
    id: number;
    content: string;
    createdAt: string;
    user: { name: string; role: string; id: number };
}

interface RequestDetail {
    id: number;
    platformName: string;
    cost: number;
    status: string;
    currency: string;
    exchangeRate?: number;
    localCost?: number;
    paymentCardId?: string;
    rejectionReason?: string;
    requester: { name: string; email: string; id: number };
    paymentFrequency: string;
    createdAt: string;
    attachmentUrl?: string;
    url?: string;
    planType?: string;
    credentialVault?: string;
    department?: { id?: number; name: string; monthlyBudget: number };
    departmentId?: number;
    comments?: Comment[];
    deletedAt?: string;
}

const RequestDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [request, setRequest] = useState<RequestDetail | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [credentials, setCredentials] = useState('');
    const [showCredentials, setShowCredentials] = useState(false);
    const [decryptedCredentials, setDecryptedCredentials] = useState('');
    const [paymentInfo, setPaymentInfo] = useState({
        exchangeRate: '',
        localCost: '',
        paymentCardId: ''
    });
    const [showStatusChange, setShowStatusChange] = useState(false);
    const [newStatus, setNewStatus] = useState<string>('');
    const [statusChangeCost, setStatusChangeCost] = useState<string>('');
    const [statusChangeReason, setStatusChangeReason] = useState<string>('');
    const [showEditForm, setShowEditForm] = useState(false);
    const [editFormData, setEditFormData] = useState({
        platformName: '',
        cost: '',
        currency: 'USD',
        departmentId: '',
        paymentFrequency: 'MONTHLY',
        planType: '',
        url: '',
    });
    const [editScreenshot, setEditScreenshot] = useState<File | null>(null);
    const [departments, setDepartments] = useState<Array<{ id: number; name: string; monthlyBudget: number }>>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const navigate = useNavigate();
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    // Fetch details
    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                
                // Fetch Request Details using new endpoint
                const reqRes = await axios.get(`${API_URL}/requests/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setRequest(reqRes.data);
                setComments(reqRes.data.comments || []);
                
                // Set payment info if exists
                if (reqRes.data.exchangeRate || reqRes.data.localCost || reqRes.data.paymentCardId) {
                    setPaymentInfo({
                        exchangeRate: reqRes.data.exchangeRate?.toString() || '',
                        localCost: reqRes.data.localCost?.toString() || '',
                        paymentCardId: reqRes.data.paymentCardId || ''
                    });
                }
            } catch (e) {
                console.error(e);
            }
        };
        fetchData();
    }, [id]);

    // Fetch departments for edit form
    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${API_URL}/departments`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setDepartments(res.data);
            } catch (err) {
                console.error('Failed to load departments', err);
            }
        };
        if (showEditForm) {
            fetchDepartments();
        }
    }, [showEditForm]);

    const handleSendComment = async () => {
        if (!newComment.trim()) return;
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/comments`,
                { content: newComment, requestId: Number(id) },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setComments([...comments, res.data]);
            setNewComment('');
        } catch (e) {
            alert('Failed to send comment');
        }
    };

    const handleStatusChange = async () => {
        if (!newStatus) {
            alert('Please select a new status');
            return;
        }

        if (newStatus === 'REJECTED' && !statusChangeReason.trim()) {
            alert('Rejection reason is required');
            return;
        }

        const confirmMessage = `Are you sure you want to change this request from ${request?.status} to ${newStatus}?`;
        if (!window.confirm(confirmMessage)) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const updateData: any = { status: newStatus };
            
            if (newStatus === 'REJECTED') {
                updateData.rejectionReason = statusChangeReason;
            }
            if (newStatus === 'APPROVED' && statusChangeCost.trim()) {
                const cost = parseFloat(statusChangeCost);
                if (!isNaN(cost)) {
                    updateData.cost = cost;
                }
            }

            const res = await axios.patch(`${API_URL}/requests/${id}/status`,
                updateData,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setRequest(res.data);
            setShowStatusChange(false);
            setNewStatus('');
            setStatusChangeCost('');
            setStatusChangeReason('');
            alert('Status updated successfully');
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || 'Failed to update status';
            alert(errorMsg);
        }
    };

    const getAvailableStatuses = (currentStatus: string): string[] => {
        const statusMap: Record<string, string[]> = {
            'PENDING': ['APPROVED', 'REJECTED'],
            'APPROVED': ['PENDING', 'REJECTED', 'ACTIVE'],
            'REJECTED': ['PENDING', 'APPROVED'],
            'ACTIVE': ['EXPIRED', 'CANCELLED', 'PENDING'],
            'EXPIRED': ['PENDING', 'ACTIVE'],
            'CANCELLED': ['PENDING']
        };
        return statusMap[currentStatus] || ['PENDING'];
    };

    const handleSaveCredentials = async () => {
        if (!credentials.trim()) return;
        try {
            const token = localStorage.getItem('token');
            await axios.patch(`${API_URL}/requests/${id}/credentials`,
                { credentials },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert('Credentials saved securely!');
            setCredentials('');
            // Refresh request data
            const reqRes = await axios.get(`${API_URL}/requests/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRequest(reqRes.data);
        } catch (e: any) {
            alert(e.response?.data?.error || 'Failed to save credentials');
        }
    };

    const handleViewCredentials = async () => {
        if (!request?.credentialVault) return;
        try {
            const token = localStorage.getItem('token');
            // Decrypt on backend and return
            const res = await axios.get(`${API_URL}/requests/${id}/credentials`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDecryptedCredentials(res.data.credentials);
            setShowCredentials(true);
        } catch (e: any) {
            alert(e.response?.data?.error || 'Failed to decrypt credentials');
        }
    };

    const handleSavePaymentInfo = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.patch(`${API_URL}/requests/${id}/payment`,
                {
                    exchangeRate: paymentInfo.exchangeRate ? Number(paymentInfo.exchangeRate) : undefined,
                    localCost: paymentInfo.localCost ? Number(paymentInfo.localCost) : undefined,
                    paymentCardId: paymentInfo.paymentCardId || undefined
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert('Payment information saved!');
            // Refresh request data
            const reqRes = await axios.get(`${API_URL}/requests/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRequest(reqRes.data);
        } catch (e: any) {
            alert(e.response?.data?.error || 'Failed to save payment info');
        }
    };

    const handleEditClick = () => {
        if (!request) return;
        
        // Get departmentId - try from request.departmentId first, then from department.id
        const deptId = request.departmentId?.toString() || (request.department as any)?.id?.toString() || '';
        
        setEditFormData({
            platformName: request.platformName,
            cost: request.cost.toString(),
            currency: request.currency,
            departmentId: deptId,
            paymentFrequency: request.paymentFrequency,
            planType: request.planType || '',
            url: request.url || '',
        });
        setEditScreenshot(null);
        setShowEditForm(true);
    };

    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
    };

    const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setEditScreenshot(e.target.files[0]);
        }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const formDataToSend = new FormData();
            
            formDataToSend.append('platformName', editFormData.platformName);
            formDataToSend.append('cost', editFormData.cost);
            formDataToSend.append('currency', editFormData.currency);
            formDataToSend.append('departmentId', editFormData.departmentId);
            formDataToSend.append('paymentFrequency', editFormData.paymentFrequency);
            if (editFormData.planType) formDataToSend.append('planType', editFormData.planType);
            if (editFormData.url) formDataToSend.append('url', editFormData.url);
            if (editScreenshot) formDataToSend.append('screenshot', editScreenshot);

            const res = await axios.put(`${API_URL}/requests/${id}`, formDataToSend, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            setRequest(res.data);
            setComments(res.data.comments || []);
            setShowEditForm(false);
            alert('Request updated successfully!');
        } catch (e: any) {
            alert(e.response?.data?.error || 'Failed to update request');
        }
    };

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const handleDeleteConfirm = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/requests/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Request deleted successfully!');
            navigate('/dashboard');
        } catch (e: any) {
            alert(e.response?.data?.error || 'Failed to delete request');
            setShowDeleteConfirm(false);
        }
    };

    if (!request) return <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">Loading...</div>;

    const isAccountant = currentUser.role === 'ACCOUNTANT' || currentUser.role === 'ADMIN';
    const isManager = currentUser.role === 'MANAGER';
    const isRequester = isManager && request.requester.id === currentUser.id;

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto">
                <button onClick={() => navigate('/dashboard')} className="text-sm text-gray-500 mb-4">&larr; Back to Dashboard</button>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Request Details */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Request #{request.id}</h2>

                            <div className="space-y-4">
                                <div>
                                    <span className="text-gray-500 text-sm">Platform</span>
                                    <p className="font-medium text-lg">{request.platformName}</p>
                                </div>
                                <div>
                                    <span className="text-gray-500 text-sm">Cost</span>
                                    <p className="font-medium">{request.currency} {request.cost} ({request.paymentFrequency})</p>
                                    {request.localCost && (
                                        <p className="text-sm text-gray-600">Local Cost: ${request.localCost}</p>
                                    )}
                                </div>
                                {request.exchangeRate && (
                                    <div>
                                        <span className="text-gray-500 text-sm">Exchange Rate</span>
                                        <p className="font-medium">{request.exchangeRate}</p>
                                    </div>
                                )}
                                {request.paymentCardId && (
                                    <div>
                                        <span className="text-gray-500 text-sm">Payment Card</span>
                                        <p className="font-medium">{request.paymentCardId}</p>
                                    </div>
                                )}
                                <div>
                                    <span className="text-gray-500 text-sm">Status</span>
                                    <div className="flex items-center gap-3">
                                        <p className={`font-bold ${request.status === 'APPROVED' ? 'text-green-600' : request.status === 'REJECTED' ? 'text-red-600' : request.status === 'ACTIVE' ? 'text-blue-600' : 'text-yellow-600'}`}>
                                            {request.status}
                                        </p>
                                        {isAccountant && (
                                            <button
                                                onClick={() => {
                                                    setShowStatusChange(!showStatusChange);
                                                    if (!showStatusChange) {
                                                        setNewStatus('');
                                                        setStatusChangeCost('');
                                                        setStatusChangeReason('');
                                                    }
                                                }}
                                                className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200"
                                            >
                                                {showStatusChange ? 'Cancel' : 'Change Status'}
                                            </button>
                                        )}
                                        {isRequester && request.status === 'PENDING' && (
                                            <>
                                                <button
                                                    onClick={handleEditClick}
                                                    className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={handleDeleteClick}
                                                    className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                                                >
                                                    Delete
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Status Change Section */}
                                {isAccountant && showStatusChange && request && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-2">
                                        <h4 className="font-semibold text-blue-900 mb-3">Change Request Status</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    New Status
                                                </label>
                                                <select
                                                    value={newStatus}
                                                    onChange={(e) => setNewStatus(e.target.value)}
                                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                >
                                                    <option value="">Select new status...</option>
                                                    {getAvailableStatuses(request.status).map((status) => (
                                                        <option key={status} value={status}>
                                                            {status}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {newStatus === 'APPROVED' && (
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Final Cost (optional, leave empty to keep current)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={statusChangeCost}
                                                        onChange={(e) => setStatusChangeCost(e.target.value)}
                                                        placeholder={`Current: ${request.currency} ${request.cost}`}
                                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                    />
                                                </div>
                                            )}

                                            {newStatus === 'REJECTED' && (
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Rejection Reason <span className="text-red-600">*</span>
                                                    </label>
                                                    <textarea
                                                        value={statusChangeReason}
                                                        onChange={(e) => setStatusChangeReason(e.target.value)}
                                                        placeholder="Enter reason for rejection..."
                                                        rows={3}
                                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                        required
                                                    />
                                                </div>
                                            )}

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleStatusChange}
                                                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                                                >
                                                    Update Status
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setShowStatusChange(false);
                                                        setNewStatus('');
                                                        setStatusChangeCost('');
                                                        setStatusChangeReason('');
                                                    }}
                                                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {request.rejectionReason && (
                                    <div className="bg-red-50 p-3 rounded">
                                        <span className="text-red-800 text-sm font-bold">Rejection Reason:</span>
                                        <p className="text-red-700">{request.rejectionReason}</p>
                                    </div>
                                )}
                                {request.url && (
                                    <div>
                                        <span className="text-gray-500 text-sm">URL</span>
                                        <p className="font-medium"><a href={request.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">{request.url}</a></p>
                                    </div>
                                )}
                                {request.planType && (
                                    <div>
                                        <span className="text-gray-500 text-sm">Plan Type</span>
                                        <p className="font-medium">{request.planType}</p>
                                    </div>
                                )}
                                {request.attachmentUrl && (
                                    <div>
                                        <span className="text-gray-500 text-sm">Screenshot</span>
                                        <div className="mt-2">
                                            <img 
                                                src={`${API_URL}${request.attachmentUrl}`} 
                                                alt="Screenshot" 
                                                className="max-w-full h-auto rounded border"
                                            />
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <span className="text-gray-500 text-sm">Requester</span>
                                    <p>{request.requester?.name} ({request.requester?.email})</p>
                                </div>
                            </div>
                        </div>

                        {/* Edit Form */}
                        {showEditForm && (
                            <div className="bg-white rounded-lg shadow p-6 border-2 border-blue-200">
                                <h3 className="text-lg font-bold mb-4">Edit Request</h3>
                                <form onSubmit={handleEditSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Platform/Tool Name</label>
                                        <input 
                                            name="platformName" 
                                            required 
                                            value={editFormData.platformName} 
                                            onChange={handleEditChange} 
                                            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" 
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Cost</label>
                                            <input 
                                                name="cost" 
                                                type="number" 
                                                step="0.01" 
                                                required 
                                                value={editFormData.cost} 
                                                onChange={handleEditChange} 
                                                className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Currency</label>
                                            <select 
                                                name="currency" 
                                                value={editFormData.currency} 
                                                onChange={handleEditChange} 
                                                className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            >
                                                <option value="USD">USD</option>
                                                <option value="EUR">EUR</option>
                                                <option value="GBP">GBP</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Payment Frequency</label>
                                        <select 
                                            name="paymentFrequency" 
                                            value={editFormData.paymentFrequency} 
                                            onChange={handleEditChange} 
                                            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        >
                                            <option value="MONTHLY">Monthly</option>
                                            <option value="YEARLY">Yearly</option>
                                            <option value="ONE_TIME">One Time</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Department</label>
                                        <select 
                                            name="departmentId" 
                                            required 
                                            value={editFormData.departmentId} 
                                            onChange={handleEditChange} 
                                            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        >
                                            <option value="">Select Department</option>
                                            {departments.map(dept => (
                                                <option key={dept.id} value={dept.id}>{dept.name} (Budget: ${dept.monthlyBudget})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Plan Type (Optional)</label>
                                        <input 
                                            name="planType" 
                                            value={editFormData.planType} 
                                            onChange={handleEditChange} 
                                            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" 
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">URL (Optional)</label>
                                        <input 
                                            name="url" 
                                            type="url" 
                                            value={editFormData.url} 
                                            onChange={handleEditChange} 
                                            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" 
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Screenshot (Optional)</label>
                                        <input 
                                            name="screenshot" 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={handleEditFileChange}
                                            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                        />
                                        {editScreenshot && (
                                            <p className="mt-1 text-sm text-gray-500">Selected: {editScreenshot.name}</p>
                                        )}
                                    </div>

                                    <div className="pt-4 flex justify-end space-x-3">
                                        <button 
                                            type="button" 
                                            onClick={() => setShowEditForm(false)} 
                                            className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            type="submit" 
                                            className="px-4 py-2 bg-indigo-600 rounded text-sm text-white hover:bg-indigo-700"
                                        >
                                            Save Changes
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Delete Confirmation Dialog */}
                        {showDeleteConfirm && (
                            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4">Confirm Delete</h3>
                                    <p className="text-gray-700 mb-6">
                                        Are you sure you want to delete this request? This action cannot be undone. Accountants will be notified of this deletion.
                                    </p>
                                    <div className="flex justify-end space-x-3">
                                        <button 
                                            onClick={() => setShowDeleteConfirm(false)}
                                            className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            onClick={handleDeleteConfirm}
                                            className="px-4 py-2 bg-red-600 rounded text-sm text-white hover:bg-red-700"
                                        >
                                            Delete Request
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Secure Vault - Accountant Input */}
                        {isAccountant && (
                            <div className="bg-white rounded-lg shadow p-6">
                                <h3 className="text-lg font-bold mb-4">🔐 Secure Vault - Add Credentials</h3>
                                <p className="text-sm text-gray-600 mb-4">Enter the username and password securely. Only the requesting manager can view these.</p>
                                <textarea
                                    className="w-full border rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500 mb-3"
                                    rows={4}
                                    placeholder="Username: example@email.com&#10;Password: ********"
                                    value={credentials}
                                    onChange={(e) => setCredentials(e.target.value)}
                                />
                                <button
                                    onClick={handleSaveCredentials}
                                    className="w-full bg-indigo-600 text-white py-2 rounded font-medium hover:bg-indigo-700 disabled:opacity-50"
                                    disabled={!credentials.trim()}
                                >
                                    Save Credentials Securely
                                </button>
                            </div>
                        )}

                        {/* Secure Vault - Manager View */}
                        {isRequester && request.credentialVault && (
                            <div className="bg-white rounded-lg shadow p-6 border-2 border-indigo-200">
                                <h3 className="text-lg font-bold mb-4">🔐 Secure Vault - Your Credentials</h3>
                                {!showCredentials ? (
                                    <>
                                        <p className="text-sm text-gray-600 mb-4">Credentials are stored securely. Click to view.</p>
                                        <button
                                            onClick={handleViewCredentials}
                                            className="w-full bg-indigo-600 text-white py-2 rounded font-medium hover:bg-indigo-700"
                                        >
                                            View Credentials
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div className="bg-gray-50 p-4 rounded mb-4">
                                            <pre className="whitespace-pre-wrap text-sm font-mono">{decryptedCredentials}</pre>
                                        </div>
                                        <button
                                            onClick={() => setShowCredentials(false)}
                                            className="w-full bg-gray-200 text-gray-700 py-2 rounded font-medium hover:bg-gray-300"
                                        >
                                            Hide Credentials
                                        </button>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Payment Info - Accountant */}
                        {isAccountant && (
                            <div className="bg-white rounded-lg shadow p-6">
                                <h3 className="text-lg font-bold mb-4">💳 Payment Information</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Exchange Rate</label>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            className="w-full border rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            placeholder="e.g. 1.25"
                                            value={paymentInfo.exchangeRate}
                                            onChange={(e) => setPaymentInfo({ ...paymentInfo, exchangeRate: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Local Cost (after conversion)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full border rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            placeholder="e.g. 1250.00"
                                            value={paymentInfo.localCost}
                                            onChange={(e) => setPaymentInfo({ ...paymentInfo, localCost: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Payment Card ID</label>
                                        <input
                                            type="text"
                                            className="w-full border rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            placeholder="e.g. Card-1234"
                                            value={paymentInfo.paymentCardId}
                                            onChange={(e) => setPaymentInfo({ ...paymentInfo, paymentCardId: e.target.value })}
                                        />
                                    </div>
                                    <button
                                        onClick={handleSavePaymentInfo}
                                        className="w-full bg-indigo-600 text-white py-2 rounded font-medium hover:bg-indigo-700"
                                    >
                                        Save Payment Info
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Comments */}
                    <div className="bg-white rounded-lg shadow p-6 flex flex-col h-fit lg:h-[600px]">
                        <h3 className="text-lg font-bold mb-4">Discussion</h3>

                        <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-2 min-h-[200px]">
                            {comments.length === 0 && <p className="text-gray-400 text-center italic">No comments yet.</p>}
                            {comments.map(c => (
                                <div key={c.id} className={`flex flex-col ${c.user.id === currentUser.id ? 'items-end' : 'items-start'}`}>
                                    <div className={`max-w-[80%] rounded-lg p-3 ${c.user.id === currentUser.id ? 'bg-indigo-100 text-indigo-900' : 'bg-gray-100 text-gray-900'}`}>
                                        <p className="text-sm">{c.content}</p>
                                    </div>
                                    <span className="text-xs text-gray-400 mt-1">{c.user.name} • {new Date(c.createdAt).toLocaleTimeString()}</span>
                                </div>
                            ))}
                        </div>

                        <div className="border-t pt-4">
                            <textarea
                                className="w-full border rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
                                rows={3}
                                placeholder="Type a comment..."
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                            />
                            <button
                                onClick={handleSendComment}
                                className="mt-2 w-full bg-indigo-600 text-white py-2 rounded font-medium hover:bg-indigo-700 disabled:opacity-50"
                                disabled={!newComment.trim()}
                            >
                                Send Comment
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RequestDetails;
