
import React, { useState, useEffect } from 'react';
import { Shield, RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { auth } from '../firebase';
import LoadingSpinner from './LoadingSpinner';

interface ConfigItem {
  configured: boolean;
  value: string;
}

interface ConfigStatus {
  [key: string]: ConfigItem;
}

const ConfigRow: React.FC<{
  name: string;
  info: ConfigItem;
  onUpdate: (key: string, value: string) => Promise<void>;
}> = ({ name, info, onUpdate }) => {
  const [value, setValue] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showInput, setShowInput] = useState(false);

  const handleUpdate = async () => {
    if (!value.trim()) return;
    setIsUpdating(true);
    try {
      await onUpdate(name, value);
      setValue('');
      setShowInput(false);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="p-4 hover:bg-slate-50 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div>
          <code className="text-sm font-black text-[#3b1464]">{name}</code>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">System Configuration</p>
        </div>
        <div className="flex items-center gap-2">
          {info.configured ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-wider">Configured ✓</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 rounded-full border border-red-200">
              <XCircle className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-wider">Missing ✗</span>
            </div>
          )}
          <button
            onClick={() => setShowInput(!showInput)}
            className="text-[10px] font-bold text-slate-500 hover:text-slate-900 uppercase tracking-widest border border-slate-200 px-2 py-1 rounded hover:bg-white transition-all"
          >
            {showInput ? 'Cancel' : 'Update'}
          </button>
        </div>
      </div>

      {showInput && (
        <div className="mt-3 flex gap-2 animate-in fade-in slide-in-from-top-1">
          <input
            type={name.includes('SECRET') || name.includes('KEY') || name.includes('PASS') ? 'password' : 'text'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`Enter new ${name}...`}
            className="flex-1 text-xs p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#3b1464] outline-none"
          />
          <button
            onClick={handleUpdate}
            disabled={isUpdating || !value.trim()}
            className="px-4 py-2 bg-[#3b1464] text-white text-[10px] font-black uppercase tracking-widest rounded-lg border border-slate-200 hover:bg-[#2e1065] disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {isUpdating ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
};

const SystemConfigPanel: React.FC = () => {
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchConfig = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/system-config', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch configuration status');
      }

      const data = await response.json();
      setConfig(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateConfig = async (key: string, value: string) => {
    setError(null);
    setSuccess(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/system-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ key, value })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update configuration');
      }

      setSuccess(`Successfully updated ${key}`);
      setTimeout(() => setSuccess(null), 3000);
      await fetchConfig();
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  if (isLoading) return <div className="p-12 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#3b1464]" />
            System Configuration
          </h2>
          <p className="text-slate-500 font-medium font-sans">
            Manage environment variables and integration secrets securely.
          </p>
        </div>
        <button
          onClick={fetchConfig}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors border border-slate-200"
          title="Refresh status"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded text-red-700 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded text-emerald-700 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-bold">{success}</p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <h3 className="font-black text-slate-900 uppercase tracking-wider text-xs">Variables & Secrets</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {config && Object.entries(config).map(([key, info]) => (
            <ConfigRow
              key={key}
              name={key}
              info={info}
              onUpdate={handleUpdateConfig}
            />
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
        <h4 className="text-sm font-black text-blue-900 uppercase tracking-wider">Administrator Controls</h4>
        <p className="text-xs text-blue-800 leading-relaxed font-medium font-sans">
          Update system-level variables here to avoid using the platform's public environment configuration.
          Changes are stored securely in Firestore and take priority over <code className="bg-blue-100 px-1 rounded">.env</code> values.
          <strong> Note:</strong> Some changes may require a server restart to take full effect in all modules.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <h4 className="font-black text-slate-900 uppercase tracking-wider text-xs mb-2">Platform Verification</h4>
          <ul className="text-xs text-slate-600 space-y-2 font-medium font-sans">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 font-bold">•</span>
              Secrets are server-side only
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 font-bold">•</span>
              No secrets in client bundles
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 font-bold">•</span>
              Protected admin-only access
            </li>
          </ul>
        </div>
        <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <h4 className="font-black text-slate-900 uppercase tracking-wider text-xs mb-2">Integration Health</h4>
          <ul className="text-xs text-slate-600 space-y-2 font-medium font-sans">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold">•</span>
              ELMS Gateway: {config?.ELMS_SHARED_SECRET?.configured ? 'Active' : 'Inactive'}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold">•</span>
              AI Pipeline: {config?.GEMINI_API_KEY?.configured ? 'Active' : 'Ready'}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SystemConfigPanel;
