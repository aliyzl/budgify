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
    department?: { name: string; monthlyBudget: number };
    comments?: Comment[];
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
                                    <p className={`font-bold ${request.status === 'APPROVED' ? 'text-green-600' : request.status === 'REJECTED' ? 'text-red-600' : 'text-yellow-600'}`}>
                                        {request.status}
                                    </p>
                                </div>
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
