import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { User } from '../types';
import { Search, Users, CheckSquare, Square, Check, Info } from 'lucide-react';

interface NotificationManagementPanelProps {
  allUsers?: User[];
  currentUser?: User;
}

const NotificationManagementPanel: React.FC<NotificationManagementPanelProps> = ({ allUsers = [], currentUser }) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [recipientMode, setRecipientMode] = useState<'all' | 'specific'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [type, setType] = useState<'info' | 'poll'>('info');
  const [pollOptions, setPollOptions] = useState('');

  const sendNotification = async () => {
    try {
      if (!title.trim() || !message.trim()) {
        setStatus('Title and message are required.');
        return;
      }

      if (recipientMode === 'specific' && selectedUserIds.length === 0) {
        setStatus('Please select at least one recipient user.');
        return;
      }

      if (recipientMode === 'all') {
        await addDoc(collection(db, 'notifications'), {
          title: title.trim(),
          message: message.trim(),
          userId: 'all',
          isRead: false,
          createdAt: serverTimestamp(),
          type,
          pollOptions: type === 'poll' ? pollOptions.split(',').map(o => o.trim()).filter(o => o !== '') : undefined
        });
      } else {
        // Create a notification for each specific user
        const notificationPromises = selectedUserIds.map((userId) => {
          return addDoc(collection(db, 'notifications'), {
            title: title.trim(),
            message: message.trim(),
            userId: userId,
            isRead: false,
            createdAt: serverTimestamp(),
            type,
            pollOptions: type === 'poll' ? pollOptions.split(',').map(o => o.trim()).filter(o => o !== '') : undefined
          });
        });
        await Promise.all(notificationPromises);
      }

      setStatus(`Notification sent successfully to ${recipientMode === 'all' ? 'all users' : `${selectedUserIds.length} user(s)`}!`);
      setTitle('');
      setMessage('');
      setType('info');
      setPollOptions('');
      setSelectedUserIds([]);
    } catch (err) {
      setStatus('Error sending notification.');
      console.error(err);
    }
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredUsers.map(u => u.id);
    const allFilteredSelected = filteredIds.every(id => selectedUserIds.includes(id));

    if (allFilteredSelected) {
      setSelectedUserIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedUserIds(prev => {
        const union = new Set([...prev, ...filteredIds]);
        return Array.from(union);
      });
    }
  };

  // Filter users by search query
  const filteredUsers = allUsers.filter(user => {
    const term = searchQuery.toLowerCase();
    return (
      user.name?.toLowerCase().includes(term) ||
      user.email?.toLowerCase().includes(term) ||
      user.role?.toLowerCase().includes(term) ||
      user.schoolName?.toLowerCase().includes(term)
    );
  });

  return (
  <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-fade-in">
    <div className="border-b border-slate-200 pb-4">
      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
        <Users className="text-emerald-600 h-6 w-6" />
        Send Direct Notification
      </h3>
      <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mt-1">
        Broadcast system alerts, announcements or interactive quick polls
      </p>
    </div>

    <div className="space-y-4">
      <div>
        <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">
          Notification Title <span className="text-red-500">*</span>
        </label>
        <input 
          type="text" 
          placeholder="e.g., Scheduled System Maintenance" 
          value={title} 
          onChange={(e) => setTitle(e.target.value)} 
          className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold outline-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all" 
        />
      </div>

      <div>
        <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">
          Detailed Message <span className="text-red-500">*</span>
        </label>
        <textarea 
          placeholder="Type your announcement or poll description here..." 
          value={message} 
          onChange={(e) => setMessage(e.target.value)} 
          rows={3}
          className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold outline-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all resize-none" 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">
            Notification Type
          </label>
          <select 
            value={type} 
            onChange={(e) => setType(e.target.value as 'info' | 'poll')} 
            className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold bg-white outline-none"
          >
            <option value="info">📢 Information / Announcement</option>
            <option value="poll">📊 Interactive Survey Poll</option>
          </select>
        </div>

        {type === 'poll' && (
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">
              Poll Options (comma separated) <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              placeholder="e.g., Strongly Agree, Agree, Disagree" 
              value={pollOptions} 
              onChange={(e) => setPollOptions(e.target.value)} 
              className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold outline-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all" 
            />
          </div>
        )}
      </div>

      {/* Recipient Mode Selection Toggle */}
      <div className="space-y-3">
        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
          Recipient Target Audience
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRecipientMode('all')}
            className={`flex-1 py-3 px-4 rounded-xl border border-slate-200 font-black uppercase text-xs tracking-wider transition-all duration-200 ${
              recipientMode === 'all'
                ? 'bg-emerald-600 text-white shadow-[2px_2px_0px_rgba(0,0,0,1)]'
                : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            All Users (Public)
          </button>
          <button
            type="button"
            onClick={() => setRecipientMode('specific')}
            className={`flex-1 py-3 px-4 rounded-xl border border-slate-200 font-black uppercase text-xs tracking-wider transition-all duration-200 ${
              recipientMode === 'specific'
                ? 'bg-indigo-600 text-white shadow-[2px_2px_0px_rgba(0,0,0,1)]'
                : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Select Specific Users ({selectedUserIds.length})
          </button>
        </div>
      </div>

      {/* Specific User Selector Section */}
      {recipientMode === 'specific' && (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 animate-fade-in">
          <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-col sm:flex-row gap-2 justify-between items-center">
            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search size={14} className="text-slate-400" />
              </span>
              <input
                type="text"
                placeholder="Search user name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold outline-none bg-white"
              />
            </div>
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="text-[10px] font-black uppercase tracking-wider text-indigo-700 hover:underline shrink-0"
            >
              {filteredUsers.map(u => u.id).every(id => selectedUserIds.includes(id)) && filteredUsers.length > 0
                ? 'Deselect All'
                : 'Select All Filtered'}
            </button>
          </div>

          <div className="max-h-52 overflow-y-auto p-2 space-y-1 scrollbar-thin">
            {filteredUsers.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-4">No matching users found.</p>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = selectedUserIds.includes(user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleToggleUser(user.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-all text-left ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-black'
                        : 'bg-white border-slate-200 hover:border-slate-200 text-slate-700 font-bold'
                    }`}
                  >
                    <div className="truncate pr-4">
                      <div className="text-xs truncate">{user.name || 'Anonymous User'}</div>
                      <div className="text-[9px] text-slate-400 truncate font-mono">{user.email}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[8px] px-1.5 py-0.5 rounded border ${
                        user.role === 'Admin' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                        user.role === 'School Admin' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                        user.role === 'Teacher' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                        'bg-blue-50 text-blue-800 border-blue-200'
                      }`}>
                        {user.role}
                      </span>
                      {isSelected ? (
                        <CheckSquare size={16} className="text-indigo-600" />
                      ) : (
                        <Square size={16} className="text-slate-300" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {status && (
        <div className={`p-4 rounded-xl border border-slate-200 text-xs font-bold uppercase tracking-tight flex items-center gap-2 ${
          status.includes('successfully') ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
        }`}>
          <Info size={16} className="shrink-0" />
          <span>{status}</span>
        </div>
      )}

      <button 
        onClick={sendNotification} 
        className="w-full py-3.5 bg-black hover:bg-slate-900 text-white rounded-xl font-black uppercase tracking-wider transition-all duration-200 shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none"
      >
        Send Notification
      </button>
    </div>
  </div>
  );
};

export default NotificationManagementPanel;
