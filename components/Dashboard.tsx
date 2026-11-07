
import React, { useState, useEffect, useRef } from 'react';
import { Asset, AssetType, AssetScale, Device, Group, User, UserRole, AuditLogEntry, SystemConfig, Campaign } from '../types';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Globe from 'lucide-react/dist/esm/icons/globe';
import ImageIcon from 'lucide-react/dist/esm/icons/image';
import Video from 'lucide-react/dist/esm/icons/video';
import Monitor from 'lucide-react/dist/esm/icons/monitor';
import Tv from 'lucide-react/dist/esm/icons/tv';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import Clock from 'lucide-react/dist/esm/icons/clock';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import Layers from 'lucide-react/dist/esm/icons/layers';
import LayoutGrid from 'lucide-react/dist/esm/icons/layout-grid';
import Users from 'lucide-react/dist/esm/icons/users';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import PlayCircle from 'lucide-react/dist/esm/icons/play-circle';
import Edit2 from 'lucide-react/dist/esm/icons/edit-2';
import Upload from 'lucide-react/dist/esm/icons/upload';
import X from 'lucide-react/dist/esm/icons/x';
import Search from 'lucide-react/dist/esm/icons/search';
import Smartphone from 'lucide-react/dist/esm/icons/smartphone';
import Shield from 'lucide-react/dist/esm/icons/shield';
import LogOut from 'lucide-react/dist/esm/icons/log-out';
import SettingsIcon from 'lucide-react/dist/esm/icons/settings';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import UserPlus from 'lucide-react/dist/esm/icons/user-plus';
import Key from 'lucide-react/dist/esm/icons/key';
import Mail from 'lucide-react/dist/esm/icons/mail';
import Lock from 'lucide-react/dist/esm/icons/lock';
import Send from 'lucide-react/dist/esm/icons/send';
import RefreshCcw from 'lucide-react/dist/esm/icons/refresh-ccw';
import PenTool from 'lucide-react/dist/esm/icons/pen-tool';
import RotateCw from 'lucide-react/dist/esm/icons/rotate-cw';
import Save from 'lucide-react/dist/esm/icons/save';
import Server from 'lucide-react/dist/esm/icons/server';
import AtSign from 'lucide-react/dist/esm/icons/at-sign';
import Copy from 'lucide-react/dist/esm/icons/copy';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';
import List from 'lucide-react/dist/esm/icons/list';
import Flag from 'lucide-react/dist/esm/icons/flag';
import Layout from 'lucide-react/dist/esm/icons/layout';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import CheckSquare from 'lucide-react/dist/esm/icons/check-square';
import Square from 'lucide-react/dist/esm/icons/square';
import ArrowUpDown from 'lucide-react/dist/esm/icons/arrow-up-down';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import Menu from 'lucide-react/dist/esm/icons/menu';
import Folder from 'lucide-react/dist/esm/icons/folder';
import { server, safeStorage } from '../services/server';
import { ContentEditor } from './ContentEditor';
import { LayoutList } from './LayoutList';
import { CampaignList } from './CampaignList';
import { PlaylistList } from './PlaylistList';

const formatLastSeen = (lastSeen?: number) => {
    if (!lastSeen) return { text: 'Never', isOnline: false, fullDate: 'Never' };
    const diffMs = Date.now() - lastSeen;
    const isOnline = diffMs < 70000;
    const fullDate = new Date(lastSeen).toLocaleString();
    if (isOnline) return { text: 'Online (Live)', isOnline: true, fullDate };
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return { text: `${seconds}s ago`, isOnline: false, fullDate };
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return { text: `${minutes}m ago`, isOnline: false, fullDate };
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return { text: `${hours}h ago`, isOnline: false, fullDate };
    const days = Math.floor(hours / 24);
    return { text: `${days}d ago`, isOnline: false, fullDate };
};

const getOrientationBadge = (rotation: number = 0) => {
    switch (rotation) {
        case 90:
            return { label: 'Portrait', angle: '90°', isPortrait: true, bg: 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40 hover:border-indigo-400' };
        case 180:
            return { label: 'Landscape', angle: '180°', isPortrait: false, bg: 'bg-amber-950/80 text-amber-300 border-amber-500/40 hover:border-amber-400' };
        case 270:
            return { label: 'Portrait', angle: '270°', isPortrait: true, bg: 'bg-purple-950/80 text-purple-300 border-purple-500/40 hover:border-purple-400' };
        case 0:
        default:
            return { label: 'Landscape', angle: '0°', isPortrait: false, bg: 'bg-blue-950/80 text-blue-300 border-blue-500/40 hover:border-blue-400' };
    }
};

interface DashboardProps {
    onExit: () => void;
}
const Logo = () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <path d="M6 14a2 2 0 0 1 2 2" />
        <path d="M6 10a6 6 0 0 1 6 6" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
);

