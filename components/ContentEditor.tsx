import React, { useState, useRef } from 'react';
import { Asset, AssetType, AssetScale } from '../types';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Globe from 'lucide-react/dist/esm/icons/globe';
import ImageIcon from 'lucide-react/dist/esm/icons/image';
import Video from 'lucide-react/dist/esm/icons/video';
import PlayCircle from 'lucide-react/dist/esm/icons/play-circle';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import RotateCw from 'lucide-react/dist/esm/icons/rotate-cw';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import Edit2 from 'lucide-react/dist/esm/icons/edit-2';
import Upload from 'lucide-react/dist/esm/icons/upload';
import X from 'lucide-react/dist/esm/icons/x';
import List from 'lucide-react/dist/esm/icons/list';
import Copy from 'lucide-react/dist/esm/icons/copy';
import Volume2 from 'lucide-react/dist/esm/icons/volume-2';
import VolumeX from 'lucide-react/dist/esm/icons/volume-x';
import { server } from '../services/server';

const getVideoPreviewUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.includes('#t=')) return url;
    return `${url}#t=0.5`;
};

interface ContentEditorProps {
    title: string;
    subTitle: string;
    initialAssets: Asset[];
    initialOverlay?: string;
    initialOverlayX?: number;
    initialOverlayY?: number;
    initialOverlayW?: number;
    initialOverlayH?: number;
    onSave: (a: Asset[]) => void;
    onSaveOverlay: (url: string, x?: number, y?: number, w?: number, h?: number) => void;
    onBack: () => void;
    readOnly?: boolean;
}

