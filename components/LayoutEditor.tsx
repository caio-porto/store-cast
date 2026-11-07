import React, { useState } from 'react';
import { Layout, LayoutZone } from '../types';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Plus from 'lucide-react/dist/esm/icons/plus';

interface LayoutEditorProps {
    layout: Layout | null;
    onSave: (name: string, zones: LayoutZone[]) => void;
    onCancel: () => void;
}

const PRESETS = [
    { name: 'Fullscreen', zones: [{ id: 'z1', x: 0, y: 0, w: 100, h: 100 }] },
    { name: 'Split Vertical', zones: [{ id: 'z1', x: 0, y: 0, w: 50, h: 100 }, { id: 'z2', x: 50, y: 0, w: 50, h: 100 }] },
    { name: 'Split Horizontal', zones: [{ id: 'z1', x: 0, y: 0, w: 100, h: 50 }, { id: 'z2', x: 0, y: 50, w: 100, h: 50 }] },
    { name: 'Sidebar Right', zones: [{ id: 'z1', x: 0, y: 0, w: 75, h: 100 }, { id: 'z2', x: 75, y: 0, w: 25, h: 100 }] },
    { name: 'Banner Bottom', zones: [{ id: 'z1', x: 0, y: 0, w: 100, h: 80 }, { id: 'z2', x: 0, y: 80, w: 100, h: 20 }] }
];

export const LayoutEditor: React.FC<LayoutEditorProps> = ({ layout, onSave, onCancel }) => {
    const [name, setName] = useState(layout?.name || '');
    const [zones, setZones] = useState<LayoutZone[]>(layout?.zones || PRESETS[0].zones);

    const applyPreset = (presetZones: any[]) => {
        setZones(presetZones.map((z, i) => ({ ...z, id: `z${Date.now()}+${i}` })));
    };

    const handleZoneChange = (id: string, field: keyof LayoutZone, value: string) => {
        const val = parseFloat(value) || 0;
        setZones(zones.map(z => z.id === id ? { ...z, [field]: val } : z));
    };

    const addZone = () => {
        setZones([...zones, { id: `z${Date.now()}`, x: 0, y: 0, w: 50, h: 50 }]);
    };

    const removeZone = (id: string) => {
        setZones(zones.filter(z => z.id !== id));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(name, zones);
    };

    return (
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 w-full max-w-4xl mx-auto">
            <h2 className="text-xl font-bold text-white mb-6">{layout ? 'Edit Layout' : 'Create Layout'}</h2>
            
            <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-8">
                {/* Left Side: Preview */}
                <div className="flex-1">
                    <label className="text-xs text-slate-400 uppercase font-bold block mb-2">Preview</label>
                    <div className="w-full aspect-video bg-slate-900 border-2 border-slate-700 rounded-lg relative overflow-hidden">
                        {zones.map((zone, i) => (
                            <div 
                                key={zone.id}
                                className="absolute border-2 border-blue-500 bg-blue-500/20 flex items-center justify-center text-blue-300 font-bold font-mono text-sm shadow-inner transition-all duration-300"
                                style={{
                                    left: `${zone.x}%`,
                                    top: `${zone.y}%`,
                                    width: `${zone.w}%`,
                                    height: `${zone.h}%`
                                }}
                            >
                                Zone {i + 1}
                            </div>
                        ))}
                    </div>

                    <div className="mt-4">
                        <label className="text-xs text-slate-400 uppercase font-bold block mb-2">Presets</label>
                        <div className="flex flex-wrap gap-2">
                            {PRESETS.map((p, i) => (
                                <button key={i} type="button" onClick={() => applyPreset(p.zones)} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-white transition-colors">
                                    {p.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Side: Configuration */}
                <div className="flex-1 space-y-4">
                    <div>
                        <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Layout Name</label>
                        <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:border-blue-500 outline-none" />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs text-slate-400 uppercase font-bold">Zones</label>
                            <button type="button" onClick={addZone} className="text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 px-2 py-1 rounded flex items-center gap-1">
                                <Plus size={14} /> Add Zone
                            </button>
                        </div>
                        
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                            {zones.map((zone, i) => (
                                <div key={zone.id} className="bg-slate-900 border border-slate-700 p-3 rounded-lg flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-slate-500 w-6">{i + 1}</span>
                                    <div className="grid grid-cols-4 gap-2 flex-1">
                                        <div>
                                            <label className="text-[10px] text-slate-500 block">X (%)</label>
                                            <input type="number" min="0" max="100" value={zone.x} onChange={e => handleZoneChange(zone.id, 'x', e.target.value)} className="w-full bg-slate-800 rounded px-2 py-1 text-xs text-white outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 block">Y (%)</label>
                                            <input type="number" min="0" max="100" value={zone.y} onChange={e => handleZoneChange(zone.id, 'y', e.target.value)} className="w-full bg-slate-800 rounded px-2 py-1 text-xs text-white outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 block">W (%)</label>
                                            <input type="number" min="0" max="100" value={zone.w} onChange={e => handleZoneChange(zone.id, 'w', e.target.value)} className="w-full bg-slate-800 rounded px-2 py-1 text-xs text-white outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 block">H (%)</label>
                                            <input type="number" min="0" max="100" value={zone.h} onChange={e => handleZoneChange(zone.id, 'h', e.target.value)} className="w-full bg-slate-800 rounded px-2 py-1 text-xs text-white outline-none" />
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => removeZone(zone.id)} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded mt-3">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-slate-700">
                        <button type="button" onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
                        <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium">Save Layout</button>
                    </div>
                </div>
            </form>
        </div>
    );
};
