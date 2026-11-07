import React, { useState, useEffect } from 'react';
import { Playlist, Asset } from '../types';
import { server, safeStorage } from '../services/server';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Edit2 from 'lucide-react/dist/esm/icons/edit-2';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Copy from 'lucide-react/dist/esm/icons/copy';
import List from 'lucide-react/dist/esm/icons/list';
import LayoutGrid from 'lucide-react/dist/esm/icons/layout-grid';
import { ContentEditor } from './ContentEditor';

export const PlaylistList: React.FC<{ filterQuery?: string }> = ({ filterQuery = '' }) => {
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);

    const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
        try {
            return (safeStorage.getItem('storecast_playlist_view_mode') as 'list' | 'grid') || 'list';
        } catch (e) {
            return 'list';
        }
    });

    const handleSetViewMode = (mode: 'list' | 'grid') => {
        setViewMode(mode);
        try { safeStorage.setItem('storecast_playlist_view_mode', mode); } catch (e) {}
    };

    useEffect(() => {
        const sub = server.subscribe(() => {
            setPlaylists(server.getAllSavedPlaylists());
        });
        server.fetchSavedPlaylists();
        return sub;
    }, []);

    const handleCreate = async () => {
        const name = prompt('Playlist Name:');
        if (!name) return;
        const res = await server.createSavedPlaylist(name, []);
        if (res.success && res.playlist) {
            setEditingPlaylist(res.playlist);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm('Delete this playlist?')) {
            const res = await server.deleteSavedPlaylist(id);
            if (!res?.success) {
                alert(res?.message || 'Failed to delete playlist');
            }
        }
    };

    const handleDuplicate = async (e: React.MouseEvent, p: Playlist) => {
        e.preventDefault();
        e.stopPropagation();
        const res = await server.createSavedPlaylist(`${p.name} (Copy)`, p.assets);
        if (!res.success) alert('Failed to duplicate');
    };

    // Filter and Sort
    const filteredPlaylists = playlists
        .filter(p => p.name.toLowerCase().includes(filterQuery.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));

    if (editingPlaylist) {
        return (
            <ContentEditor
                title={`Editing Playlist: ${editingPlaylist.name}`}
                subTitle={`${editingPlaylist.assets.length} items`}
                initialAssets={editingPlaylist.assets}
                onSave={async (assets) => {
                    await server.updateSavedPlaylist(editingPlaylist.id, undefined, assets);
                }}
                onSaveOverlay={() => {}} // Playlists don't have overlays
                onBack={() => setEditingPlaylist(null)}
            />
        );
    }

    return (
        <div className="animate-fade-in space-y-6">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800/60 p-4 rounded-xl border border-slate-700/80">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <List size={20} className="text-indigo-400" /> Playlists ({filteredPlaylists.length})
                    </h2>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    {/* View Mode Toggle */}
                    <div className="flex items-center bg-slate-900/90 p-1 rounded-lg border border-slate-700">
                        <button
                            onClick={() => handleSetViewMode('list')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                            title="List View"
                        >
                            <List size={14} />
                            <span>List</span>
                        </button>
                        <button
                            onClick={() => handleSetViewMode('grid')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                            title="Cards View"
                        >
                            <LayoutGrid size={14} />
                            <span>Cards</span>
                        </button>
                    </div>

                    <button 
                        onClick={handleCreate} 
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium text-xs transition-colors shadow-lg hover:shadow-indigo-500/20"
                    >
                        <Plus size={15} /> New Playlist
                    </button>
                </div>
            </div>

            {/* 1. LIST / DATA TABLE VIEW */}
            {viewMode === 'list' && (
                <div className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[700px]">
                            <thead>
                                <tr className="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700/80 select-none">
                                    <th className="py-3.5 px-6 min-w-[260px]">Playlist Name & Info</th>
                                    <th className="py-3.5 px-6 w-56">Total Media Items</th>
                                    <th className="py-3.5 px-6 text-right w-44">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/60 text-sm">
                                {filteredPlaylists.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-700/40 transition-colors group cursor-pointer" onClick={() => setEditingPlaylist(p)}>
                                        {/* Name & ID */}
                                        <td className="py-3.5 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 shrink-0">
                                                    <List size={18} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-white text-sm truncate" title={p.name}>{p.name}</div>
                                                    <div className="text-xs text-slate-400 font-mono mt-0.5">ID: <span className="text-slate-300">{p.id}</span></div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Slides / Items Count */}
                                        <td className="py-3.5 px-6">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-indigo-950/60 text-indigo-300 border border-indigo-500/30 whitespace-nowrap">
                                                <span>{p.assets.length} {p.assets.length === 1 ? 'Slide' : 'Slides'}</span>
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td className="py-3.5 px-6 text-right">
                                            <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                                                <button 
                                                    onClick={() => setEditingPlaylist(p)} 
                                                    className="p-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg transition-colors"
                                                    title="Manage Content / Slides"
                                                >
                                                    <Edit2 size={15} />
                                                </button>
                                                <button 
                                                    onClick={(e) => handleDuplicate(e, p)} 
                                                    className="p-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                                                    title="Duplicate Playlist"
                                                >
                                                    <Copy size={15} />
                                                </button>
                                                <button 
                                                    onClick={(e) => handleDelete(e, p.id)} 
                                                    className="p-1.5 bg-slate-700/60 hover:bg-red-900/60 text-slate-400 hover:text-red-300 rounded-lg transition-colors"
                                                    title="Delete Playlist"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredPlaylists.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="py-12 text-center text-slate-500">
                                            <List size={40} className="mx-auto mb-2 opacity-20" />
                                            <p>No saved playlists match your search.</p>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredPlaylists.map(p => (
                        <div key={p.id} className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden hover:border-indigo-500/50 transition-all group flex flex-col h-full shadow-lg">
                            <div className="p-5 flex-1">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="bg-indigo-500/10 p-2.5 rounded-xl text-indigo-400 border border-indigo-500/20">
                                        <List size={22} />
                                    </div>
                                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => handleDuplicate(e, p)} className="p-1.5 bg-slate-700/60 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors" title="Duplicate">
                                            <Copy size={14} />
                                        </button>
                                        <button onClick={(e) => handleDelete(e, p.id)} className="p-1.5 bg-slate-700/60 hover:bg-red-900/60 rounded-lg text-slate-400 hover:text-red-300 transition-colors" title="Delete">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                <h3 className="text-base font-bold text-white mb-1 leading-tight truncate" title={p.name}>{p.name}</h3>
                                <div className="text-slate-400 text-xs flex items-center gap-2 mt-2">
                                    <span className="bg-indigo-950/60 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded text-[11px] font-mono font-bold">
                                        {p.assets.length} Slides
                                    </span>
                                    <span className="text-[11px] text-slate-500 font-mono">ID: {p.id}</span>
                                </div>
                            </div>
                            <div className="p-3 bg-slate-900/50 border-t border-slate-700 mt-auto">
                                <button onClick={() => setEditingPlaylist(p)} className="w-full py-2 bg-indigo-600/15 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg font-bold transition-all text-xs uppercase tracking-wider border border-indigo-500/20 hover:border-transparent flex items-center justify-center gap-1.5">
                                    <Edit2 size={13} /> Manage Content
                                </button>
                            </div>
                        </div>
                    ))}

                    {filteredPlaylists.length === 0 && (
                        <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-800 rounded-2xl bg-slate-800/10">
                            <List size={40} className="mx-auto mb-2 opacity-20" />
                            <p className="text-slate-500">No saved playlists match your search.</p>
                            {playlists.length === 0 && <button onClick={handleCreate} className="mt-3 text-indigo-400 hover:text-indigo-300 font-medium text-xs">Create your first playlist &rarr;</button>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
