import React, { useState, useEffect } from 'react';
import { Layout } from '../types';
import { server } from '../services/server';
import { LayoutEditor } from './LayoutEditor';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Edit2 from 'lucide-react/dist/esm/icons/edit-2';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import LayoutGrid from 'lucide-react/dist/esm/icons/layout-grid';

export const LayoutList = ({ filterQuery = '' }: { filterQuery?: string }) => {
    const [layouts, setLayouts] = useState<Layout[]>([]);
    const [editingLayout, setEditingLayout] = useState<Layout | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const fetchLayouts = () => {
        setLayouts([...server.getAllLayouts()]);
    };

    useEffect(() => {
        fetchLayouts();
        const unsub = server.subscribe(() => {
            fetchLayouts();
        });
        return unsub;
    }, []);

    const handleSave = async (name: string, zones: any[]) => {
        if (editingLayout) {
            await server.updateLayout(editingLayout.id, name, zones);
        } else {
            await server.createLayout(name, zones);
        }
        setEditingLayout(null);
        setIsCreating(false);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Delete this layout? Any campaigns using it will break.')) {
            await server.deleteLayout(id);
        }
    };

    // Filter and Sort
    const filteredLayouts = layouts
        .filter(l => l.name.toLowerCase().includes(filterQuery.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));

    if (isCreating || editingLayout) {
        return (
            <div className="animate-fade-in">
                <LayoutEditor 
                    layout={editingLayout} 
                    onSave={handleSave} 
                    onCancel={() => { setEditingLayout(null); setIsCreating(false); }} 
                />
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <div className="flex justify-end mb-6">
                <button onClick={() => setIsCreating(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-lg">
                    <Plus size={16} /> New Layout
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredLayouts.map(layout => (
                    <div key={layout.id} className="bg-slate-800 p-6 rounded-xl border border-slate-700 relative group h-full flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                                    <LayoutGrid size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-lg leading-tight">{layout.name}</h3>
                                    <span className="text-xs text-slate-400">{layout.zones.length} Zones</span>
                                </div>
                            </div>
                        </div>

                        {/* Mini Preview */}
                        <div className="w-full aspect-video bg-slate-900 border border-slate-700/50 rounded overflow-hidden relative mb-4">
                            {layout.zones.map((zone, i) => (
                                <div 
                                    key={zone.id}
                                    className="absolute border border-blue-500/50 bg-blue-500/10"
                                    style={{
                                        left: `${zone.x}%`,
                                        top: `${zone.y}%`,
                                        width: `${zone.w}%`,
                                        height: `${zone.h}%`
                                    }}
                                />
                            ))}
                        </div>

                        <div className="flex gap-2 mt-auto">
                            {!layout.isSystem && (
                                <>
                                    <button onClick={() => setEditingLayout(layout)} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white font-medium transition-colors flex items-center justify-center gap-2">
                                        <Edit2 size={14} /> Edit
                                    </button>
                                    <button onClick={() => handleDelete(layout.id)} className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </>
                            )}
                            {layout.isSystem && (
                                <div className="flex-1 py-2 bg-slate-800/50 rounded-lg text-sm text-slate-500 font-medium text-center border border-slate-700 border-dashed">
                                    System Default
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {filteredLayouts.length === 0 && (
                    <div className="col-span-full text-center py-12 text-slate-500">
                        <LayoutGrid size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No layouts match your search.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
