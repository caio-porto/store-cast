import React from 'react';
import { server, safeStorage } from '../services/server';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    name?: string;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: any;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true, error };
    }

    componentDidMount() {
        const componentName = this.props.name || 'App';
        
        window.addEventListener('beforeunload', () => {
            const deviceId = safeStorage.getItem('storecast_device_id');
            if (deviceId) {
                server.sendDeviceLogs(deviceId, [`[${componentName}] beforeunload: Page is reloading/closing`]).catch(() => {});
            }
        });

        window.onerror = (msg, url, line, col, error) => {
            const deviceId = safeStorage.getItem('storecast_device_id');
            if (deviceId) {
                const log = `GLOBAL ERR [${componentName}]: ${msg} at ${line}:${col}`;
                server.sendDeviceLogs(deviceId, [log]).catch(console.error);
            }
        };

        window.onunhandledrejection = (event) => {
            const deviceId = safeStorage.getItem('storecast_device_id');
            if (deviceId) {
                const log = `UNHANDLED PROMISE [${componentName}]: ${event.reason}`;
                server.sendDeviceLogs(deviceId, [log]).catch(console.error);
            }
        };
    }

    componentDidCatch(error: any, info: any) {
        const componentName = this.props.name || 'App';
        const errStr = error?.toString() || 'Unknown Error';
        const stack = info?.componentStack?.substring(0, 200) || '';
        const msg = `CRASH [${componentName}]: ${errStr} | Stack: ${stack}`;
        console.error(msg);

        const deviceId = safeStorage.getItem('storecast_device_id');
        if (deviceId) {
            server.sendDeviceLogs(deviceId, [msg]).catch(console.error);
        }

        // Auto-recover from "Script error." or any crash with a loop-protector
        const now = Date.now();
        const lastCrash = parseInt(safeStorage.getItem('storecast_last_crash_time') || '0');
        const crashCount = parseInt(sessionStorage.getItem('storecast_crash_loop_count') || '0');

        // If we crashed very recently (within 30s), increment loop count
        const newCount = (now - lastCrash < 30000) ? crashCount + 1 : 1;
        sessionStorage.setItem('storecast_crash_loop_count', newCount.toString());
        safeStorage.setItem('storecast_last_crash_time', now.toString());

        // Exponential backoff for reload loops (15s, 30s, 60s) to allow video buffering & setup to complete
        const delay = newCount > 3 ? 60000 : (newCount > 1 ? 30000 : 15000);
        
        console.warn(`[${componentName}] App crash recovery triggered (Count: ${newCount}). Waiting ${delay / 1000}s before reloading...`);
        setTimeout(() => {
            window.location.reload();
        }, delay);
    }

    render() {
        if (this.state.hasError) {
            const errStr = this.state.error?.toString() || '';
            const isScriptError = errStr.includes('Script error.') || this.state.error?.message === 'Script error.';

            if (isScriptError) {
                return (
                    <div className="h-screen w-full bg-black flex items-center justify-center">
                        <Loader2 className="animate-spin text-slate-700" />
                    </div>
                );
            }

            return (
                <div className="h-screen w-full bg-[#0f172a] flex flex-col items-center justify-center text-white p-8 text-center">
                    <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
                    <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
                    <p className="text-slate-400 text-sm mb-4">The application encountered an error and is trying to recover.</p>
                    <p className="text-slate-600 text-xs font-mono">{errStr.substring(0, 100)}</p>
                </div>
            );
        }
        return this.props.children;
    }
}
