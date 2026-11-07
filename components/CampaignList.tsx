import React, { useState, useEffect } from 'react';
import { Campaign, Layout, Asset } from '../types';
import { server, safeStorage } from '../services/server';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Layers from 'lucide-react/dist/esm/icons/layers';
import LayoutGrid from 'lucide-react/dist/esm/icons/layout-grid';
import Edit2 from 'lucide-react/dist/esm/icons/edit-2';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left';
import PlayCircle from 'lucide-react/dist/esm/icons/play-circle';
import List from 'lucide-react/dist/esm/icons/list';
import Flag from 'lucide-react/dist/esm/icons/flag';
import Tv from 'lucide-react/dist/esm/icons/tv';

interface CampaignListProps {
    onEditZone: (campaignId: string, zoneId: string, initialAssets: Asset[]) => void;
    onPreviewCampaign: (campaign: Campaign) => void;
    filterQuery?: string;
    activeCampaignId: string | null;
    setActiveCampaignId: (id: string | null) => void;
}

export const CampaignList: React.FC<CampaignListProps> = ({ onEditZone, onPreviewCampaign, filterQuery = '', activeCampaignId, setActiveCampaignId }) => {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [layouts, setLayouts] = useState<Layout[]>([]);
    
    const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
        try {
            return (safeStorage.getItem('storecast_campaign_view_mode') as 'list' | 'grid') || 'list';
        } catch (e) {
            return 'list';
        }
    });

    const handleSetViewMode = (mode: 'list' | 'grid') => {
        setViewMode(mode);
        try { safeStorage.setItem('storecast_campaign_view_mode', mode); } catch (e) {}
    };

    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newLayoutId, setNewLayoutId] = useState('');
    
    const activeCampaign = campaigns.find(c => c.id === activeCampaignId) || null;

    const fetchData = () => {
        setCampaigns([...server.getAllCampaigns()]);
        setLayouts([...server.getAllLayouts()]);
    };

    useEffect(() => {
        fetchData();
        const unsub = server.subscribe(fetchData);
        return unsub;
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        await server.createCampaign(newName, newLayoutId);
        setIsCreating(false);
        setNewName('');
        setNewLayoutId('');
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Delete this campaign?')) {
            await server.deleteCampaign(id);
            if (activeCampaignId === id) setActiveCampaignId(null);
        }
    };

    // Filter and Sort
    const filteredCampaigns = campaigns
        .filter(c => c.name.toLowerCase().includes(filterQuery.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));

    if (activeCampaign) {
        const layout = layouts.find(l => l.id === activeCampaign.layoutId);
        
        return (
            <div className="animate-fade-in">
                <button onClick={() => setActiveCampaignId(null)} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors font-medium text-sm">
                    <ArrowLeft size={18} /> Back to Campaigns
                </button>
                
                <div className="bg-slate-800/80 p-6 rounded-xl border border-slate-700 shadow-xl">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <div className="flex items-center gap-2">
                                <Flag className="text-amber-400" size={24} />
                                <h2 className="text-2xl font-bold text-white">{activeCampaign.name}</h2>
                            </div>
                            <p className="text-slate-400 text-sm mt-1">Layout: <span className="text-purple-300 font-semibold">{layout?.name || 'Unknown'}</span></p>
                        </div>
                        <button 
                            onClick={() => onPreviewCampaign(activeCampaign)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold shadow-lg shadow-purple-900/20 transition-all hover:-translate-y-0.5"
                        >
                            <PlayCircle size={18} /> Preview Campaign
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Layout Map */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Interactive Layout Map</h3>
                            <div className="w-full aspect-video bg-slate-900 border-2 border-slate-700 rounded-xl relative overflow-hidden shadow-inner">
                                {layout?.zones.map((zone, i) => {
                                    const playlist = activeCampaign.zonePlaylists[zone.id] || [];
                                    return (
                                        <div 
                                            key={zone.id}
                                            onClick={() => onEditZone(activeCampaign.id, zone.id, playlist)}
                                            className="absolute border-2 border-slate-700 hover:border-blue-400 bg-slate-800/60 hover:bg-blue-500/20 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group"
                                            style={{
                                                left: `${zone.x}%`,
                                                top: `${zone.y}%`,
                                                width: `${zone.w}%`,
                                                height: `${zone.h}%`
                                            }}
                                        >
                                            <span className="text-white font-bold text-sm mb-1 group-hover:scale-105 transition-transform">Zone {i + 1}</span>
                                            <span className="text-xs font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded">{playlist.length} assets</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        
                        {/* Zone List */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Edit Zone Content</h3>
                            <div className="space-y-3">
                                {layout?.zones.map((zone, i) => {
                                    const playlist = activeCampaign.zonePlaylists[zone.id] || [];
                                    return (
                                        <div key={zone.id} className="bg-slate-900/80 border border-slate-700 p-4 rounded-xl flex items-center justify-between hover:border-slate-600 transition-colors">
                                            <div>
                                                <div className="text-white font-bold text-sm">Zone {i + 1}</div>
                                                <div className="text-xs text-slate-400 font-mono mt-0.5">{playlist.length} items in playlist</div>
                                            </div>
                                            <button 
                                                onClick={() => onEditZone(activeCampaign.id, zone.id, playlist)}
                                                className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                                            >
                                                <Edit2 size={13} /> Edit Zone
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-6">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800/60 p-4 rounded-xl border border-slate-700/80">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Flag size={20} className="text-amber-400" /> Campaigns ({filteredCampaigns.length})
                    </h2>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    {/* View Mode Toggle */}
                    <div className="flex items-center bg-slate-900/90 p-1 rounded-lg border border-slate-700">
                        <button
                            onClick={() => handleSetViewMode('list')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'list' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                            title="List View"
                        >
                            <List size={14} />
                            <span>List</span>
                        </button>
                        <button
                            onClick={() => handleSetViewMode('grid')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'grid' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                            title="Cards View"
                        >
                            <LayoutGrid size={14} />
                            <span>Cards</span>
                        </button>
                    </div>

                    <button 
                        onClick={() => { setIsCreating(true); setNewLayoutId(layouts[0]?.id || ''); }} 
                        className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg font-medium text-xs transition-colors shadow-lg hover:shadow-amber-500/20"
                    >
                        <Plus size={15} /> New Campaign
                    </button>
                </div>
            </div>

            {isCreating && (
                <div className="bg-slate-800/90 p-6 rounded-xl border border-slate-700 shadow-xl animate-in zoom-in-95 duration-150">
                    <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                        <Plus size={18} className="text-amber-400" /> Create Campaign
                    </h3>
                    <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                        <div>
                            <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Campaign Name</label>
                            <input required type="text" placeholder="e.g. Summer Promo" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white focus:border-amber-500 outline-none" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Assigned Layout</label>
                            <select required value={newLayoutId} onChange={e => setNewLayoutId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white focus:border-amber-500 outline-none cursor-pointer">
                                <option value="" disabled>Select Layout</option>
                                {layouts.map(l => (
                                    <option key={l.id} value={l.id}>{l.name} ({l.zones.length} Zones)</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-lg transition-colors">Cancel</button>
                            <button type="submit" className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow transition-colors">Create Campaign</button>
                        </div>
                    </form>
                </div>
            )}

            {/* 1. LIST / DATA TABLE VIEW */}
            {viewMode === 'list' && (
                <div className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[850px]">
                            <thead>
                                <tr className="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700/80 select-none">
                                    <th className="py-3.5 px-5 min-w-[240px] w-1/3">Campaign Name & Info</th>
                                    <th className="py-3.5 px-5 min-w-[280px] w-1/3">Layout Template</th>
                                    <th className="py-3.5 px-5 w-44">Total Assets</th>
                                    <th className="py-3.5 px-5 text-right w-44">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/60 text-sm">
                                {filteredCampaigns.map(campaign => {
                                    const layout = layouts.find(l => l.id === campaign.layoutId);
                                    const totalAssets = Object.values(campaign.zonePlaylists || {}).reduce((acc, p) => acc + p.length, 0);

                                    return (
                                        <tr key={campaign.id} className="hover:bg-slate-700/40 transition-colors group cursor-pointer" onClick={() => setActiveCampaignId(campaign.id)}>
                                            {/* Name & ID */}
                                            <td className="py-3.5 px-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20 shrink-0">
                                                        <Flag size={18} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-white text-sm truncate" title={campaign.name}>{campaign.name}</div>
                                                        <div className="text-xs text-slate-400 font-mono mt-0.5">ID: <span className="text-slate-300">{campaign.id}</span></div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Layout Template */}
                                            <td className="py-3.5 px-5">
                                                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-purple-950/60 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                                                    <LayoutGrid size={14} className="shrink-0" />
                                                    <span>{layout?.name || 'Unknown'} ({layout?.zones.length || 0} Zones)</span>
                                                </span>
                                            </td>

                                            {/* Total Assets */}
                                            <td className="py-3.5 px-5">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium bg-slate-900 text-slate-300 border border-slate-700 whitespace-nowrap">
                                                    <List size={13} className="text-amber-400" />
                                                    <span>{totalAssets} {totalAssets === 1 ? 'Asset' : 'Assets'}</span>
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3.5 px-5 text-right">
                                                <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                                                    <button 
                                                        onClick={() => onPreviewCampaign(campaign)} 
                                                        className="p-1.5 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white rounded-lg transition-colors"
                                                        title="Live Preview Campaign"
                                                    >
                                                        <PlayCircle size={15} />
                                                    </button>
                                                    <button 
                                                        onClick={() => setActiveCampaignId(campaign.id)}
                                                        className="p-1.5 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white rounded-lg transition-colors"
                                                        title="Design / Edit Zone Playlists"
                                                    >
                                                        <Edit2 size={15} />
                                                    </button>
                                                    <button 
                                                        onClick={(e) => handleDelete(e, campaign.id)} 
                                                        className="p-1.5 bg-slate-700/60 hover:bg-red-900/60 text-slate-400 hover:text-red-300 rounded-lg transition-colors"
                                                        title="Delete Campaign"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredCampaigns.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-12 text-center text-slate-500">
                                            <Flag size={40} className="mx-auto mb-2 opacity-20" />
                                            <p>No campaigns match your search.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 2. CARD / GRID VIEW */}
            {viewMode === 'grid' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredCampaigns.map(campaign => {
                        const layout = layouts.find(l => l.id === campaign.layoutId);
                        const totalAssets = Object.values(campaign.zonePlaylists || {}).reduce((acc, p) => acc + p.length, 0);

                        return (
                            <div key={campaign.id} className="bg-slate-800/80 p-6 rounded-xl border border-slate-700 hover:border-amber-500 transition-colors cursor-pointer group h-full flex flex-col shadow-lg" onClick={() => setActiveCampaignId(campaign.id)}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                                            <Flag size={22} />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-white text-base leading-tight truncate" title={campaign.name}>{campaign.name}</h3>
                                            <span className="text-xs text-slate-400 font-mono truncate block mt-0.5">ID: {campaign.id}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-6 text-xs text-slate-400">
                                    <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                                        <span>Layout:</span>
                                        <span className="text-purple-300 font-semibold">{layout?.name || 'Unknown'}</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                                        <span>Zones & Media:</span>
                                        <span className="text-amber-300 font-mono">{layout?.zones.length || 0} Zones • {totalAssets} Assets</span>
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-auto">
                                    <button onClick={(e) => { e.stopPropagation(); onPreviewCampaign(campaign); }} className="p-2 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white rounded-lg transition-colors" title="Preview">
                                        <PlayCircle size={16} />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); setActiveCampaignId(campaign.id); }} className="flex-1 py-2 bg-amber-600/15 hover:bg-amber-600 text-amber-400 hover:text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all border border-amber-500/20 hover:border-transparent flex items-center justify-center gap-2">
                                        <Edit2 size={13} /> Design
                                    </button>
                                    <button onClick={(e) => handleDelete(e, campaign.id)} className="p-2 bg-slate-700/60 hover:bg-red-900/60 text-slate-400 hover:text-red-300 rounded-lg transition-colors" title="Delete">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {filteredCampaigns.length === 0 && (
                        <div className="col-span-full text-center py-12 text-slate-500">
                            <Flag size={48} className="mx-auto mb-4 opacity-20" />
                            <p>No campaigns match your search.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