export const Dashboard: React.FC<DashboardProps> = ({ onExit }) => {
    const [user, setUser] = useState<User | null>(server.currentUser);

    // Auth State
    const [authView, setAuthView] = useState<'LOGIN' | 'FORGOT' | 'RESET' | 'FORCE_CHANGE'>('LOGIN');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    // Reset State
    const [resetCode, setResetCode] = useState('');
    const [newResetPassword, setNewResetPassword] = useState('');
    const [confirmResetPassword, setConfirmResetPassword] = useState('');
    const [resetMessage, setResetMessage] = useState('');

    // Dashboard State
    const [activeTab, setActiveTab] = useState<string>('DEVICES');
    const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
    const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
    const [editCampaignZone, setEditCampaignZone] = useState<{campaignId: string, zoneId: string, initialAssets: Asset[]} | null>(null);

    const [devices, setDevices] = useState<Device[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [usersList, setUsersList] = useState<User[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);

    const [filterQuery, setFilterQuery] = useState('');

    // Modal States
    const [isRegistering, setIsRegistering] = useState(false);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [isCreatingUser, setIsCreatingUser] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    // Edit Device State
    const [editingDevice, setEditingDevice] = useState<Device | null>(null);
    const [editDeviceName, setEditDeviceName] = useState('');
    const [editDeviceRotation, setEditDeviceRotation] = useState(0);
    const [editDeviceCampaign, setEditDeviceCampaign] = useState('');
    const [editDeviceOwnerId, setEditDeviceOwnerId] = useState('');

    // Preview State
    const [previewDevice, setPreviewDevice] = useState<Device | null>(null);
    const [previewCampaign, setPreviewCampaign] = useState<Campaign | null>(null);
    const [previewResolution, setPreviewResolution] = useState<'1080p' | '720p' | '4K'>('1080p');
    const [previewRotation, setPreviewRotation] = useState<number>(0);
    const [showScreenBoundaries, setShowScreenBoundaries] = useState<boolean>(true);

    // Logs Viewer State
    const [viewLogs, setViewLogs] = useState<string[] | null>(null);
    const [viewLogsDeviceId, setViewLogsDeviceId] = useState<string | null>(null);

    // View Mode States (List vs Grid)
    const [deviceViewMode, setDeviceViewMode] = useState<'list' | 'grid'>(() => {
        try {
            return (safeStorage.getItem('storecast_device_view_mode') as 'list' | 'grid') || 'list';
        } catch (e) {
            return 'list';
        }
    });

    const [groupViewMode, setGroupViewMode] = useState<'list' | 'grid'>(() => {
        try {
            return (safeStorage.getItem('storecast_group_view_mode') as 'list' | 'grid') || 'list';
        } catch (e) {
            return 'list';
        }
    });

    const handleSetDeviceViewMode = (mode: 'list' | 'grid') => {
        setDeviceViewMode(mode);
        try { safeStorage.setItem('storecast_device_view_mode', mode); } catch (e) {}
    };

    const handleSetGroupViewMode = (mode: 'list' | 'grid') => {
        setGroupViewMode(mode);
        try { safeStorage.setItem('storecast_group_view_mode', mode); } catch (e) {}
    };

    // Sidebar Submenus & Mobile Drawer State
    const [isContentMenuOpen, setIsContentMenuOpen] = useState(true);
    const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(true);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    // Device Table Sorting & Selection
    const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
    const [deviceSortField, setDeviceSortField] = useState<'name' | 'status' | 'group' | 'rotation' | 'lastSeen'>('name');
    const [deviceSortOrder, setDeviceSortOrder] = useState<'asc' | 'desc'>('asc');

    const handleDeviceSort = (field: 'name' | 'status' | 'group' | 'rotation' | 'lastSeen') => {
        if (deviceSortField === field) {
            setDeviceSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setDeviceSortField(field);
            setDeviceSortOrder('asc');
        }
    };

    const toggleSelectAllDevices = (currentFiltered: Device[]) => {
        if (selectedDeviceIds.length === currentFiltered.length) {
            setSelectedDeviceIds([]);
        } else {
            setSelectedDeviceIds(currentFiltered.map(d => d.id));
        }
    };

    const toggleSelectDevice = (id: string) => {
        setSelectedDeviceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleBulkReload = async () => {
        if (selectedDeviceIds.length === 0) return;
        let count = 0;
        for (const id of selectedDeviceIds) {
            const res = await server.refreshDevice(id);
            if (res.success) count++;
        }
        alert(`Sent remote reload signal to ${count} screens!`);
    };

    const handleBulkSetGroup = async (targetGroupId: string) => {
        if (selectedDeviceIds.length === 0) return;
        for (const id of selectedDeviceIds) {
            await server.setDeviceGroup(id, targetGroupId || null);
        }
        await server.fetchAllDevices();
        setSelectedDeviceIds([]);
    };

    const handleBulkDelete = async () => {
        if (selectedDeviceIds.length === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedDeviceIds.length} selected screens?`)) return;
        for (const id of selectedDeviceIds) {
            await server.deleteDevice(id);
        }
        await server.fetchAllDevices();
        setSelectedDeviceIds([]);
    };

    // Inputs
    const [pairingCodeInput, setPairingCodeInput] = useState('');
    const [deviceNameInput, setDeviceNameInput] = useState('');
    const [groupNameInput, setGroupNameInput] = useState('');
    const [newUserInput, setNewUserInput] = useState({ email: '', role: UserRole.OWNER });
    const [newPasswordInput, setNewPasswordInput] = useState('');
    const [confirmPasswordInput, setConfirmPasswordInput] = useState('');

    // Config Inputs
    const [configMailHost, setConfigMailHost] = useState('');
    const [configMailPort, setConfigMailPort] = useState(465);
    const [configMailUser, setConfigMailUser] = useState('');
    const [configMailPass, setConfigMailPass] = useState('');
    const [configMailFrom, setConfigMailFrom] = useState('');
    const [configGoogleClientId, setConfigGoogleClientId] = useState('');
    const [configGoogleClientSecret, setConfigGoogleClientSecret] = useState('');
    const [configGoogleRedirectUri, setConfigGoogleRedirectUri] = useState('');

    // Check URL parameters for OAuth errors or direct login token on mount
    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const err = params.get('login_error');
            if (err) {
                setLoginError(err);
                window.history.replaceState({}, '', window.location.pathname);
            }
            const token = params.get('token');
            const userParam = params.get('user');
            if (token && userParam) {
                const parsedUser = JSON.parse(decodeURIComponent(userParam));
                server.authToken = token;
                server.currentUser = parsedUser;
                safeStorage.setItem('storecast_token', token);
                safeStorage.setItem('storecast_user_info', JSON.stringify(parsedUser));
                setUser(parsedUser);
                window.history.replaceState({}, '', window.location.pathname);
            }
        } catch (e) {
            console.error('Error parsing auth URL params:', e);
        }
    }, []);

    // Server Loading State
    const [isLoadingServerData, setIsLoadingServerData] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Connecting to server...');

    // Initial Fetch & Subscription
    useEffect(() => {
        if (!user) return;

        setIsLoadingServerData(true);
        setLoadingMessage('Loading devices, groups & playlists...');

        // Initial fetch with loader promise tracking
        Promise.all([
            server.fetchAllDevices(),
            server.fetchAllGroups(),
            server.fetchAllLayouts(),
            server.fetchAllCampaigns(),
            server.fetchSavedPlaylists()
        ]).finally(() => {
            setIsLoadingServerData(false);
        });

        server.connectWebSocket('admin'); // Real-time Push Support [v1.1.0]

        // Admin fetches
        if (user.role === UserRole.ADMIN) {
            server.fetchUsers().then(setUsersList);
            server.fetchAuditLogs().then(setAuditLogs);
            server.fetchConfig().then(cfg => {
                setSystemConfig(cfg);
                if (cfg) {
                    setConfigMailHost(cfg.mailHost || 'smtp.gmail.com');
                    setConfigMailPort(cfg.mailPort || 465);
                    setConfigMailUser(cfg.mailUser || '');
                    setConfigMailPass(cfg.mailPass || '');
                    setConfigMailFrom(cfg.mailFrom || '');
                    setConfigGoogleClientId(cfg.googleClientId || '');
                    setConfigGoogleClientSecret(cfg.googleClientSecret || '');
                    setConfigGoogleRedirectUri(cfg.googleRedirectUri || '');
                }
            });
        }

        const update = (data?: any) => {
            console.log(`[DASHBOARD] Update triggered by: ${data?.type || 'generic notify'}. [VERSION 1.1.5]`);
            setDevices([...server.getAllDevices()]);
            setGroups([...server.getAllGroups()]);
        };

        update();
        const unsub = server.subscribe(update);
        return unsub;
    }, [user]);

    // Polling to update "Last Seen" statuses
    useEffect(() => {
        if (!user) return;
        const interval = setInterval(() => {
            server.fetchAllDevices();
        }, 60000); // Poll every 60 seconds (fallback for WebSocket)
        return () => clearInterval(interval);
    }, [user]);

    const refreshLogs = async () => {
        if (user?.role === UserRole.ADMIN) {
            setAuditLogs(await server.fetchAuditLogs());
        }
    };

    const refreshRemoteLogs = async (deviceId: string) => {
        const logs = await server.fetchDeviceLogs(deviceId);
        setViewLogs(logs);
        setViewLogsDeviceId(deviceId);
    };

    const handleManualRefresh = async () => {
        setIsLoadingServerData(true);
        setLoadingMessage('Refreshing devices & server state...');
        await Promise.all([
            server.fetchAllDevices(),
            server.fetchAllGroups(),
            server.fetchAllLayouts(),
            server.fetchAllCampaigns(),
            server.fetchSavedPlaylists()
        ]);
        setIsLoadingServerData(false);
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoadingServerData(true);
        setLoadingMessage('Authenticating user...');
        try {
            // Manually calling raw login fetch to check for 'requirePasswordChange' flag
            const res = await fetch(`${server.getAdminUrl()}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (data.success) {
                // Set token manually
                server.authToken = data.token;
                server.currentUser = data.user;
                safeStorage.setItem('storecast_token', data.token);
                safeStorage.setItem('storecast_user_info', JSON.stringify(data.user));

                setUser(data.user);

                if (data.requirePasswordChange) {
                    setAuthView('FORCE_CHANGE');
                    setIsLoadingServerData(false);
                } else {
                    setLoginError('');
                    setLoadingMessage('Pulling devices, groups & campaigns...');
                    await Promise.all([
                        server.fetchAllDevices(),
                        server.fetchAllGroups(),
                        server.fetchAllLayouts(),
                        server.fetchAllCampaigns(),
                        server.fetchSavedPlaylists()
                    ]);
                    setIsLoadingServerData(false);
                }
            } else {
                setLoginError(data.message || 'Login failed');
                setIsLoadingServerData(false);
            }
        } catch (e) {
            setLoginError('Connection error');
            setIsLoadingServerData(false);
        }
    };

    const handleForceChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newResetPassword !== confirmResetPassword) {
            setResetMessage('Passwords do not match.');
            return;
        }

        await server.updatePassword(newResetPassword);
        setAuthView('LOGIN'); // Reset view state
        setLoginError('');
        alert("Password changed successfully. Welcome!");
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setResetMessage('Sending recovery code...');
        const success = await server.forgotPassword(email);
        setAuthView('RESET');
        setResetCode(''); // Explicit clear to avoid state retention
        setNewResetPassword('');
        setConfirmResetPassword('');
        setResetMessage('A recovery code has been sent to your email.');
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newResetPassword !== confirmResetPassword) {
            setResetMessage('Passwords do not match.');
            return;
        }

        const res = await server.resetPassword(email, resetCode, newResetPassword);
        if (res.success) {
            alert("Password reset successfully. Please login.");
            setAuthView('LOGIN');
            setPassword('');
            setNewResetPassword('');
            setConfirmResetPassword('');
        } else {
            setResetMessage(res.message || 'Failed to reset.');
        }
    };

    const handleLogout = () => {
        server.logout();
        setUser(null);
    };

    // --- Actions ---

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        const result = await server.registerDevice(pairingCodeInput.toUpperCase(), deviceNameInput);
        if (result.success) {
            setIsRegistering(false);
            setPairingCodeInput('');
            setDeviceNameInput('');
            refreshLogs();
        } else {
            alert(result.message || "Invalid pairing code.");
        }
    };

    const handleEditDeviceSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingDevice) return;
        const result = await server.updateDevice(editingDevice.id, {
            name: editDeviceName,
            rotation: editDeviceRotation
        });
        if (editDeviceCampaign !== (editingDevice.campaignId || '')) {
            await server.setDeviceCampaign(editingDevice.id, editDeviceCampaign || null);
        }
        if (isAdmin && editDeviceOwnerId !== (editingDevice.ownerId || '')) {
            await server.setDeviceOwner(editingDevice.id, editDeviceOwnerId);
        }
        if (result.success) {
            setEditingDevice(null);
            server.fetchAllDevices();
            refreshLogs();
        } else {
            alert(result.message || "Failed to update device");
        }
    };

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!groupNameInput) return;
        const result = await server.createGroup(groupNameInput);
        if (result.success) {
            setIsCreatingGroup(false);
            setGroupNameInput('');
            refreshLogs();
        } else {
            alert(result.message || "Failed to create group");
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        // Only email and role are needed now
        await server.createUser({ email: newUserInput.email, role: newUserInput.role });
        const updated = await server.fetchUsers();
        setUsersList(updated);
        setIsCreatingUser(false);
        setNewUserInput({ email: '', role: UserRole.OWNER });
        refreshLogs();
        alert(`User created. A temporary password has been emailed to ${newUserInput.email}.`);
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        await server.updateUser(editingUser.id, { role: editingUser.role });
        const updated = await server.fetchUsers();
        setUsersList(updated);
        setEditingUser(null);
        refreshLogs();
    };

    const handleDeleteUser = async (id: string) => {
        if (confirm('Delete user?')) {
            await server.deleteUser(id);
            setUsersList(await server.fetchUsers());
            refreshLogs();
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPasswordInput !== confirmPasswordInput) {
            alert('Passwords do not match');
            return;
        }

        await server.updatePassword(newPasswordInput);
        setIsChangingPassword(false);
        setNewPasswordInput('');
        setConfirmPasswordInput('');
        alert("Password updated");
        refreshLogs();
    };

    const toggleOwnerEdit = async () => {
        if (!systemConfig) return;
        const newState = !systemConfig.allowOwnerEdit;
        await server.updateConfig({ allowOwnerEdit: newState });
        setSystemConfig({ ...systemConfig, allowOwnerEdit: newState });
        refreshLogs();
    };

    const handleSaveEmailConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!systemConfig) return;
        const updates = {
            mailHost: configMailHost,
            mailPort: configMailPort,
            mailUser: configMailUser,
            mailPass: configMailPass,
            mailFrom: configMailFrom
        };
        await server.updateConfig(updates);
        setSystemConfig({ ...systemConfig, ...updates });
        refreshLogs();
        alert("Email configuration saved.");
    };

    const handleSaveGoogleConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!systemConfig) return;
        const updates = {
            googleClientId: configGoogleClientId,
            googleClientSecret: configGoogleClientSecret,
            googleRedirectUri: configGoogleRedirectUri
        };
        await server.updateConfig(updates);
        setSystemConfig({ ...systemConfig, ...updates });
        refreshLogs();
        alert("Google OAuth configuration saved.");
    };

    const deleteDevice = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Remove this device?')) {
            server.deleteDevice(id);
            if (activeEntityId === id) setActiveEntityId(null);
            refreshLogs();
        }
    };

    const deleteGroup = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Delete this group?')) {
            server.deleteGroup(id);
            if (activeEntityId === id) setActiveEntityId(null);
            refreshLogs();
        }
    };

    const openEditDevice = (e: React.MouseEvent, dev: Device) => {
        e.stopPropagation();
        setEditingDevice(dev);
        setEditDeviceName(dev.name);
        setEditDeviceRotation(dev.rotation || 0);
        setEditDeviceCampaign(dev.campaignId || '');
        setEditDeviceOwnerId(dev.ownerId || '');
    };

    const handleDevicePlaylistSave = async (assets: Asset[]) => {
        if (activeEntityId) {
            const res = await server.updatePlaylist(activeEntityId, assets);
            if (!res.success) {
                alert("Failed to save playlist: " + (res.message || "Unknown error"));
            }
            refreshLogs();
        }
    };

    const handleGroupPlaylistSave = async (assets: Asset[]) => {
        if (activeEntityId) {
            const res = await server.updateGroupPlaylist(activeEntityId, assets);
            if (!res.success) {
                alert("Failed to save playlist: " + (res.message || "Unknown error"));
            }
            refreshLogs();
        }
    };

    // --- AUTH SCREEN ---
    // If user exists AND requirePasswordChange is true (handled via authView), show that instead of dashboard
    if (!user || authView === 'FORCE_CHANGE') {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="w-full max-w-sm bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl relative">
                    <div className="flex justify-center mb-6"><Logo /></div>

                    {authView === 'LOGIN' && (
                        <form onSubmit={handleLogin} className="animate-fade-in">
                            <h2 className="text-2xl font-bold text-white text-center mb-6">Store Cast Admin</h2>
                            {loginError && <div className="bg-red-500/10 text-red-500 text-sm p-3 rounded mb-4 text-center">{loginError}</div>}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-slate-400 text-xs uppercase font-bold mb-1">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-3 text-slate-500" size={16} />
                                        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded p-3 pl-10 text-white focus:border-blue-500 outline-none" autoComplete="username" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-slate-400 text-xs uppercase font-bold mb-1">Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 text-slate-500" size={16} />
                                        <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded p-3 pl-10 text-white focus:border-blue-500 outline-none" autoComplete="current-password" />
                                    </div>
                                </div>
                                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors">Sign In</button>

                                <div className="relative my-3 flex items-center justify-center">
                                    <div className="border-t border-slate-800 w-full"></div>
                                    <span className="bg-slate-900 px-3 text-[11px] text-slate-500 uppercase font-semibold">or</span>
                                    <div className="border-t border-slate-800 w-full"></div>
                                </div>

                                <a
                                    href="/auth/google"
                                    className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-800 font-medium py-2.5 px-4 rounded-lg transition-all shadow-sm active:scale-[0.99] cursor-pointer"
                                >
                                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                    </svg>
                                    <span className="text-sm font-semibold">Sign in with Google</span>
                                </a>

                                <div className="text-center pt-2">
                                    <button type="button" onClick={() => setAuthView('FORGOT')} className="text-sm text-slate-500 hover:text-blue-400">Forgot Password?</button>
                                </div>
                            </div>
                        </form>
                    )}

                    {authView === 'FORCE_CHANGE' && (
                        <form onSubmit={handleForceChangePassword} className="animate-fade-in" autoComplete="off">
                            <h2 className="text-xl font-bold text-white text-center mb-2">Change Password</h2>
                            <p className="text-slate-400 text-sm text-center mb-6">You must change your temporary password to proceed.</p>
                            {resetMessage && <div className="bg-red-500/10 text-red-400 text-xs p-3 rounded mb-4 text-center">{resetMessage}</div>}

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-slate-400 text-xs uppercase font-bold mb-1">New Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 text-slate-500" size={16} />
                                        <input type="password" required value={newResetPassword} onChange={e => setNewResetPassword(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded p-3 pl-10 text-white focus:border-blue-500 outline-none" autoComplete="new-password" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-slate-400 text-xs uppercase font-bold mb-1">Confirm New Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 text-slate-500" size={16} />
                                        <input type="password" required value={confirmResetPassword} onChange={e => setConfirmResetPassword(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded p-3 pl-10 text-white focus:border-blue-500 outline-none" autoComplete="new-password" />
                                    </div>
                                </div>
                                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                                    Set Password
                                </button>
                            </div>
                        </form>
                    )}

                    {authView === 'FORGOT' && (
                        <form onSubmit={handleForgotPassword} className="animate-fade-in" autoComplete="off">
                            <h2 className="text-xl font-bold text-white text-center mb-2">Recover Account</h2>
                            <p className="text-slate-400 text-sm text-center mb-6">Enter your email to receive a recovery code.</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-slate-400 text-xs uppercase font-bold mb-1">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-3 text-slate-500" size={16} />
                                        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded p-3 pl-10 text-white focus:border-blue-500 outline-none" autoComplete="email" />
                                    </div>
                                </div>
                                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                                    <Send size={16} /> Send Code
                                </button>
                                <div className="text-center pt-2">
                                    <button type="button" onClick={() => setAuthView('LOGIN')} className="text-sm text-slate-500 hover:text-white">Back to Login</button>
                                </div>
                            </div>
                        </form>
                    )}

                    {authView === 'RESET' && (
                        <form onSubmit={handleResetPassword} className="animate-fade-in" autoComplete="off">
                            <h2 className="text-xl font-bold text-white text-center mb-2">Reset Password</h2>
                            {resetMessage && <div className={`text-xs p-3 rounded mb-4 text-center ${resetMessage.includes('match') ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>{resetMessage}</div>}

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-slate-400 text-xs uppercase font-bold mb-1">Recovery Code</label>
                                    <input type="text" placeholder="6-digit code" required value={resetCode} onChange={e => setResetCode(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white focus:border-blue-500 outline-none text-center tracking-widest font-mono text-lg" autoComplete="one-time-code" />
                                </div>
                                <div>
                                    <label className="block text-slate-400 text-xs uppercase font-bold mb-1">New Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 text-slate-500" size={16} />
                                        <input type="password" required value={newResetPassword} onChange={e => setNewResetPassword(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded p-3 pl-10 text-white focus:border-blue-500 outline-none" autoComplete="new-password" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-slate-400 text-xs uppercase font-bold mb-1">Confirm New Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 text-slate-500" size={16} />
                                        <input type="password" required value={confirmResetPassword} onChange={e => setConfirmResetPassword(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded p-3 pl-10 text-white focus:border-blue-500 outline-none" autoComplete="new-password" />
                                    </div>
                                </div>
                                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                                    <RefreshCcw size={16} /> Reset Password
                                </button>
                                <div className="text-center pt-2">
                                    <button type="button" onClick={() => setAuthView('LOGIN')} className="text-sm text-slate-500 hover:text-white">Back to Login</button>
                                </div>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        );
    }

    // --- RENDER CONTENT EDITOR ---
    if (activeEntityId || editCampaignZone) {
        if (editCampaignZone) {
            const campaign = server.getAllCampaigns().find(c => c.id === editCampaignZone.campaignId);
            return (
                <ContentEditor
                    title={campaign?.name || 'Campaign'}
                    subTitle={`Editing Zone ${editCampaignZone.zoneId}`}
                    initialAssets={editCampaignZone.initialAssets}
                    onSave={(assets) => {
                        if (campaign) {
                            server.updateCampaign(campaign.id, { zonePlaylists: { ...campaign.zonePlaylists, [editCampaignZone.zoneId]: assets } }).then(() => {
                                server.fetchAllCampaigns();
                            });
                        }
                    }}
                    onSaveOverlay={() => {}} // Campaigns don't have overlays yet
                    onBack={() => { setEditCampaignZone(null); refreshLogs(); }}
                />
            );
        }

        const isDevice = activeTab === 'DEVICES';
        const entity = isDevice ? devices.find(d => d.id === activeEntityId) : groups.find(g => g.id === activeEntityId);

        if (entity) {
            // Check Permissions
            const isAdmin = user.role === UserRole.ADMIN;
            const isOwner = (isDevice ? (entity as Device).ownerId : (entity as any).ownerId) === user.id;
            // Default allowOwnerEdit to true if systemConfig hasn't loaded yet
            const canEdit = isAdmin || (isOwner && (systemConfig?.allowOwnerEdit ?? true));

            return (
                <ContentEditor
                    title={entity.name}
                    subTitle={isDevice ? "Device Playlist" : "Group Playlist"}
                    initialAssets={entity.playlist}
                    initialOverlay={(entity as any).overlay} // Device or Group overlay
                    initialOverlayX={(entity as any).overlayX}
                    initialOverlayY={(entity as any).overlayY}
                    initialOverlayW={(entity as any).overlayW}
                    initialOverlayH={(entity as any).overlayH}
                    onSave={(assets) => isDevice ? handleDevicePlaylistSave(assets) : handleGroupPlaylistSave(assets)}
                    onSaveOverlay={(overlay, x, y, w, h) => {
                        const payload: any = { overlay };
                        if (x !== undefined) payload.overlayX = x;
                        if (y !== undefined) payload.overlayY = y;
                        if (w !== undefined) payload.overlayW = w;
                        if (h !== undefined) payload.overlayH = h;

                        if (isDevice) {
                            server.updateDevice((entity as Device).id, payload);
                        } else {
                            server.updateGroup((entity as any).id, payload);
                        }
                        // Refresh to show updates
                        setTimeout(() => {
                            isDevice ? server.fetchAllDevices() : server.fetchAllGroups();
                        }, 100);
                    }}
                    onBack={() => { setActiveEntityId(null); refreshLogs(); }}
                    readOnly={!canEdit || (isDevice && !!(entity as Device).groupId)}
                />
            );
        }
    }

    // --- DASHBOARD ---
    const isAdmin = user.role === UserRole.ADMIN;

    // Filter Utilities
    const lowerFilter = filterQuery.toLowerCase();

    // Filter and Sort devices
    const filteredDevices = devices.filter(d =>
        d.isRegistered &&
        (d.name.toLowerCase().includes(lowerFilter) || d.id.toLowerCase().includes(lowerFilter) || (d.resolution && d.resolution.toLowerCase().includes(lowerFilter)))
    ).sort((a, b) => {
        let cmp = 0;
        if (deviceSortField === 'name') {
            cmp = a.name.localeCompare(b.name);
        } else if (deviceSortField === 'status') {
            const aOnline = (Date.now() - (a.lastSeen || 0)) < 70000 ? 1 : 0;
            const bOnline = (Date.now() - (b.lastSeen || 0)) < 70000 ? 1 : 0;
            cmp = bOnline - aOnline;
        } else if (deviceSortField === 'group') {
            const aGrp = groups.find(g => g.id === a.groupId)?.name || '';
            const bGrp = groups.find(g => g.id === b.groupId)?.name || '';
            cmp = aGrp.localeCompare(bGrp);
        } else if (deviceSortField === 'rotation') {
            cmp = (a.rotation || 0) - (b.rotation || 0);
        } else if (deviceSortField === 'lastSeen') {
            cmp = (b.lastSeen || 0) - (a.lastSeen || 0);
        }
        return deviceSortOrder === 'asc' ? cmp : -cmp;
    });

    const pendingDevices = devices.filter(d => 
        !d.isRegistered && 
        (Date.now() - (d.lastSeen || 0) < 70000) &&
        (d.id.toLowerCase().includes(lowerFilter) || (d.pairingCode && d.pairingCode.toLowerCase().includes(lowerFilter)))
    ).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));

    // Filter groups by name OR owner email OR owner ID (if admin), then Sort Alphabetically
    const filteredGroups = groups.filter(g => {
        if (g.name.toLowerCase().includes(lowerFilter)) return true;
        if (isAdmin) {
            // Search by Owner ID
            if (g.ownerId && g.ownerId.toLowerCase().includes(lowerFilter)) return true;

            // Search by Owner Email
            const owner = usersList.find(u => u.id === g.ownerId);
            return owner?.email.toLowerCase().includes(lowerFilter);
        }
        return false;
    }).sort((a, b) => a.name.localeCompare(b.name));

    const filteredUsers = usersList.filter(u => u.email.toLowerCase().includes(lowerFilter));

    // Safe filter for audit logs ensuring fields exist
    const filteredAuditLogs = auditLogs
        .filter(log =>
            (log.userEmail || '').toLowerCase().includes(lowerFilter) ||
            (log.action || '').toLowerCase().includes(lowerFilter) ||
            (log.details || '').toLowerCase().includes(lowerFilter)
        )
        .sort((a, b) => b.timestamp - a.timestamp); // Ensure sorted by timestamp descending

    // Settings Filter
    const matchesSearch = (text: string) => text.toLowerCase().includes(lowerFilter);
    const showOwnerSetting = !filterQuery || matchesSearch("Owner Editing Permissions") || matchesSearch("Access Controls") || matchesSearch("device owners can only view");
    const showEmailSetting = !filterQuery || matchesSearch("Email Configuration") || matchesSearch("SMTP") || matchesSearch("Gmail");
    const showGoogleSetting = !filterQuery || matchesSearch("Google") || matchesSearch("OAuth") || matchesSearch("Client ID") || matchesSearch("SSO");

    const getPageInfo = () => {
        switch (activeTab) {
            case 'DEVICES':
                return { section: 'Display Network', title: 'Screens', icon: <Monitor size={20} className="text-blue-400" /> };
            case 'GROUPS':
                return { section: 'Display Network', title: 'Screen Groups', icon: <Layers size={20} className="text-emerald-400" /> };
            case 'CAMPAIGNS':
                return { section: 'Display Network', title: 'Campaigns', icon: <Flag size={20} className="text-amber-400" /> };
            case 'LAYOUTS':
                return { section: 'Content Library', title: 'Screen Layouts', icon: <Layout size={20} className="text-purple-400" /> };
            case 'PLAYLISTS':
                return { section: 'Content Library', title: 'Playlists', icon: <List size={20} className="text-indigo-400" /> };
            case 'SETTINGS':
                return { section: 'Administration', title: 'System Settings', icon: <SettingsIcon size={20} className="text-slate-400" /> };
            case 'USERS':
                return { section: 'Administration', title: 'User Management', icon: <Users size={20} className="text-blue-400" /> };
            case 'AUDIT':
                return { section: 'Administration', title: 'Audit Logs', icon: <FileText size={20} className="text-teal-400" /> };
            default:
                return { section: 'Dashboard', title: 'Overview', icon: <Monitor size={20} className="text-blue-400" /> };
        }
    };

    const pageInfo = getPageInfo();

    return (
        <div className="h-screen bg-slate-900 flex overflow-hidden text-slate-100 relative">
            {isLoadingServerData && (
                <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white animate-fade-in">
                    <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full text-center space-y-5 animate-in zoom-in-95 duration-200">
                        <div className="relative flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
                            <Logo />
                        </div>
                        <div className="space-y-1.5">
                            <h3 className="text-xl font-bold text-white tracking-tight">Store Cast Server</h3>
                            <p className="text-sm text-slate-400 font-medium">{loadingMessage}</p>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-400 animate-pulse w-full h-full rounded-full" />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono pt-1">
                            <Loader2 size={14} className="animate-spin text-blue-500" />
                            <span>Synchronizing server data...</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Backdrop */}
            {isMobileSidebarOpen && (
                <div 
                    onClick={() => setIsMobileSidebarOpen(false)}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
                />
            )}

            {/* LEFT SIDEBAR */}
            <aside className={`
                fixed lg:static inset-y-0 left-0 z-50
                w-64 bg-slate-950 border-r border-slate-800/80
                flex flex-col justify-between shrink-0 h-full select-none
                transition-transform duration-200 ease-in-out
                ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                {/* Brand Header */}
                <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="shrink-0"><Logo /></div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <h1 className="text-lg font-bold tracking-tight text-white">Store Cast</h1>
                                <span className="text-[9px] font-bold text-blue-400 bg-blue-950/80 px-1.5 py-0.2 rounded border border-blue-500/30">v2.0</span>
                            </div>
                            <p className="text-[10px] text-slate-500">Digital Signage OS</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setIsMobileSidebarOpen(false)} 
                        className="lg:hidden p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-900"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Navigation Links */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                    {/* SECTION 1: DISPLAY NETWORK */}
                    <div className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-2">
                            Display Network
                        </div>
                        
                        {/* Devices / Screens */}
                        <button
                            onClick={() => { setActiveTab('DEVICES'); setActiveCampaignId(null); setIsMobileSidebarOpen(false); }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                                activeTab === 'DEVICES' 
                                    ? 'bg-blue-600/20 text-blue-400 font-bold border border-blue-500/30 shadow-inner' 
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                            }`}
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <Monitor size={16} className={activeTab === 'DEVICES' ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'} />
                                <span className="truncate">Screens</span>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${activeTab === 'DEVICES' ? 'bg-blue-500/20 text-blue-300 font-bold' : 'bg-slate-800 text-slate-500'}`}>
                                {filteredDevices.length}
                            </span>
                        </button>

                        {/* Groups */}
                        <button
                            onClick={() => { setActiveTab('GROUPS'); setActiveCampaignId(null); setIsMobileSidebarOpen(false); }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                                activeTab === 'GROUPS' 
                                    ? 'bg-emerald-600/20 text-emerald-400 font-bold border border-emerald-500/30 shadow-inner' 
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                            }`}
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <Layers size={16} className={activeTab === 'GROUPS' ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'} />
                                <span className="truncate">Groups</span>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${activeTab === 'GROUPS' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'bg-slate-800 text-slate-500'}`}>
                                {filteredGroups.length}
                            </span>
                        </button>

                        {/* Campaigns */}
                        {isAdmin && (
                            <button
                                onClick={() => { setActiveTab('CAMPAIGNS'); setActiveCampaignId(null); setIsMobileSidebarOpen(false); }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                                    activeTab === 'CAMPAIGNS' 
                                        ? 'bg-amber-600/20 text-amber-400 font-bold border border-amber-500/30 shadow-inner' 
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                                }`}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <Flag size={16} className={activeTab === 'CAMPAIGNS' ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-300'} />
                                    <span className="truncate">Campaigns</span>
                                </div>
                            </button>
                        )}
                    </div>

                    {/* SECTION 2: CONTENT LIBRARY (SUBMENU) */}
                    {isAdmin && (
                        <div className="space-y-1">
                            <button
                                onClick={() => setIsContentMenuOpen(!isContentMenuOpen)}
                                className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
                            >
                                <div className="flex items-center gap-1.5">
                                    <Folder size={12} className="text-purple-400" />
                                    <span>Content Library</span>
                                </div>
                                {isContentMenuOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>

                            {isContentMenuOpen && (
                                <div className="space-y-1 pl-2 border-l border-slate-800/80 ml-3 animate-in slide-in-from-top-1 duration-150">
                                    {/* Layouts */}
                                    <button
                                        onClick={() => { setActiveTab('LAYOUTS'); setActiveCampaignId(null); setIsMobileSidebarOpen(false); }}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${
                                            activeTab === 'LAYOUTS' 
                                                ? 'bg-purple-600/20 text-purple-300 font-semibold border-l-2 border-purple-500' 
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Layout size={14} className={activeTab === 'LAYOUTS' ? 'text-purple-400' : 'text-slate-500'} />
                                            <span className="truncate">Layouts</span>
                                        </div>
                                    </button>

                                    {/* Playlists */}
                                    <button
                                        onClick={() => { setActiveTab('PLAYLISTS'); setActiveCampaignId(null); setIsMobileSidebarOpen(false); }}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${
                                            activeTab === 'PLAYLISTS' 
                                                ? 'bg-indigo-600/20 text-indigo-300 font-semibold border-l-2 border-indigo-500' 
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <List size={14} className={activeTab === 'PLAYLISTS' ? 'text-indigo-400' : 'text-slate-500'} />
                                            <span className="truncate">Playlists</span>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* SECTION 3: ADMINISTRATION & SETTINGS (SUBMENU) */}
                    {isAdmin && (
                        <div className="space-y-1">
                            <button
                                onClick={() => setIsSettingsMenuOpen(!isSettingsMenuOpen)}
                                className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
                            >
                                <div className="flex items-center gap-1.5">
                                    <SettingsIcon size={12} className="text-slate-400" />
                                    <span>Settings & Admin</span>
                                </div>
                                {isSettingsMenuOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>

                            {isSettingsMenuOpen && (
                                <div className="space-y-1 pl-2 border-l border-slate-800/80 ml-3 animate-in slide-in-from-top-1 duration-150">
                                    {/* General Settings */}
                                    <button
                                        onClick={() => { setActiveTab('SETTINGS'); setActiveCampaignId(null); setIsMobileSidebarOpen(false); }}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${
                                            activeTab === 'SETTINGS' 
                                                ? 'bg-slate-700/60 text-white font-semibold border-l-2 border-blue-400' 
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <SettingsIcon size={14} className={activeTab === 'SETTINGS' ? 'text-white' : 'text-slate-500'} />
                                            <span className="truncate">General Settings</span>
                                        </div>
                                    </button>

                                    {/* Users */}
                                    <button
                                        onClick={() => { setActiveTab('USERS'); setActiveCampaignId(null); setIsMobileSidebarOpen(false); }}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${
                                            activeTab === 'USERS' 
                                                ? 'bg-blue-600/20 text-blue-300 font-semibold border-l-2 border-blue-500' 
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Users size={14} className={activeTab === 'USERS' ? 'text-blue-400' : 'text-slate-500'} />
                                            <span className="truncate">Users</span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-mono">{usersList.length}</span>
                                    </button>

                                    {/* Audit Logs */}
                                    <button
                                        onClick={() => { setActiveTab('AUDIT'); setActiveCampaignId(null); setIsMobileSidebarOpen(false); }}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${
                                            activeTab === 'AUDIT' 
                                                ? 'bg-teal-600/20 text-teal-300 font-semibold border-l-2 border-teal-500' 
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <FileText size={14} className={activeTab === 'AUDIT' ? 'text-teal-400' : 'text-slate-500'} />
                                            <span className="truncate">Audit Log</span>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Sidebar Footer: User profile & quick actions */}
                <div className="p-4 border-t border-slate-800/80 bg-slate-950/60">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${isAdmin ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                                    {user.role}
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 truncate font-medium mt-1" title={user.email}>{user.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button 
                            onClick={() => setIsChangingPassword(true)} 
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs text-slate-300 hover:text-white transition-colors"
                            title="Change Password"
                        >
                            <Key size={13} /> <span>Password</span>
                        </button>
                        <button 
                            onClick={handleLogout} 
                            className="p-2 bg-slate-900 hover:bg-red-950/80 border border-slate-800 hover:border-red-500/40 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                            title="Sign Out"
                        >
                            <LogOut size={14} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                {/* Top Header */}
                <header className="flex-none bg-slate-900/90 border-b border-slate-800/80 z-10 px-6 py-3.5 flex items-center justify-between gap-4 backdrop-blur">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setIsMobileSidebarOpen(true)}
                            className="lg:hidden p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white"
                            title="Open Menu"
                        >
                            <Menu size={18} />
                        </button>
                        
                        <div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                <span>{pageInfo.section}</span>
                                <span>/</span>
                                <span className="text-slate-300 font-semibold">{pageInfo.title}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input 
                                type="text" 
                                placeholder="Search screens, groups, logs..." 
                                value={filterQuery} 
                                onChange={e => setFilterQuery(e.target.value)} 
                                className="w-48 sm:w-64 md:w-80 bg-slate-800/80 border border-slate-700/80 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white focus:border-blue-500 outline-none transition-colors" 
                            />
                        </div>
                    </div>
                </header>

                {/* Scrollable Body */}
                <main className={`flex-1 p-4 md:p-6 lg:p-8 flex flex-col min-h-0 ${activeTab === 'AUDIT' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
                    <div className={`max-w-7xl mx-auto w-full ${activeTab === 'AUDIT' ? 'flex flex-col flex-1 min-h-0' : 'pb-16'}`}>

                    {/* DEVICES TAB */}
                    {activeTab === 'DEVICES' && (
                        <div className="animate-fade-in space-y-6">
                            {/* Top Toolbar */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800/60 p-4 rounded-xl border border-slate-700/80">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <Monitor size={20} className="text-blue-400" /> Screens ({filteredDevices.length})
                                    </h2>
                                    <div className="flex items-center gap-1.5 text-xs font-mono">
                                        <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-bold">
                                            {filteredDevices.filter(d => (Date.now() - (d.lastSeen || 0)) < 70000).length} Live
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400 border border-slate-600/40">
                                            {filteredDevices.filter(d => (Date.now() - (d.lastSeen || 0)) >= 70000).length} Offline
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                                    {/* View Mode Toggle: List vs Cards */}
                                    <div className="flex items-center bg-slate-900/90 p-1 rounded-lg border border-slate-700">
                                        <button
                                            onClick={() => handleSetDeviceViewMode('list')}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${deviceViewMode === 'list' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                            title="Data Table / List View"
                                        >
                                            <List size={14} /> <span>List</span>
                                        </button>
                                        <button
                                            onClick={() => handleSetDeviceViewMode('grid')}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${deviceViewMode === 'grid' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                            title="Visual Card Grid View"
                                        >
                                            <LayoutGrid size={14} /> <span>Cards</span>
                                        </button>
                                    </div>

                                    <button 
                                        onClick={handleManualRefresh} 
                                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3.5 py-2 rounded-lg font-medium text-xs transition-colors text-slate-300 hover:text-white"
                                        title="Sync & Refresh Dashboard Data"
                                    >
                                        <RefreshCcw size={14} /> <span className="hidden md:inline">Refresh</span>
                                    </button>
                                    
                                    <button onClick={() => { setPairingCodeInput(''); setDeviceNameInput(''); setIsRegistering(true); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-medium text-xs transition-colors shadow-lg hover:shadow-blue-500/20 text-white">
                                        <Plus size={14} /> <span>Register Screen</span>
                                    </button>
                                </div>
                            </div>

                            {/* PENDING REGISTRATION SECTION */}
                            {isAdmin && pendingDevices.length > 0 && (
                                <div className="bg-slate-800/40 border border-blue-500/20 rounded-xl p-5">
                                    <h3 className="text-blue-400 font-bold mb-3 flex items-center gap-2 text-sm">
                                        <Monitor size={16} /> Pending Registration ({pendingDevices.length})
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {pendingDevices.map(device => {
                                            const isOnline = (Date.now() - (device.lastSeen || 0)) < 70000;
                                            return (
                                                <div key={device.id} className="bg-slate-800 p-3.5 rounded-lg border border-slate-700 flex justify-between items-center hover:border-blue-500/50 transition-colors">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className="font-mono text-xs text-white font-bold">{device.id}</span>
                                                            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} title={isOnline ? 'Online' : 'Offline'} />
                                                        </div>
                                                        <div className="text-[11px] text-slate-400 font-mono">Code: <span className="text-blue-400 font-bold">{device.pairingCode}</span></div>
                                                    </div>
                                                    <button 
                                                        onClick={() => {
                                                             setPairingCodeInput(device.pairingCode);
                                                             setDeviceNameInput(`Display-${device.id.substring(0, 4)}`);
                                                             setIsRegistering(true);
                                                        }}
                                                        className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-500 text-blue-400 hover:text-white rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors border border-blue-500/20 hover:border-transparent"
                                                    >
                                                        Register
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Bulk Action Toolbar */}
                            {selectedDeviceIds.length > 0 && (
                                <div className="bg-blue-950/80 border border-blue-500/40 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs animate-in slide-in-from-top-2">
                                    <div className="flex items-center gap-2 text-blue-200 font-medium">
                                        <span className="bg-blue-600 text-white font-bold px-2 py-0.5 rounded font-mono">{selectedDeviceIds.length}</span>
                                        <span>Screens Selected</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <button
                                            onClick={handleBulkReload}
                                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium flex items-center gap-1.5 transition-colors shadow"
                                        >
                                            <RefreshCcw size={12} /> Reload All Selected
                                        </button>
                                        <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-700">
                                            <span className="text-slate-400 text-[11px]">Move to Group:</span>
                                            <select
                                                onChange={(e) => { if (e.target.value !== '__noop__') handleBulkSetGroup(e.target.value); }}
                                                defaultValue="__noop__"
                                                className="bg-transparent text-slate-200 outline-none text-xs cursor-pointer"
                                            >
                                                <option value="__noop__" disabled>Select Group...</option>
                                                <option value="">No Group</option>
                                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                            </select>
                                        </div>
                                        {isAdmin && (
                                            <button
                                                onClick={handleBulkDelete}
                                                className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg font-medium flex items-center gap-1.5 transition-colors shadow"
                                            >
                                                <Trash2 size={12} /> Delete Selected
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setSelectedDeviceIds([])}
                                            className="px-2.5 py-1.5 text-slate-400 hover:text-white transition-colors"
                                        >
                                            ✕ Deselect
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* 1. DATA TABLE / LIST VIEW */}
                            {deviceViewMode === 'list' && (
                                <div className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse min-w-[950px]">
                                            <thead>
                                                <tr className="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700/80 select-none">
                                                    <th className="py-3.5 px-4 w-12 text-center">
                                                        <button 
                                                            onClick={() => toggleSelectAllDevices(filteredDevices)}
                                                            className="text-slate-400 hover:text-white"
                                                            title={selectedDeviceIds.length === filteredDevices.length ? "Deselect All" : "Select All"}
                                                        >
                                                            {selectedDeviceIds.length > 0 && selectedDeviceIds.length === filteredDevices.length ? (
                                                                <CheckSquare size={18} className="text-blue-400" />
                                                            ) : (
                                                                <Square size={18} />
                                                            )}
                                                        </button>
                                                    </th>
                                                    <th className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors w-28" onClick={() => handleDeviceSort('status')}>
                                                        <div className="flex items-center gap-1.5">
                                                            <span>Status</span>
                                                            <ArrowUpDown size={13} className={deviceSortField === 'status' ? 'text-blue-400' : 'opacity-40'} />
                                                        </div>
                                                    </th>
                                                    <th className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors min-w-[240px]" onClick={() => handleDeviceSort('name')}>
                                                        <div className="flex items-center gap-1.5">
                                                            <span>Screen Name & Info</span>
                                                            <ArrowUpDown size={13} className={deviceSortField === 'name' ? 'text-blue-400' : 'opacity-40'} />
                                                        </div>
                                                    </th>
                                                    <th className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors w-56 whitespace-nowrap" onClick={() => handleDeviceSort('rotation')}>
                                                        <div className="flex items-center gap-1.5">
                                                            <span>Orientation & Angle</span>
                                                            <ArrowUpDown size={13} className={deviceSortField === 'rotation' ? 'text-blue-400' : 'opacity-40'} />
                                                        </div>
                                                    </th>
                                                    <th className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors w-44" onClick={() => handleDeviceSort('group')}>
                                                        <div className="flex items-center gap-1.5">
                                                            <span>Group</span>
                                                            <ArrowUpDown size={13} className={deviceSortField === 'group' ? 'text-blue-400' : 'opacity-40'} />
                                                        </div>
                                                    </th>
                                                    <th className="py-3.5 px-4 w-52">Active Campaign</th>
                                                    <th className="py-3.5 px-4 text-right w-44">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-700/60 text-sm">
                                                {filteredDevices.map(device => {
                                                    const { text: statusText, isOnline, fullDate } = formatLastSeen(device.lastSeen);
                                                    const rotBadge = getOrientationBadge(device.rotation || 0);
                                                    const isSelected = selectedDeviceIds.includes(device.id);

                                                    return (
                                                        <tr 
                                                            key={device.id} 
                                                            className={`hover:bg-slate-700/40 transition-colors group ${isSelected ? 'bg-blue-950/30' : ''}`}
                                                        >
                                                            {/* Checkbox */}
                                                            <td className="py-3.5 px-4 text-center">
                                                                <button 
                                                                    onClick={() => toggleSelectDevice(device.id)}
                                                                    className="text-slate-400 hover:text-white"
                                                                >
                                                                    {isSelected ? (
                                                                        <CheckSquare size={18} className="text-blue-400" />
                                                                    ) : (
                                                                        <Square size={18} />
                                                                    )}
                                                                </button>
                                                            </td>

                                                            {/* Status */}
                                                            <td className="py-3.5 px-3">
                                                                <div className="flex items-center gap-2" title={`Last contact: ${fullDate}`}>
                                                                    <span className="relative flex h-2.5 w-2.5">
                                                                        {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                                                                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                                    </span>
                                                                    <span className={`text-xs font-semibold ${isOnline ? 'text-green-400' : 'text-slate-400'}`}>
                                                                        {statusText}
                                                                    </span>
                                                                </div>
                                                            </td>

                                                            {/* Screen Name & ID */}
                                                            <td className="py-3.5 px-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20 shrink-0">
                                                                        <Tv size={20} style={{ transform: `rotate(${device.rotation || 0}deg)` }} />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="font-bold text-white text-sm flex items-center gap-2 truncate" title={device.name}>
                                                                            <span>{device.name}</span>
                                                                            <button onClick={(e) => openEditDevice(e, device)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-400 transition-opacity" title="Edit Screen Settings">
                                                                                <Edit2 size={13} />
                                                                            </button>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                                                                            <span>ID: <strong className="text-slate-300 font-medium">{device.id}</strong></span>
                                                                            <span className="text-slate-600">•</span>
                                                                            <span>PIN: <strong className="text-blue-400 font-semibold">{device.pairingCode}</strong></span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            {/* Orientation & Angle Badge */}
                                                            <td className="py-3.5 px-4">
                                                                <div className="flex items-center gap-2">
                                                                    <div
                                                                        className={`inline-flex items-center justify-between w-36 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold shadow-sm select-none ${rotBadge.bg}`}
                                                                        title={`Orientation: ${rotBadge.label} (${device.rotation || 0}°)`}
                                                                    >
                                                                        <div className="flex items-center gap-1.5">
                                                                            <RotateCw size={13} className="shrink-0 opacity-70" style={{ transform: `rotate(${device.rotation || 0}deg)` }} />
                                                                            <span className="w-8 text-left">{rotBadge.angle}</span>
                                                                        </div>
                                                                        <span className="text-[10px] font-sans font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/30">
                                                                            {rotBadge.label}
                                                                        </span>
                                                                    </div>

                                                                    {device.resolution && (
                                                                        <span className="text-xs font-mono px-2 py-1 rounded-md bg-slate-900 border border-slate-700 text-cyan-400 shrink-0 font-medium" title="Detected Screen Resolution">
                                                                            {device.resolution}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            {/* Group Dropdown */}
                                                            <td className="py-3.5 px-4">
                                                                <select
                                                                    value={device.groupId || ''}
                                                                    onChange={(e) => server.setDeviceGroup(device.id, e.target.value || null)}
                                                                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:border-blue-500 outline-none w-full truncate cursor-pointer hover:border-slate-500 transition-colors"
                                                                >
                                                                    <option value="">No Group</option>
                                                                    {device.groupId && !groups.find(g => g.id === device.groupId) && (
                                                                        <option value={device.groupId} className="text-amber-400 bg-slate-800">Set by Admin</option>
                                                                    )}
                                                                    {groups.sort((a, b) => a.name.localeCompare(b.name)).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                                                </select>
                                                            </td>

                                                            {/* Active Campaign Dropdown */}
                                                            <td className="py-3.5 px-4">
                                                                <select
                                                                    value={device.campaignId || ''}
                                                                    onChange={(e) => server.setDeviceCampaign(device.id, e.target.value || null)}
                                                                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-blue-400 focus:border-blue-500 outline-none w-full truncate cursor-pointer hover:border-slate-500 transition-colors"
                                                                >
                                                                    <option value="">Default (Group/Playlist)</option>
                                                                    {server.getAllCampaigns().map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                                </select>
                                                            </td>

                                                            {/* Actions */}
                                                            <td className="py-3.5 px-4 text-right">
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    <button 
                                                                        onClick={(e) => { 
                                                                            e.stopPropagation(); 
                                                                            setPreviewDevice(device); 
                                                                            if (device.resolution?.includes('2160') || device.resolution?.includes('4K')) setPreviewResolution('4K');
                                                                            else if (device.resolution?.includes('720')) setPreviewResolution('720p');
                                                                            else setPreviewResolution('1080p');
                                                                            setPreviewRotation(device.rotation || 0);
                                                                        }} 
                                                                        className="p-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg transition-colors" 
                                                                        title="Live Preview"
                                                                    >
                                                                        <Tv size={15} />
                                                                    </button>
                                                                    <button 
                                                                        onClick={async (e) => { 
                                                                            e.stopPropagation(); 
                                                                            const res = await server.refreshDevice(device.id);
                                                                            if (res.success) alert(`Remote reload signal sent to screen "${device.name}"!`);
                                                                            else alert("Failed to send refresh signal: " + (res.message || "Unknown error"));
                                                                        }} 
                                                                        className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg transition-colors" 
                                                                        title="Remote Reload Screen"
                                                                    >
                                                                        <RefreshCcw size={15} />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => setActiveEntityId(device.id)}
                                                                        className="p-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                                                                        title="Edit Fallback Playlist"
                                                                    >
                                                                        <List size={15} />
                                                                    </button>
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); refreshRemoteLogs(device.id); }} 
                                                                        className="p-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors" 
                                                                        title="Remote Logs"
                                                                    >
                                                                        <FileText size={15} />
                                                                    </button>
                                                                    <button 
                                                                        onClick={(e) => openEditDevice(e, device)} 
                                                                        className="p-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors" 
                                                                        title="Screen Settings (Rotation, Owner, Name)"
                                                                    >
                                                                        <SettingsIcon size={15} />
                                                                    </button>
                                                                    <button 
                                                                        onClick={(e) => deleteDevice(e, device.id)} 
                                                                        className="p-1.5 bg-slate-700/60 hover:bg-red-900/60 text-slate-400 hover:text-red-300 rounded-lg transition-colors" 
                                                                        title="Delete Screen"
                                                                    >
                                                                        <Trash2 size={15} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {filteredDevices.length === 0 && (
                                                    <tr>
                                                        <td colSpan={7} className="py-12 text-center text-slate-500">
                                                            <Monitor size={40} className="mx-auto mb-2 opacity-20" />
                                                            <p>No screens match your search or filter.</p>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* 2. CARD GRID VIEW */}
                            {deviceViewMode === 'grid' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {filteredDevices.map(device => {
                                        const isOnline = (Date.now() - (device.lastSeen || 0)) < 70000;
                                        const rotBadge = getOrientationBadge(device.rotation || 0);

                                        return (
                                            <div key={device.id} className="bg-slate-800 p-5 rounded-2xl border border-slate-700 hover:border-blue-500/50 transition-all hover:shadow-2xl relative group flex flex-col h-full">
                                                {/* Header: Icon + Name + Status */}
                                                <div className="flex justify-between items-start mb-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20 shadow-inner">
                                                            <Tv size={24} style={{ transform: `rotate(${device.rotation || 0}deg)` }} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h3 className="font-bold text-white truncate leading-tight mb-1" title={device.name}>{device.name}</h3>
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${isOnline ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                                    {isOnline ? 'Online' : 'Offline'}
                                                                </span>
                                                                <span className="text-[10px] text-slate-500 font-mono">ID: {device.id}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                                        <div
                                                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold select-none ${rotBadge.bg}`}
                                                            title={`Orientation: ${rotBadge.label} (${device.rotation || 0}°)`}
                                                        >
                                                            <RotateCw size={11} className="opacity-70" style={{ transform: `rotate(${device.rotation || 0}deg)` }} />
                                                            <span>{rotBadge.angle}</span>
                                                            <span className="text-[9px] uppercase font-sans tracking-tight opacity-80">({rotBadge.label})</span>
                                                        </div>
                                                        {device.resolution && (
                                                            <span className="text-[9px] text-cyan-400 font-mono bg-cyan-950/70 px-1.5 py-0.5 rounded border border-cyan-500/30 font-medium" title="Screen Hardware Resolution">
                                                                {device.resolution}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Configuration Section */}
                                                <div className="space-y-3 mb-6 flex-1">
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Device Group</label>
                                                        <select
                                                            value={device.groupId || ''}
                                                            onChange={(e) => server.setDeviceGroup(device.id, e.target.value || null)}
                                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:border-blue-500 outline-none transition-colors"
                                                        >
                                                            <option value="">No Group</option>
                                                            {device.groupId && !groups.find(g => g.id === device.groupId) && (
                                                                <option value={device.groupId} className="text-amber-400 bg-slate-800">Set by Admin</option>
                                                            )}
                                                            {groups.sort((a, b) => a.name.localeCompare(b.name)).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                                        </select>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="text-[9px] uppercase font-bold text-blue-500/70 tracking-wider">Active Campaign</label>
                                                        <select
                                                            value={device.campaignId || ''}
                                                            onChange={(e) => server.setDeviceCampaign(device.id, e.target.value || null)}
                                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-blue-400 focus:border-blue-500 outline-none transition-colors"
                                                        >
                                                            <option value="">Default (Group/Playlist)</option>
                                                            {server.getAllCampaigns().map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                        </select>
                                                    </div>

                                                    {isAdmin && (
                                                        <div className="space-y-1">
                                                            <label className="text-[9px] uppercase font-bold text-purple-500/70 tracking-wider">Assigned Owner</label>
                                                            <select
                                                                value={device.ownerId || ''}
                                                                onChange={(e) => {
                                                                    server.setDeviceOwner(device.id, e.target.value);
                                                                    setTimeout(() => server.fetchAllDevices(), 500);
                                                                }}
                                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-purple-300 focus:border-purple-500 outline-none transition-colors"
                                                            >
                                                                <option value="" disabled>Select Owner</option>
                                                                {usersList.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Action Footer */}
                                                <div className="pt-4 border-t border-slate-700/50 flex justify-between items-center gap-2">
                                                    <div className="flex gap-1.5">
                                                        <button 
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                setPreviewDevice(device); 
                                                                if (device.resolution?.includes('2160') || device.resolution?.includes('4K')) setPreviewResolution('4K');
                                                                else if (device.resolution?.includes('720')) setPreviewResolution('720p');
                                                                else setPreviewResolution('1080p');
                                                                setPreviewRotation(device.rotation || 0);
                                                            }} 
                                                            className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-lg shadow-blue-900/20" 
                                                            title="Live Preview"
                                                        >
                                                            <Tv size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={async (e) => { 
                                                                e.stopPropagation(); 
                                                                const res = await server.refreshDevice(device.id);
                                                                if (res.success) alert(`Remote reload signal sent to screen "${device.name}"!`);
                                                                else alert("Failed to send refresh signal: " + (res.message || "Unknown error"));
                                                            }} 
                                                            className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all shadow-lg shadow-emerald-900/20" 
                                                            title="Remote Reload Screen"
                                                        >
                                                            <RefreshCcw size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={() => setActiveEntityId(device.id)}
                                                            className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors"
                                                            title="Edit Fallback Playlist"
                                                        >
                                                            <List size={14} />
                                                        </button>
                                                        <div className="w-px h-8 bg-slate-700/50 mx-1"></div>
                                                        <button onClick={(e) => { e.stopPropagation(); refreshRemoteLogs(device.id); }} className="p-2 text-slate-500 hover:text-white transition-colors" title="Logs">
                                                            <FileText size={14} />
                                                        </button>
                                                        <button onClick={(e) => openEditDevice(e, device)} className="p-2 text-slate-500 hover:text-white transition-colors" title="Settings">
                                                            <SettingsIcon size={14} />
                                                        </button>
                                                        <button onClick={(e) => deleteDevice(e, device.id)} className="p-2 text-slate-500 hover:text-red-400 transition-colors" title="Delete">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                    
                                                    <div className="text-right">
                                                        <div className="text-[10px] font-bold text-white font-mono tracking-tighter bg-slate-900 px-2 py-1 rounded border border-slate-700" title="Pairing Code">
                                                            {device.pairingCode}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {filteredDevices.length === 0 && (
                                        <div className="col-span-full text-center py-12 text-slate-500">
                                            <Monitor size={48} className="mx-auto mb-4 opacity-20" />
                                            <p>No registered devices found.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* USERS TAB (ADMIN) */}
                    {activeTab === 'USERS' && isAdmin && (
                        <div className="animate-fade-in">
                            <div className="flex justify-end mb-6">
                                <button onClick={() => { setNewUserInput({ email: '', role: UserRole.OWNER }); setIsCreatingUser(true); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-medium text-sm transition-colors">
                                    <UserPlus size={16} /> Create User
                                </button>
                            </div>
                            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left min-w-[600px]">
                                        <thead className="bg-slate-900 text-slate-400 text-xs uppercase">
                                            <tr>
                                                <th className="p-4">Email</th>
                                                <th className="p-4">Role</th>
                                                <th className="p-4">Created</th>
                                                <th className="p-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700">
                                            {filteredUsers.map(u => (
                                                <tr key={u.id} className="hover:bg-slate-700/30">
                                                    <td className="p-4 font-medium">{u.email}</td>
                                                    <td className="p-4"><span className={`px-2 py-1 rounded text-xs ${u.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>{u.role}</span></td>
                                                    <td className="p-4 text-slate-500 text-sm">{new Date(u.createdAt).toLocaleDateString()}</td>
                                                    <td className="p-4 text-right flex justify-end gap-2">
                                                        {u.email !== 'admin@storecast.com' && (
                                                            <>
                                                                <button onClick={() => setEditingUser(u)} className="text-slate-400 hover:text-blue-400 transition-colors"><Edit2 size={16} /></button>
                                                                <button onClick={() => handleDeleteUser(u.id)} className="text-slate-400 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                                                            </>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* AUDIT TAB (ADMIN) */}
                    {activeTab === 'AUDIT' && isAdmin && (
                        <div className="animate-fade-in bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg flex-1 flex flex-col min-h-0">
                            <div className="p-4 border-b border-slate-700 bg-slate-900 font-medium text-sm text-slate-400 flex justify-between items-center shrink-0">
                                <span>System Activity Log</span>
                                <div className="flex gap-2">
                                    <button onClick={refreshLogs} className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded flex items-center gap-1"><RefreshCcw size={10} /> Refresh</button>
                                    <span className="text-xs px-2 py-1 bg-slate-800 rounded">{filteredAuditLogs.length} entries</span>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto min-h-0">
                                <table className="w-full text-left min-w-[800px]">
                                    <thead className="bg-slate-900/90 text-slate-500 text-xs uppercase sticky top-0 backdrop-blur z-10">
                                        <tr>
                                            <th className="p-4 w-48">Time</th>
                                            <th className="p-4 w-48">User</th>
                                            <th className="p-4 w-32">Action</th>
                                            <th className="p-4">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700 text-sm">
                                        {filteredAuditLogs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-700/30">
                                                <td className="p-4 text-slate-400 whitespace-nowrap font-mono text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                                                <td className="p-4 font-medium text-blue-400">{log.userEmail}</td>
                                                <td className="p-4"><span className="bg-slate-700 px-2 py-0.5 rounded text-xs text-slate-300">{log.action}</span></td>
                                                <td className="p-4 text-slate-400 truncate max-w-md" title={log.details}>{log.details}</td>
                                            </tr>
                                        ))}
                                        {filteredAuditLogs.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center text-slate-500">No logs found matching your search.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* SETTINGS TAB (ADMIN) */}
                    {activeTab === 'SETTINGS' && isAdmin && (
                        <div className="max-w-2xl mx-auto animate-fade-in space-y-6">
                            {/* Access Controls */}
                            {showOwnerSetting && (
                                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-lg">
                                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2 pb-4 border-b border-slate-700"><Shield size={20} /> Access Controls</h3>

                                    <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
                                        <div>
                                            <h4 className="font-medium text-white">Owner Editing Permissions</h4>
                                            <p className="text-sm text-slate-400 mt-1 max-w-sm">
                                                If disabled, device owners can only view their dashboards but cannot modify playlists or settings.
                                            </p>
                                        </div>
                                        <button
                                            onClick={toggleOwnerEdit}
                                            className={`w-14 h-8 rounded-full transition-all relative ${systemConfig?.allowOwnerEdit ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-slate-600'}`}
                                        >
                                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-sm ${systemConfig?.allowOwnerEdit ? 'left-7' : 'left-1'}`} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Email Config */}
                            {showEmailSetting && (
                                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-lg">
                                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2 pb-4 border-b border-slate-700"><Mail size={20} /> Email Configuration (SMTP)</h3>
                                    <form onSubmit={handleSaveEmailConfig} className="space-y-4">
                                        <p className="text-sm text-slate-400 mb-4 bg-blue-500/10 p-3 rounded border border-blue-500/20">
                                            Configure your SMTP server for sending system emails.
                                            For Gmail, use port 465 and an <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-blue-400 underline hover:text-blue-300">App Password</a>.
                                        </p>

                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="col-span-2">
                                                <label className="text-xs text-slate-400 uppercase font-bold block mb-1">SMTP Host</label>
                                                <div className="relative">
                                                    <Server className="absolute left-3 top-3 text-slate-500" size={16} />
                                                    <input type="text" placeholder="smtp.gmail.com" className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:border-blue-500 outline-none" value={configMailHost} onChange={e => setConfigMailHost(e.target.value)} />
                                                </div>
                                            </div>
                                            <div className="col-span-1">
                                                <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Port</label>
                                                <input type="number" placeholder="465" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 outline-none" value={configMailPort} onChange={e => setConfigMailPort(parseInt(e.target.value))} />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Username / Email</label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-3 text-slate-500" size={16} />
                                                <input type="email" placeholder="user@gmail.com" className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:border-blue-500 outline-none" value={configMailUser} onChange={e => setConfigMailUser(e.target.value)} />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs text-slate-400 uppercase font-bold block mb-1">SMTP Password (or App Password)</label>
                                            <div className="relative">
                                                <Key className="absolute left-3 top-3 text-slate-500" size={16} />
                                                <input type="password" placeholder="xxxx xxxx xxxx xxxx" className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:border-blue-500 outline-none" value={configMailPass} onChange={e => setConfigMailPass(e.target.value)} />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Sender Address (Optional)</label>
                                            <div className="relative">
                                                <AtSign className="absolute left-3 top-3 text-slate-500" size={16} />
                                                <input type="email" placeholder="noreply@yourdomain.com" className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:border-blue-500 outline-none" value={configMailFrom} onChange={e => setConfigMailFrom(e.target.value)} />
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-1 ml-1">Overrides the 'From' address. Leave blank to use the Username.</p>
                                        </div>

                                        <div className="flex justify-end pt-2">
                                            <button type="submit" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-medium text-sm transition-colors">
                                                <Save size={16} /> Save Settings
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* Google OAuth 2.0 Config */}
                            {showGoogleSetting && (
                                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-lg">
                                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2 pb-4 border-b border-slate-700">
                                        <Globe size={20} className="text-blue-400" /> Google OAuth 2.0 (SSO)
                                    </h3>
                                    <form onSubmit={handleSaveGoogleConfig} className="space-y-4">
                                        <p className="text-sm text-slate-400 mb-4 bg-blue-500/10 p-3 rounded border border-blue-500/20">
                                            Configure Google OAuth authentication for Single Sign-On (SSO). The authorized redirect URI must match the URI configured in Google Cloud Console.
                                        </p>

                                        <div>
                                            <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Google Client ID</label>
                                            <input type="text" placeholder="xxxx.apps.googleusercontent.com" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 outline-none font-mono text-xs" value={configGoogleClientId} onChange={e => setConfigGoogleClientId(e.target.value)} />
                                        </div>

                                        <div>
                                            <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Google Client Secret</label>
                                            <input type="password" placeholder="GOCSPX-xxxx" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 outline-none font-mono text-xs" value={configGoogleClientSecret} onChange={e => setConfigGoogleClientSecret(e.target.value)} />
                                        </div>

                                        <div>
                                            <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Authorized Redirect URI</label>
                                            <input type="text" placeholder="https://admin.yourdomain.com/auth/google_oauth2/callback" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 outline-none font-mono text-xs" value={configGoogleRedirectUri} onChange={e => setConfigGoogleRedirectUri(e.target.value)} />
                                            <p className="text-[10px] text-slate-500 mt-1 ml-1">Must match the Authorized redirect URI in Google Cloud Console.</p>
                                        </div>

                                        <div className="flex justify-end pt-2">
                                            <button type="submit" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-medium text-sm transition-colors text-white">
                                                <Save size={16} /> Save Google OAuth
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {!showOwnerSetting && !showEmailSetting && !showGoogleSetting && (
                                <div className="text-center py-4 text-slate-500">No settings match your search.</div>
                            )}
                        </div>
                    )}

                    {/* GROUPS TAB */}
                    {activeTab === 'GROUPS' && (
                        <div className="animate-fade-in space-y-6">
                            {/* Top Toolbar */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800/60 p-4 rounded-xl border border-slate-700/80">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <Layers size={20} className="text-emerald-400" /> Groups ({filteredGroups.length})
                                    </h2>
                                </div>

                                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                                    {/* View Mode Toggle: List vs Cards */}
                                    <div className="flex items-center bg-slate-900/90 p-1 rounded-lg border border-slate-700">
                                        <button
                                            onClick={() => handleSetGroupViewMode('list')}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${groupViewMode === 'list' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                            title="Data Table / List View"
                                        >
                                            <List size={14} /> <span>List</span>
                                        </button>
                                        <button
                                            onClick={() => handleSetGroupViewMode('grid')}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${groupViewMode === 'grid' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                            title="Visual Card Grid View"
                                        >
                                            <LayoutGrid size={14} /> <span>Cards</span>
                                        </button>
                                    </div>

                                    <button 
                                        onClick={() => { setGroupNameInput(''); setIsCreatingGroup(true); }} 
                                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg font-medium text-xs transition-colors shadow-lg hover:shadow-emerald-500/20 text-white"
                                    >
                                        <Plus size={14} /> <span>Create Group</span>
                                    </button>
                                </div>
                            </div>

                            {/* 1. DATA TABLE / LIST VIEW */}
                            {groupViewMode === 'list' && (
                                <div className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse min-w-[800px]">
                                            <thead>
                                                <tr className="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700/80 select-none">
                                                    <th className="py-3.5 px-5 min-w-[240px] w-1/3">Group Name & Info</th>
                                                    <th className="py-3.5 px-5 w-44">Linked Screens</th>
                                                    <th className="py-3.5 px-5 min-w-[240px] w-1/3">Assigned Campaign</th>
                                                    <th className="py-3.5 px-5 w-48">Fallback Playlist</th>
                                                    <th className="py-3.5 px-5 text-right w-28">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-700/60 text-sm">
                                                {filteredGroups.map(g => {
                                                    const linkedCount = devices.filter(d => d.groupId === g.id).length;

                                                    return (
                                                        <tr key={g.id} className="hover:bg-slate-700/40 transition-colors group">
                                                            {/* Group Name & ID */}
                                                            <td className="py-3.5 px-5">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 shrink-0">
                                                                        <Layers size={18} />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="font-bold text-white text-sm truncate" title={g.name}>{g.name}</div>
                                                                        <div className="text-xs text-slate-400 font-mono mt-0.5">ID: <span className="text-slate-300">{g.id}</span></div>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            {/* Linked Devices */}
                                                            <td className="py-3.5 px-5">
                                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border ${linkedCount > 0 ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30' : 'bg-slate-900 text-slate-400 border-slate-700'}`}>
                                                                    <Monitor size={14} />
                                                                    <span>{linkedCount} {linkedCount === 1 ? 'Screen' : 'Screens'}</span>
                                                                </span>
                                                            </td>

                                                            {/* Assigned Campaign */}
                                                            <td className="py-3.5 px-5">
                                                                <select
                                                                    value={g.campaignId || ''}
                                                                    onChange={(e) => server.setGroupCampaign(g.id, e.target.value || null)}
                                                                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-emerald-400 focus:border-emerald-500 outline-none w-full truncate cursor-pointer hover:border-slate-500 transition-colors"
                                                                >
                                                                    <option value="">No Campaign (Default Playlist)</option>
                                                                    {server.getAllCampaigns().map(c => (
                                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                                    ))}
                                                                </select>
                                                            </td>

                                                            {/* Fallback Playlist */}
                                                            <td className="py-3.5 px-5">
                                                                <button 
                                                                    onClick={() => setActiveEntityId(g.id)}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs border border-slate-600/40 transition-colors"
                                                                >
                                                                    <List size={14} />
                                                                    <span>{g.playlist?.length || 0} Items</span>
                                                                </button>
                                                            </td>

                                                            {/* Actions */}
                                                            <td className="py-3.5 px-5 text-right">
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    <button 
                                                                        onClick={() => setActiveEntityId(g.id)}
                                                                        className="p-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                                                                        title="Edit Fallback Playlist"
                                                                    >
                                                                        <List size={15} />
                                                                    </button>
                                                                    <button 
                                                                        onClick={(e) => deleteGroup(e, g.id)} 
                                                                        className="p-1.5 bg-slate-700/60 hover:bg-red-900/60 text-slate-400 hover:text-red-300 rounded-lg transition-colors"
                                                                        title="Delete Group"
                                                                    >
                                                                        <Trash2 size={15} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {filteredGroups.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="py-12 text-center text-slate-500">
                                                            <Layers size={40} className="mx-auto mb-2 opacity-20" />
                                                            <p>No groups found.</p>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* 2. CARD GRID VIEW */}
                            {groupViewMode === 'grid' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {filteredGroups.map(g => (
                                        <div key={g.id} className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-emerald-500 transition-all hover:shadow-xl hover:-translate-y-1 relative group h-full flex flex-col">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg"><Layers size={24} /></div>
                                                <div className="text-right">
                                                    <span className="text-[10px] text-slate-500 font-mono bg-slate-900 px-2 py-1 rounded border border-slate-700">Group ID: {g.id}</span>
                                                </div>
                                            </div>
                                            <h3 className="font-bold text-lg text-white truncate mb-1" title={g.name}>{g.name}</h3>
                                            <p className="text-sm text-slate-500 mb-6">{devices.filter(d => d.groupId === g.id).length} Linked Devices</p>

                                            <div className="space-y-1.5 mb-4">
                                                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Assigned Campaign</label>
                                                <select
                                                    value={g.campaignId || ''}
                                                    onChange={(e) => server.setGroupCampaign(g.id, e.target.value || null)}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-emerald-400 focus:border-emerald-500 outline-none transition-colors"
                                                >
                                                    <option value="">No Campaign (Default Playlist)</option>
                                                    {server.getAllCampaigns().map(c => (
                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                    ))}
                                                </select>
                                                <p className="text-[9px] text-slate-600 italic">Campaign assigned to this group will play on all linked devices.</p>
                                            </div>

                                            <button 
                                                onClick={() => setActiveEntityId(g.id)}
                                                className="w-full py-2 bg-slate-700/50 hover:bg-slate-700 rounded text-xs text-slate-400 hover:text-white transition-colors mb-4 border border-slate-700"
                                            >
                                                Edit Fallback Playlist ({g.playlist?.length || 0} items)
                                            </button>

                                            {/* Group Footer: Owner Info + Delete Action */}
                                            <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-between items-end gap-2">
                                                {isAdmin ? (
                                                    <div className="min-w-0 flex-1">
                                                        <span className="block text-[10px] uppercase font-bold text-slate-600 mb-0.5">Owner</span>
                                                        <span className="truncate block text-blue-300 text-xs" title={usersList.find(u => u.id === g.ownerId)?.email}>
                                                            {usersList.find(u => u.id === g.ownerId)?.email || 'Unknown'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="flex-1"></div>
                                                )}

                                                <button onClick={(e) => deleteGroup(e, g.id)} className="p-2 bg-slate-700 hover:bg-red-900/50 rounded text-slate-300 hover:text-red-400 transition-colors shadow-sm border border-slate-600 shrink-0" title="Delete Group">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredGroups.length === 0 && (
                                        <div className="col-span-full text-center py-12 text-slate-500">
                                            <Layers size={48} className="mx-auto mb-4 opacity-20" />
                                            <p>No groups created.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* LAYOUTS TAB */}
                    {activeTab === 'LAYOUTS' && isAdmin && <LayoutList filterQuery={filterQuery} />}

                    {/* PLAYLISTS TAB */}
                    {activeTab === 'PLAYLISTS' && <PlaylistList filterQuery={filterQuery} />}

                    {/* CAMPAIGNS TAB */}
                    {activeTab === 'CAMPAIGNS' && isAdmin && (
                        <div className="animate-fade-in">
                            <CampaignList 
                                filterQuery={filterQuery}
                                activeCampaignId={activeCampaignId}
                                setActiveCampaignId={setActiveCampaignId}
                                onEditZone={(cId, zId, assets) => setEditCampaignZone({campaignId: cId, zoneId: zId, initialAssets: assets})} 
                                onPreviewCampaign={(c) => { setPreviewCampaign(c); setPreviewResolution('1080p'); setPreviewRotation(0); }}
                            />
                        </div>
                    )}
                </div>
            </main>
        </div>

        {/* MODALS */}

            {/* VIEW LOGS MODAL */}
            {viewLogs && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in zoom-in-95 duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-100">
                            <h3 className="font-bold flex items-center gap-2 text-slate-800">
                                <FileText size={20} className="text-blue-500" />
                                Device Logs
                            </h3>
                            <button onClick={() => { setViewLogs(null); setViewLogsDeviceId(null); }} className="p-1 hover:bg-slate-200 rounded-full text-slate-500">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto font-mono text-xs bg-slate-900 text-green-400 flex-1 min-h-[300px]">
                            {viewLogs.length === 0 ? (
                                <div className="text-slate-500 italic">No logs available.</div>
                            ) : (
                                viewLogs.map((log, i) => (
                                    <div key={i} className="mb-1 border-b border-green-900/30 pb-1 whitespace-pre-wrap">{log}</div>
                                ))
                            )}
                        </div>
                        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
                            <div className="text-xs text-slate-400 font-mono">
                                Device ID: {viewLogsDeviceId}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => viewLogsDeviceId && refreshRemoteLogs(viewLogsDeviceId)}
                                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-2 text-sm font-medium"
                                >
                                    <RefreshCcw size={16} /> Refresh
                                </button>
                                <button
                                    onClick={() => { setViewLogs(null); setViewLogsDeviceId(null); }}
                                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 text-sm font-medium"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT USER ROLE MODAL */}
            {editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <form onSubmit={handleUpdateUser} className="bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-700 p-6 animate-in zoom-in-95 duration-200">
                        <h2 className="text-xl font-bold mb-4">Edit User Role</h2>
                        <div className="mb-4">
                            <p className="text-sm text-slate-400 mb-2">User: <span className="text-white">{editingUser.email}</span></p>
                            <label className="text-xs text-slate-500 block mb-1">Role</label>
                            <div className="relative">
                                <select value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value as UserRole })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white appearance-none focus:border-blue-500 outline-none">
                                    <option value={UserRole.OWNER}>Owner</option>
                                    <option value={UserRole.ADMIN}>Admin</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
                            <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium">Update</button>
                        </div>
                    </form>
                </div>
            )}

            {editingDevice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <form onSubmit={handleEditDeviceSubmit} className="bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-700 p-6 animate-in zoom-in-95 duration-200">
                        <h2 className="text-xl font-bold mb-4">Edit Device</h2>
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Device Name</label>
                                <input type="text" placeholder="Name" required className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 outline-none" value={editDeviceName} onChange={e => setEditDeviceName(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Rotation</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[0, 90, 180, 270].map(deg => (
                                        <button
                                            type="button"
                                            key={deg}
                                            onClick={() => setEditDeviceRotation(deg)}
                                            className={`py-3 rounded-lg border transition-all flex flex-col items-center gap-1 ${editDeviceRotation === deg ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                        >
                                            <RotateCw size={16} style={{ transform: `rotate(${deg}deg)` }} />
                                            <span className="text-xs">{deg}°</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {isAdmin && (
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Assigned Owner</label>
                                    <select
                                        value={editDeviceOwnerId}
                                        onChange={e => setEditDeviceOwnerId(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-purple-300 text-sm focus:border-blue-500 outline-none"
                                    >
                                        <option value="">No Assigned Owner</option>
                                        {usersList.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!editingDevice) return;
                                        const res = await server.refreshDevice(editingDevice.id);
                                        if (res.success) {
                                            alert(`Remote reload signal sent to screen "${editingDevice.name}"!`);
                                        } else {
                                            alert("Failed to send refresh signal: " + (res.message || "Unknown error"));
                                        }
                                    }}
                                    className="w-full py-2.5 bg-slate-700/80 hover:bg-emerald-600 border border-slate-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <RefreshCcw size={14} /> Remote Reload Screen
                                </button>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setEditingDevice(null)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
                            <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium">Save Changes</button>
                        </div>
                    </form>
                </div>
            )}

            {isRegistering && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <form onSubmit={handleRegister} className="bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-700 p-6 animate-in zoom-in-95 duration-200">
                        <h2 className="text-xl font-bold mb-4">Register Screen</h2>
                        <input type="text" placeholder="Device Name" required className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 mb-4 text-white focus:border-blue-500 outline-none" value={deviceNameInput} onChange={e => setDeviceNameInput(e.target.value)} />
                        <input type="text" placeholder="Pairing Code (XXXXXX)" required maxLength={6} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 mb-6 text-white text-center text-xl uppercase tracking-widest font-mono focus:border-blue-500 outline-none" value={pairingCodeInput} onChange={e => setPairingCodeInput(e.target.value)} />
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => { setIsRegistering(false); setPairingCodeInput(''); setDeviceNameInput(''); }} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
                            <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium">Pair Device</button>
                        </div>
                    </form>
                </div>
            )}

            {isCreatingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <form onSubmit={handleCreateUser} className="bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-700 p-6 animate-in zoom-in-95 duration-200">
                        <h2 className="text-xl font-bold mb-4">Create New User</h2>
                        <div className="space-y-4 mb-6">
                            <input type="email" placeholder="Email" required className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 outline-none" value={newUserInput.email} onChange={e => setNewUserInput({ ...newUserInput, email: e.target.value })} />

                            {/* Password field removed - it is now auto-generated and emailed */}
                            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-200">
                                A temporary password will be emailed to the user.
                            </div>

                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Role</label>
                                <div className="relative">
                                    <select value={newUserInput.role} onChange={e => setNewUserInput({ ...newUserInput, role: e.target.value as UserRole })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white appearance-none focus:border-blue-500 outline-none">
                                        <option value={UserRole.OWNER}>Owner</option>
                                        <option value={UserRole.ADMIN}>Admin</option>
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => { setIsCreatingUser(false); setNewUserInput({ email: '', role: UserRole.OWNER }); }} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
                            <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium">Create User</button>
                        </div>
                    </form>
                </div>
            )}

            {isChangingPassword && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <form onSubmit={handleChangePassword} className="bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-700 p-6 animate-in zoom-in-95 duration-200">
                        <h2 className="text-xl font-bold mb-4">Change Password</h2>
                        <div className="space-y-4 mb-6">
                            <input type="password" placeholder="New Password" required className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 outline-none" value={newPasswordInput} onChange={e => setNewPasswordInput(e.target.value)} />
                            <input type="password" placeholder="Confirm New Password" required className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 outline-none" value={confirmPasswordInput} onChange={e => setConfirmPasswordInput(e.target.value)} />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setIsChangingPassword(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
                            <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium">Update</button>
                        </div>
                    </form>
                </div>
            )}

            {isCreatingGroup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <form onSubmit={handleCreateGroup} className="bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-700 p-6 animate-in zoom-in-95 duration-200">
                        <h2 className="text-xl font-bold mb-4">Create Group</h2>
                        <input type="text" placeholder="Group Name" required className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 mb-6 text-white focus:border-blue-500 outline-none" value={groupNameInput} onChange={e => setGroupNameInput(e.target.value)} />
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => { setIsCreatingGroup(false); setGroupNameInput(''); }} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
                            <button type="submit" className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-medium">Create</button>
                        </div>
                    </form>
                </div>
            )}

            {(previewDevice || previewCampaign) && (() => {
                const isPortrait = previewRotation === 90 || previewRotation === 270;
                const nativeW = previewResolution === '4K' ? 3840 : (previewResolution === '1080p' ? 1920 : 1280);
                const nativeH = previewResolution === '4K' ? 2160 : (previewResolution === '1080p' ? 1080 : 720);

                const containerW = isPortrait ? nativeH : nativeW;
                const containerH = isPortrait ? nativeW : nativeH;

                let scale = 0.5;
                if (previewResolution === '4K') {
                    scale = isPortrait ? 0.18 : 0.25;
                } else if (previewResolution === '1080p') {
                    scale = isPortrait ? 0.35 : 0.5;
                } else {
                    scale = isPortrait ? 0.5 : 0.75;
                }

                return (
                    <div className="fixed inset-0 z-[60] flex flex-col p-4 sm:p-8 bg-black/95 backdrop-blur-md">
                        {/* Header */}
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-4 flex-wrap">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Tv className="text-blue-400" /> Live Preview: {previewDevice?.name || previewCampaign?.name}
                                </h2>
                                {previewDevice?.resolution && (
                                    <span className="text-xs font-mono font-bold px-2.5 py-1 bg-cyan-950/80 text-cyan-300 rounded-lg border border-cyan-500/40">
                                        Detected TV HW: {previewDevice.resolution}
                                    </span>
                                )}
                                {/* Controls */}
                                <div className="flex gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
                                    {['1080p', '720p', '4K'].map(res => (
                                        <button 
                                            key={res}
                                            onClick={() => setPreviewResolution(res as any)}
                                            className={`px-3 py-1 text-xs font-bold rounded ${previewResolution === res ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            {res}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
                                    {[0, 90, 180, 270].map(deg => (
                                        <button 
                                            key={deg}
                                            onClick={() => setPreviewRotation(deg)}
                                            className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1 ${previewRotation === deg ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            <RotateCw size={12} style={{ transform: `rotate(${deg}deg)` }} />
                                            {deg}°
                                        </button>
                                    ))}
                                </div>
                                <button 
                                    onClick={() => setShowScreenBoundaries(!showScreenBoundaries)}
                                    className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 ${
                                        showScreenBoundaries 
                                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-[0_0_12px_rgba(34,211,238,0.3)]' 
                                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                                    }`}
                                >
                                    <LayoutGrid size={14} /> Screen Edges Guide {showScreenBoundaries ? 'ON' : 'OFF'}
                                </button>
                            </div>
                            <button onClick={() => { setPreviewDevice(null); setPreviewCampaign(null); }} className="p-2 bg-slate-800 hover:bg-red-900/50 rounded-lg text-slate-400 hover:text-red-400 transition-colors border border-slate-700">
                                <X size={24} />
                            </button>
                        </div>

                        {/* IFrame Container with High-Contrast TV Bezel */}
                        <div className="flex-1 flex items-center justify-center overflow-hidden">
                            <div 
                                className={`relative bg-black transition-all duration-500 origin-center shrink-0 rounded-xl overflow-hidden ${
                                    showScreenBoundaries 
                                        ? 'ring-4 ring-cyan-400 shadow-[0_0_60px_rgba(34,211,238,0.4),0_0_0_12px_rgba(15,23,42,1)]' 
                                        : 'border-8 border-slate-800 shadow-[0_0_60px_rgba(0,0,0,0.9)]'
                                }`}
                                style={{
                                    width: `${containerW}px`,
                                    height: `${containerH}px`,
                                    transform: `scale(${scale})`,
                                }}
                            >
                                <iframe 
                                    src={`${server.getScreenUrl()}/?${previewDevice ? `screen=${previewDevice.id}` : `previewCampaign=${previewCampaign?.id}`}&overrideRotation=${previewRotation}`} 
                                    className="w-full h-full border-0"
                                    title="Live Preview"
                                />

                                {/* High-Contrast TV Screen Boundary Overlay */}
                                {showScreenBoundaries && (
                                    <div className="absolute inset-0 pointer-events-none z-[9999] border-4 border-cyan-400">
                                        {/* 4 Corner Crosshair Target Markers */}
                                        <div className="absolute top-0 left-0 w-12 h-12 border-t-8 border-l-8 border-emerald-400" />
                                        <div className="absolute top-0 right-0 w-12 h-12 border-t-8 border-r-8 border-emerald-400" />
                                        <div className="absolute bottom-0 left-0 w-12 h-12 border-b-8 border-l-8 border-emerald-400" />
                                        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-8 border-r-8 border-emerald-400" />

                                        {/* Edge Dimension Badges */}
                                        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-cyan-950/90 text-cyan-300 font-mono text-[12px] font-bold px-3 py-1 rounded-full border border-cyan-400 shadow-md">
                                            TOP SCREEN EDGE ({isPortrait ? `${nativeH}×${nativeW}` : `${nativeW}×${nativeH}`})
                                        </div>
                                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-cyan-950/90 text-cyan-300 font-mono text-[12px] font-bold px-3 py-1 rounded-full border border-cyan-400 shadow-md">
                                            BOTTOM SCREEN EDGE
                                        </div>
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-cyan-950/90 text-cyan-300 font-mono text-[12px] font-bold px-3 py-1 rounded-full border border-cyan-400 shadow-md -rotate-90 origin-center">
                                            LEFT EDGE
                                        </div>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-cyan-950/90 text-cyan-300 font-mono text-[12px] font-bold px-3 py-1 rounded-full border border-cyan-400 shadow-md rotate-90 origin-center">
                                            RIGHT EDGE
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

        </div>
    );
};