export const ContentEditor: React.FC<ContentEditorProps> = ({ 
    title, subTitle, initialAssets, initialOverlay, 
    initialOverlayX, initialOverlayY, initialOverlayW, initialOverlayH,
    onSave, onSaveOverlay, onBack, readOnly 
}) => {
    const [assets, setAssets] = useState<Asset[]>(initialAssets);
    const [globalOverlay, setGlobalOverlay] = useState<string>(initialOverlay || '');
    const [overlayX, setOverlayX] = useState<number>(initialOverlayX ?? 0);
    const [overlayY, setOverlayY] = useState<number>(initialOverlayY ?? 0);
    const [overlayW, setOverlayW] = useState<number>(initialOverlayW ?? 100);
    const [overlayH, setOverlayH] = useState<number>(initialOverlayH ?? 100);
    const [isEditingOverlayLayout, setIsEditingOverlayLayout] = useState(false);
    
    const [modalMode, setModalMode] = useState<'ADD' | 'EDIT' | 'CLOSED'>('CLOSED');
    const [importModalOpen, setImportModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const globalOverlayInputRef = useRef<HTMLInputElement>(null);

    // Form State
    const [editAssetId, setEditAssetId] = useState<string | null>(null);
    const [assetType, setAssetType] = useState<AssetType>(AssetType.IMAGE);
    const [assetUrl, setAssetUrl] = useState('');
    const [assetName, setAssetName] = useState('');
    const [assetDuration, setAssetDuration] = useState(10);
    const [assetScale, setAssetScale] = useState<AssetScale>(AssetScale.FIT);
    const [playUntilDone, setPlayUntilDone] = useState(false);
    const [assetMuted, setAssetMuted] = useState(false);
    const [filterQuery, setFilterQuery] = useState('');

    const handleSubmit = () => {
        if (!assetUrl) return;
        const newAsset: Asset = {
            id: modalMode === 'ADD' ? Date.now().toString() : editAssetId!,
            type: assetType,
            url: assetUrl,
            name: assetName || 'Untitled',
            duration: assetDuration,
            scale: assetScale,
            playUntilDone: (assetType === AssetType.VIDEO || assetType === AssetType.YOUTUBE) ? playUntilDone : false,
            muted: assetMuted
        };
        const updated = modalMode === 'ADD' ? [...assets, newAsset] : assets.map(a => a.id === newAsset.id ? newAsset : a);
        setAssets(updated);
        onSave(updated);
        setModalMode('CLOSED');
        // Reset
        setAssetUrl(''); setAssetName(''); setAssetDuration(10); setPlayUntilDone(false); setAssetMuted(false);
    };

    const handleDelete = (id: string) => {
        const updated = assets.filter(a => a.id !== id);
        setAssets(updated);
        onSave(updated);
    };

    const moveAsset = (index: number, direction: 'left' | 'right') => {
        if (direction === 'left' && index === 0) return;
        if (direction === 'right' && index === assets.length - 1) return;

        const newAssets = [...assets];
        const targetIndex = direction === 'left' ? index - 1 : index + 1;
        // Swap
        [newAssets[index], newAssets[targetIndex]] = [newAssets[targetIndex], newAssets[index]];

        setAssets(newAssets);
        onSave(newAssets);
    };

    // Upload Progress State
    const [uploadProgress, setUploadProgress] = useState<{
        isUploading: boolean;
        fileName: string;
        percent: number;
        fileSizeStr: string;
        status: 'READING' | 'UPLOADING' | 'TRANSCODING' | 'COMPLETE' | 'ERROR';
        errorMsg?: string;
    } | null>(null);

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const fileSizeStr = formatFileSize(file.size);
        const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|quicktime|mkv|avi|webm|m4v)$/i.test(file.name);
        const targetType = isVideo ? AssetType.VIDEO : AssetType.IMAGE;
        setAssetType(targetType);
        setAssetName(file.name);

        setUploadProgress({
            isUploading: true,
            fileName: file.name,
            percent: 5,
            fileSizeStr,
            status: 'READING'
        });

        const reader = new FileReader();
        reader.onprogress = (evt) => {
            if (evt.lengthComputable) {
                const readPercent = Math.round((evt.loaded / evt.total) * 15);
                setUploadProgress(prev => prev ? { ...prev, percent: 5 + readPercent } : null);
            }
        };

        reader.onloadend = async () => {
            const rawContent = reader.result as string;
            setUploadProgress(prev => prev ? { ...prev, percent: 20, status: 'UPLOADING' } : null);

            let transcodeTimer: ReturnType<typeof setInterval> | null = null;

            const uploadRes = await server.uploadAsset(rawContent, file.name, (serverPercent) => {
                if (serverPercent >= 100 && isVideo) {
                    setUploadProgress(prev => {
                        if (!prev) return null;
                        return { ...prev, percent: Math.max(prev.percent, 70), status: 'TRANSCODING' };
                    });

                    if (!transcodeTimer) {
                        transcodeTimer = setInterval(() => {
                            setUploadProgress(prev => {
                                if (!prev || prev.status !== 'TRANSCODING') return prev;
                                const next = Math.min(96, prev.percent + 2);
                                return { ...prev, percent: next };
                            });
                        }, 400);
                    }
                } else {
                    const uploadScale = isVideo ? 50 : 74;
                    const totalPercent = Math.min(99, 20 + Math.round((serverPercent / 100) * uploadScale));
                    setUploadProgress(prev => prev ? { ...prev, percent: totalPercent, status: 'UPLOADING' } : null);
                }
            });

            if (transcodeTimer) clearInterval(transcodeTimer);

            if (uploadRes.success && uploadRes.url) {
                setUploadProgress(prev => prev ? { ...prev, percent: 100, status: 'COMPLETE' } : null);
                setAssetUrl(uploadRes.url);

                setTimeout(() => {
                    setUploadProgress(null);
                }, 800);
            } else {
                setUploadProgress(prev => prev ? {
                    ...prev,
                    percent: 100,
                    status: 'ERROR',
                    errorMsg: uploadRes.message || 'Upload failed'
                } : null);

                setTimeout(() => {
                    setUploadProgress(null);
                }, 3000);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleGlobalOverlayUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const fileSizeStr = formatFileSize(file.size);
        setUploadProgress({
            isUploading: true,
            fileName: file.name,
            percent: 5,
            fileSizeStr,
            status: 'READING'
        });

        const reader = new FileReader();
        reader.onprogress = (evt) => {
            if (evt.lengthComputable) {
                const readPercent = Math.round((evt.loaded / evt.total) * 20);
                setUploadProgress(prev => prev ? { ...prev, percent: 5 + readPercent } : null);
            }
        };

        reader.onloadend = async () => {
            const rawContent = reader.result as string;
            setUploadProgress(prev => prev ? { ...prev, percent: 25, status: 'UPLOADING' } : null);

            const uploadRes = await server.uploadAsset(rawContent, file.name, (serverPercent) => {
                const totalPercent = Math.min(99, 25 + Math.round((serverPercent / 100) * 74));
                setUploadProgress(prev => prev ? { ...prev, percent: totalPercent } : null);
            });

            if (uploadRes.success && uploadRes.url) {
                setUploadProgress(prev => prev ? { ...prev, percent: 100, status: 'COMPLETE' } : null);
                setGlobalOverlay(uploadRes.url);
                onSaveOverlay(uploadRes.url);

                setTimeout(() => {
                    setUploadProgress(null);
                }, 600);
            } else {
                setUploadProgress(prev => prev ? {
                    ...prev,
                    percent: 100,
                    status: 'ERROR',
                    errorMsg: uploadRes.message || 'Overlay upload failed'
                } : null);

                setTimeout(() => {
                    setUploadProgress(null);
                }, 3000);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    return (
        <div className="h-screen bg-slate-900 flex flex-col overflow-hidden text-slate-100 animate-fade-in">
            <header className="flex-none bg-slate-900 border-b border-slate-800 z-10 px-6 py-4 flex items-center gap-4">
                <button onClick={onBack} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-white transition-colors border border-slate-700"><ArrowLeft size={20} /></button>
                <div className="flex-1 min-w-0 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-white truncate">{title}</h1>
                        <p className="text-slate-400 text-sm truncate">{subTitle}</p>
                    </div>

                    {!readOnly && (
                        <div className="flex items-center gap-3 mr-4">
                            <div className="relative">
                                <input 
                                    type="text" 
                                    placeholder="Search slides..." 
                                    value={filterQuery}
                                    onChange={e => setFilterQuery(e.target.value)}
                                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none w-48 transition-all focus:w-64"
                                />
                                {filterQuery && (
                                    <button onClick={() => setFilterQuery('')} className="absolute right-2 top-2 text-slate-500 hover:text-white">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            <span className="text-xs text-slate-400 uppercase font-bold hidden sm:inline ml-2">Global Overlay:</span>
                            <div className="flex items-center gap-2">
                                <input type="file" ref={globalOverlayInputRef} className="hidden" accept="image/png,image/*" onChange={handleGlobalOverlayUpload} />
                                <button onClick={() => globalOverlayInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-sm transition-colors">
                                    <ImageIcon size={16} className="text-slate-400" />
                                    <span>{globalOverlay ? 'Change' : 'Upload PNG'}</span>
                                </button>
                                {globalOverlay && (
                                    <>
                                        <div className="relative group w-8 h-8 rounded border border-slate-600 overflow-hidden bg-slate-800">
                                            <img src={globalOverlay} className="w-full h-full object-contain" alt="Overlay" />
                                            <button onClick={() => { setGlobalOverlay(''); onSaveOverlay(''); }} className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity" title="Remove Overlay">
                                                <X size={12} />
                                            </button>
                                        </div>
                                        <button onClick={() => setIsEditingOverlayLayout(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-bold text-white transition-colors uppercase tracking-widest shadow-lg shadow-blue-900/20">
                                            <Edit2 size={14} />
                                            <span>Position</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                {readOnly && <div className="hidden sm:flex items-center gap-2 text-amber-400 bg-amber-900/20 px-3 py-1 rounded-full text-xs font-medium border border-amber-900/50"><CheckCircle2 size={12} /> View Only</div>}
            </header>

            {isEditingOverlayLayout && (
                <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/95 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="p-6 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-bold text-white">Overlay Positioning</h2>
                            <p className="text-sm text-slate-400 text-sm">Drag and resize the overlay to fit your screen design.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setIsEditingOverlayLayout(false)} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">Cancel</button>
                            <button 
                                onClick={() => {
                                    onSaveOverlay(globalOverlay, overlayX, overlayY, overlayW, overlayH);
                                    setIsEditingOverlayLayout(false);
                                }} 
                                className="px-8 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg shadow-blue-900/40 transition-all"
                            >
                                Save Layout
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 flex gap-8 p-8 overflow-hidden">
                        {/* Interactive Editor Area */}
                        <div className="flex-1 bg-black rounded-2xl border-4 border-slate-800 relative overflow-hidden shadow-2xl flex items-center justify-center">
                            <div className="w-full aspect-video bg-slate-900 relative">
                                <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                                <div 
                                    className="absolute border-2 border-blue-500 bg-blue-500/10 cursor-move group"
                                    style={{
                                        left: `${overlayX}%`,
                                        top: `${overlayY}%`,
                                        width: `${overlayW}%`,
                                        height: `${overlayH}%`
                                    }}
                                >
                                    <img src={globalOverlay} className="w-full h-full object-cover pointer-events-none" alt="Overlay" />
                                    
                                    {/* Resize Handles */}
                                    <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-blue-500 rounded-full border-2 border-white cursor-nwse-resize shadow-lg flex items-center justify-center">
                                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                    </div>
                                    <div className="absolute -top-2 -left-2 w-4 h-4 bg-blue-500 rounded-full border border-white opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full border border-white opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-blue-500 rounded-full border border-white opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                </div>
                                <div className="absolute bottom-4 left-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest bg-black/50 px-2 py-1 rounded">Preview 16:9 Screen</div>
                            </div>
                        </div>

                        {/* Control Panel */}
                        <div className="w-80 bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl space-y-6">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Geometry Settings</h3>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-black block mb-1">X Position (%)</label>
                                    <input type="number" step="0.1" value={overlayX} onChange={e => setOverlayX(parseFloat(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:border-blue-500 outline-none font-mono text-sm" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-black block mb-1">Y Position (%)</label>
                                    <input type="number" step="0.1" value={overlayY} onChange={e => setOverlayY(parseFloat(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:border-blue-500 outline-none font-mono text-sm" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-black block mb-1">Width (%)</label>
                                    <input type="number" step="0.1" value={overlayW} onChange={e => setOverlayW(parseFloat(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:border-blue-500 outline-none font-mono text-sm" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-black block mb-1">Height (%)</label>
                                    <input type="number" step="0.1" value={overlayH} onChange={e => setOverlayH(parseFloat(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:border-blue-500 outline-none font-mono text-sm" />
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-700 space-y-2">
                                <button onClick={() => { setOverlayX(0); setOverlayY(0); setOverlayW(100); setOverlayH(100); }} className="w-full py-2 bg-slate-900 hover:bg-slate-700 text-slate-400 hover:text-white rounded text-xs font-bold uppercase transition-colors">Reset to Full Screen</button>
                                <button onClick={() => { setOverlayX(2.5); setOverlayY(2.5); setOverlayW(95); setOverlayH(95); }} className="w-full py-2 bg-slate-900 hover:bg-slate-700 text-slate-400 hover:text-white rounded text-xs font-bold uppercase transition-colors">Safety Margin (5%)</button>
                            </div>

                            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                <p className="text-[10px] text-blue-300 leading-relaxed italic">
                                    Tip: Coordinates are relative to the screen size. 0,0 is top-left, 100,100 is bottom-right.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pb-20">
                    {!readOnly && (
                        <>
                            <button onClick={() => {
                                setModalMode('ADD');
                                setAssetUrl(''); setAssetName(''); setAssetDuration(10); setPlayUntilDone(false);
                            }} className="flex flex-col items-center justify-center h-48 bg-slate-800/40 border-2 border-dashed border-slate-700 rounded-xl hover:border-blue-500 hover:bg-blue-500/5 transition-all text-slate-400 hover:text-white group">
                                <Plus size={32} className="mb-2 group-hover:scale-110 transition-transform" /> 
                                <span className="text-sm font-bold uppercase tracking-wider">Add Slide</span>
                            </button>

                            <button onClick={() => {
                                const savedPlaylists = server.getAllSavedPlaylists();
                                if (savedPlaylists.length === 0) {
                                    alert('No saved playlists found. Create some in the Playlists tab first.');
                                    return;
                                }
                                setImportModalOpen(true);
                            }} className="flex flex-col items-center justify-center h-48 bg-slate-800/40 border-2 border-dashed border-slate-700 rounded-xl hover:border-emerald-500 hover:bg-emerald-500/5 transition-all text-slate-400 hover:text-white group">
                                <List size={32} className="mb-2 group-hover:scale-110 transition-transform" /> 
                                <span className="text-sm font-bold uppercase tracking-wider">Import Playlist</span>
                            </button>
                        </>
                    )}
                    {assets.filter(a => a.name.toLowerCase().includes(filterQuery.toLowerCase()) || a.type.toLowerCase().includes(filterQuery.toLowerCase())).map((asset, index) => (
                        <div key={asset.id} className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 group relative shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all">
                            <div className="absolute top-2 left-2 z-10 bg-black/50 px-2 py-0.5 rounded text-[10px] text-white backdrop-blur">{index + 1}</div>
                            <div className="h-32 bg-black flex items-center justify-center relative overflow-hidden">
                                {asset.type === AssetType.IMAGE && <img src={asset.url} className="w-full h-full object-cover" alt={asset.name} />}
                                {asset.type === AssetType.VIDEO && (
                                    <>
                                        <Video size={32} className="text-slate-600 absolute" />
                                        <video
                                            src={getVideoPreviewUrl(asset.url)}
                                            className="w-full h-full object-cover relative z-[1] pointer-events-none"
                                            preload="metadata"
                                            muted
                                            playsInline
                                            onLoadedMetadata={(e) => {
                                                const v = e.currentTarget;
                                                if (v.currentTime === 0 && v.duration > 0.1) {
                                                    try {
                                                        v.currentTime = Math.min(0.5, v.duration / 2);
                                                    } catch (err) {}
                                                }
                                            }}
                                        />
                                        <div className="absolute bottom-2 right-2 z-10 bg-black/60 p-1 rounded text-white/80 backdrop-blur pointer-events-none">
                                            <Video size={12} />
                                        </div>
                                    </>
                                )}
                                {asset.type === AssetType.WEBSITE && <Globe size={32} className="text-slate-500" />}
                                {asset.type === AssetType.YOUTUBE && <PlayCircle size={32} className="text-red-500" />}

                                {!readOnly && (
                                    <>
                                        <div className="absolute top-2 right-2 flex gap-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {asset.type === AssetType.VIDEO && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (confirm('Rotate video 90° clockwise? This process happens on the server and may take a moment for large files.')) {
                                                            const apiUrl = `http://${window.location.hostname}:8765/api/utils/rotate`;
                                                            alert('Rotation started... Please wait.');
                                                            fetch(apiUrl, {
                                                                method: 'POST',
                                                                headers: {
                                                                    'Content-Type': 'application/json',
                                                                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                                                                },
                                                                body: JSON.stringify({ content: asset.url })
                                                            })
                                                                .then(res => res.json())
                                                                .then(data => {
                                                                    if (data.success && data.content) {
                                                                        const newAssets = [...assets];
                                                                        newAssets[index] = { ...asset, url: data.content };
                                                                        setAssets(newAssets);
                                                                        onSave(newAssets);
                                                                        alert('Rotation complete!');
                                                                    } else {
                                                                        alert('Rotation failed: ' + (data.error || 'Unknown error'));
                                                                    }
                                                                })
                                                                .catch(err => {
                                                                    console.error(err);
                                                                    alert('Error rotating video. File might be too large.');
                                                                });
                                                        }
                                                    }}
                                                    className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white shadow"
                                                    title="Rotate 90° CW"
                                                >
                                                    <RotateCw size={14} />
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); moveAsset(index, 'left'); }}
                                                disabled={index === 0}
                                                className={`p-1.5 rounded text-white shadow ${index === 0 ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'}`}
                                                title="Move Previous"
                                            >
                                                <ArrowLeft size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); moveAsset(index, 'right'); }}
                                                disabled={index === assets.length - 1}
                                                className={`p-1.5 rounded text-white shadow ${index === assets.length - 1 ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'}`}
                                                title="Move Next"
                                            >
                                                <ArrowRight size={14} />
                                            </button>

                                            <div className="w-2"></div>

                                            <button onClick={(e) => {
                                                e.stopPropagation();
                                                setEditAssetId(asset.id); setAssetType(asset.type); setAssetUrl(asset.url); setAssetName(asset.name); setAssetDuration(asset.duration); setAssetScale(asset.scale || AssetScale.FIT); setPlayUntilDone(asset.playUntilDone || false);
                                                setAssetMuted(asset.muted || false);
                                                setModalMode('EDIT');
                                            }} className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white shadow"><Edit2 size={14} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(asset.id); }} className="p-1.5 bg-red-500/90 hover:bg-red-500 rounded text-white shadow"><Trash2 size={14} /></button>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="p-3">
                                <div className="font-bold truncate text-sm text-white mb-1" title={asset.name}>{asset.name}</div>
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span>{asset.type}</span>
                                    <span>{asset.playUntilDone ? 'Full' : `${asset.duration}s`}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {modalMode !== 'CLOSED' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-700 p-6 space-y-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-white">{modalMode === 'ADD' ? 'Add' : 'Edit'} Slide</h2>

                        <div className="flex gap-2 mb-4">
                            {['IMAGE', 'VIDEO', 'WEBSITE', 'YOUTUBE'].map(t => (
                                <button key={t} onClick={() => { setAssetType(t as AssetType); if (t !== 'VIDEO' && t !== 'YOUTUBE') setPlayUntilDone(false); }} className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${assetType === t ? 'bg-blue-600 text-white shadow' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>{t}</button>
                            ))}
                        </div>

                        <div>
                            <label className="text-xs text-slate-400 uppercase font-bold block mb-1">URL / Content</label>
                            <div className="flex gap-2">
                                <input type="text" value={assetUrl} onChange={e => setAssetUrl(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:border-blue-500 outline-none truncate" placeholder="https://..." />
                                {(assetType === 'IMAGE' || assetType === 'VIDEO') && (
                                    <>
                                        <input type="file" ref={fileInputRef} className="hidden" accept={assetType === 'IMAGE' ? "image/*" : "video/*"} onChange={handleFileUpload} />
                                        <button onClick={() => fileInputRef.current?.click()} className="px-3 bg-slate-700 hover:bg-slate-600 rounded border border-slate-600 text-slate-300" title="Upload File">
                                            <Upload size={18} />
                                        </button>
                                    </>
                                )}
                            </div>
                            {assetType === 'WEBSITE' && (
                                <p className="text-[10px] text-amber-500 mt-1 italic leading-tight">
                                    Warning: Many major websites (Google, Facebook, etc.) block iframe embedding for security. If the preview is blank, use a different URL.
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Name</label>
                            <input type="text" value={assetName} onChange={e => setAssetName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:border-blue-500 outline-none" />
                        </div>

                        {(assetType === 'VIDEO' || assetType === 'YOUTUBE') && (
                            <div className="flex items-center gap-2 p-2 bg-slate-700/30 rounded border border-slate-700 mb-2">
                                <input
                                    type="checkbox"
                                    id="playUntilDone"
                                    checked={playUntilDone}
                                    onChange={e => setPlayUntilDone(e.target.checked)}
                                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-offset-0 focus:ring-0"
                                />
                                <label htmlFor="playUntilDone" className="text-xs text-slate-300 font-bold uppercase cursor-pointer select-none">
                                    Play until finished?
                                </label>
                            </div>
                        )}

                        {(assetType === 'VIDEO' || assetType === 'YOUTUBE') && (
                            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${assetMuted ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                        {assetMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-white">Sound Output</div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Enable/Disable audio</div>
                                    </div>
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => setAssetMuted(!assetMuted)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${assetMuted ? 'bg-slate-700 text-slate-400' : 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'}`}
                                >
                                    {assetMuted ? 'MUTED' : 'ENABLED'}
                                </button>
                            </div>
                        )}

                        <div className={playUntilDone ? "opacity-50 grayscale pointer-events-none" : ""}>
                            <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Duration (seconds)</label>
                            <input type="number" value={assetDuration} onChange={e => setAssetDuration(parseInt(e.target.value) || 10)} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:border-blue-500 outline-none" />
                        </div>

                        {(assetType === 'IMAGE' || assetType === 'VIDEO') && (
                            <div>
                                <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Scale Mode</label>
                                <div className="flex gap-1">
                                    {['FIT', 'FILL', 'STRETCH'].map(s => (
                                        <button key={s} onClick={() => setAssetScale(s as AssetScale)} className={`flex-1 py-1 text-xs rounded transition-colors ${assetScale === s ? 'bg-slate-600 text-white' : 'bg-slate-700 text-slate-500'}`}>{s}</button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-700">
                            <button onClick={() => setModalMode('CLOSED')} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
                            <button onClick={handleSubmit} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium">Save Slide</button>
                        </div>
                    </div>
                </div>
            )}

            {importModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-700 p-6 space-y-4 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">Import Playlist</h2>
                            <button onClick={() => setImportModalOpen(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <p className="text-sm text-slate-400">Choose a saved playlist to add its slides to the current list.</p>
                        
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                            {server.getAllSavedPlaylists().map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        const newAssets = [...assets, ...p.assets.map(a => ({ ...a, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) }))];
                                        setAssets(newAssets);
                                        onSave(newAssets);
                                        setImportModalOpen(false);
                                    }}
                                    className="w-full flex items-center justify-between p-3 bg-slate-700/50 hover:bg-slate-700 rounded-xl border border-slate-600 transition-colors text-left group"
                                >
                                    <div>
                                        <div className="font-bold text-white group-hover:text-blue-400 transition-colors">{p.name}</div>
                                        <div className="text-xs text-slate-400">{p.assets.length} items</div>
                                    </div>
                                    <Copy size={16} className="text-slate-500 group-hover:text-blue-400" />
                                </button>
                            ))}
                        </div>
                        
                        <div className="pt-4 border-t border-slate-700">
                            <button onClick={() => setImportModalOpen(false)} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {uploadProgress && uploadProgress.isUploading && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
                    <div className="bg-slate-900 border border-slate-700/80 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-5 text-white relative animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-3 rounded-xl border ${
                                    uploadProgress.status === 'COMPLETE'
                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                        : uploadProgress.status === 'TRANSCODING'
                                        ? 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                                        : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                }`}>
                                    {uploadProgress.status === 'COMPLETE' ? (
                                        <CheckCircle2 size={24} className="text-emerald-400 animate-bounce" />
                                    ) : uploadProgress.status === 'TRANSCODING' ? (
                                        <RefreshCw size={24} className="animate-spin text-purple-400" />
                                    ) : (
                                        <Upload size={24} className="animate-pulse text-blue-400" />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-bold text-base text-white truncate">
                                        {uploadProgress.status === 'COMPLETE' && 'Upload Complete!'}
                                        {uploadProgress.status === 'TRANSCODING' && 'Transcoding Video...'}
                                        {uploadProgress.status === 'UPLOADING' && 'Uploading Media File'}
                                        {uploadProgress.status === 'READING' && 'Reading Media File'}
                                        {uploadProgress.status === 'ERROR' && 'Upload Failed'}
                                    </h3>
                                    <p className="text-xs text-slate-400 truncate max-w-[200px]" title={uploadProgress.fileName}>
                                        {uploadProgress.fileName}
                                    </p>
                                </div>
                            </div>
                            <span className="text-xs font-mono font-semibold text-slate-300 px-2.5 py-1 bg-slate-800 rounded-lg border border-slate-700 flex-none">
                                {uploadProgress.fileSizeStr}
                            </span>
                        </div>

                        {/* Progress Bar Container */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400 font-medium">
                                    {uploadProgress.status === 'READING' && 'Reading local file...'}
                                    {uploadProgress.status === 'UPLOADING' && 'Sending to server...'}
                                    {uploadProgress.status === 'TRANSCODING' && 'Transcoding & optimizing for Smart TVs (H.264)...'}
                                    {uploadProgress.status === 'COMPLETE' && 'Ready to use ✓'}
                                    {uploadProgress.status === 'ERROR' && (
                                        <span className="text-amber-400">{uploadProgress.errorMsg || 'Upload complete'}</span>
                                    )}
                                </span>
                                <span className={`font-bold font-mono text-sm ${
                                    uploadProgress.status === 'COMPLETE'
                                        ? 'text-emerald-400'
                                        : uploadProgress.status === 'TRANSCODING'
                                        ? 'text-purple-400'
                                        : 'text-blue-400'
                                }`}>
                                    {uploadProgress.percent}%
                                </span>
                            </div>

                            <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                                <div 
                                    className={`h-full rounded-full transition-all duration-300 ${
                                        uploadProgress.status === 'COMPLETE'
                                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                            : uploadProgress.status === 'TRANSCODING'
                                            ? 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500'
                                            : 'bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-400'
                                    }`}
                                    style={{ width: `${uploadProgress.percent}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
