import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../firebaseUtils';
import { User } from '../types';
import { 
  Plus, 
  Trash2, 
  BarChart2, 
  MessageSquare, 
  PlusCircle, 
  CheckCircle2, 
  AlertCircle,
  Search,
  Users,
  CheckSquare,
  Square
} from 'lucide-react';

interface Poll {
  id: string;
  title: string;
  message: string;
  options: string[];
  votes: { [key: string]: number };
  voters: string[];
  createdAt: any;
  createdBy: string;
  targetUsers?: 'all' | string[];
}

interface PollsManagementPanelProps {
  allUsers?: User[];
  currentUser?: User;
}

const PollsManagementPanel: React.FC<PollsManagementPanelProps> = ({ allUsers = [], currentUser }) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']); // Start with 2 empty options
  const [recipientMode, setRecipientMode] = useState<'all' | 'specific'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [isLoadingPolls, setIsLoadingPolls] = useState(true);
  const [responses, setResponses] = useState<any[]>([]);

  // Fetch existing polls in real-time
  useEffect(() => {
    if (!auth.currentUser) {
      console.log("No user signed in, skipping polls listener");
      setIsLoadingPolls(false);
      return;
    }
    
    console.log("Starting polls listener for user:", auth.currentUser.uid);
    const pollsRef = collection(db, 'polls');
    console.log("Querying collection path:", pollsRef.path);
    const q = query(pollsRef);
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log("Polls snapshot received successfully. Count:", snapshot.size);
        const fetchedPolls: Poll[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          fetchedPolls.push({
            id: doc.id,
            title: data.title || '',
            message: data.message || '',
            options: data.options || [],
            votes: data.votes || {},
            voters: data.voters || [],
            createdAt: data.createdAt,
            createdBy: data.createdBy || '',
            targetUsers: data.targetUsers || 'all'
          });
        });
        
        // Sort manually to avoid index requirements while debugging
        fetchedPolls.sort((a, b) => {
          const timeA = (a.createdAt as any)?.seconds || 0;
          const timeB = (b.createdAt as any)?.seconds || 0;
          return timeB - timeA;
        });
        
        setPolls(fetchedPolls);
        setIsLoadingPolls(false);
      },
      (error) => {
        console.error('Error listening to polls:', error);
        setIsLoadingPolls(false);
        handleFirestoreError(error, OperationType.LIST, 'polls');
      }
    );
    
    return () => unsubscribe();
  }, []);

  // Fetch poll responses in real-time to compute accurate votes on-the-fly
  useEffect(() => {
    if (!auth.currentUser) return;
    
    console.log("Starting poll_responses listener");
    const responsesRef = collection(db, 'poll_responses');
    console.log("Querying responses path:", responsesRef.path);
    const q = query(responsesRef);
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log("Poll responses snapshot received successfully. Count:", snapshot.size);
        const fetchedResponses: any[] = [];
        snapshot.forEach((doc) => {
          fetchedResponses.push({ id: doc.id, ...doc.data() });
        });
        setResponses(fetchedResponses);
      },
      (error) => {
        console.error('Error listening to poll responses:', error);
        handleFirestoreError(error, OperationType.LIST, 'poll_responses');
      }
    );

    return () => unsubscribe();
  }, []);

  const handleAddOption = () => {
    if (options.length < 4) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear status
    setStatus(null);

    // Validation
    if (!title.trim()) {
      setStatus({ type: 'error', text: 'Notification title is required.' });
      return;
    }
    if (!message.trim()) {
      setStatus({ type: 'error', text: 'Notification message / poll question is required.' });
      return;
    }

    const filteredOptions = options.map(opt => opt.trim()).filter(opt => opt !== '');
    if (filteredOptions.length < 2) {
      setStatus({ type: 'error', text: 'At least 2 non-empty poll options are required.' });
      return;
    }

    if (recipientMode === 'specific' && selectedUserIds.length === 0) {
      setStatus({ type: 'error', text: 'Please select at least one recipient user.' });
      return;
    }

    setIsSubmitting(true);

    try {
      // Initialize votes object with 0 for each option
      const initialVotes: { [key: string]: number } = {};
      filteredOptions.forEach(opt => {
        initialVotes[opt] = 0;
      });

      // Save to Firestore polls collection
      const pollDocRef = await addDoc(collection(db, 'polls'), {
        title: title.trim(),
        message: message.trim(),
        options: filteredOptions,
        votes: initialVotes,
        voters: [],
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.email || auth.currentUser?.uid || 'Admin',
        targetUsers: recipientMode === 'all' ? 'all' : selectedUserIds
      });

      // Also auto-propagate to notifications collection so users receive a notification popup
      if (recipientMode === 'all') {
        await addDoc(collection(db, 'notifications'), {
          title: `New Poll: ${title.trim()}`,
          message: message.trim(),
          userId: 'all',
          isRead: false,
          createdAt: serverTimestamp(),
          type: 'poll',
          pollOptions: filteredOptions,
          pollId: pollDocRef.id
        });
      } else {
        // Send a notification to each specific selected user
        const notificationPromises = selectedUserIds.map((userId) => {
          return addDoc(collection(db, 'notifications'), {
            title: `New Poll: ${title.trim()}`,
            message: message.trim(),
            userId: userId,
            isRead: false,
            createdAt: serverTimestamp(),
            type: 'poll',
            pollOptions: filteredOptions,
            pollId: pollDocRef.id
          });
        });
        await Promise.all(notificationPromises);
      }

      setStatus({ type: 'success', text: `Poll successfully created and broadcasted to ${recipientMode === 'all' ? 'all users' : `${selectedUserIds.length} user(s)`}!` });
      
      // Reset Form
      setTitle('');
      setMessage('');
      setOptions(['', '']);
      setSelectedUserIds([]);
    } catch (err: any) {
      console.error('Error creating poll:', err);
      setStatus({ type: 'error', text: 'Failed to create poll. Please check permissions.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePoll = async (pollId: string) => {
    if (window.confirm('Are you sure you want to permanently delete this poll? All votes and data will be lost.')) {
      try {
        await deleteDoc(doc(db, 'polls', pollId));
        setStatus({ type: 'success', text: 'Poll successfully deleted.' });
      } catch (err: any) {
        console.error('Error deleting poll:', err);
        setStatus({ type: 'error', text: 'Failed to delete poll.' });
      }
    }
  };

  // Helper to dynamically calculate vote counts for each option from poll_responses
  const getVotesMap = (pollId: string, pollOptionsList: string[]) => {
    const votesMap: { [key: string]: number } = {};
    pollOptionsList.forEach((option) => {
      votesMap[option] = responses.filter(r => r.pollId === pollId && r.selectedOption === option).length;
    });
    return votesMap;
  };

  // Helper to calculate total votes for a poll
  const getTotalVotes = (pollId: string) => {
    return responses.filter(r => r.pollId === pollId).length;
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
    <div className="space-y-8 animate-fade-in">
      {/* Top Welcome Title */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-2">
        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
          <BarChart2 className="text-indigo-600 h-7 w-7 animate-pulse" />
          Polls & Interactive Feedback
        </h3>
        <p className="text-xs text-slate-500 font-bold font-mono uppercase tracking-widest">
          Create and monitor real-time curriculum surveys, teacher feedback, and quick KICD CBC assessments.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form to Create Poll */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <PlusCircle className="text-emerald-600 h-5 w-5" />
              Create Custom Poll
            </h4>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mt-1">
              Construct a new poll to gather stakeholder opinions
            </p>
          </div>

          <form onSubmit={handleCreatePoll} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">
                Notification Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g., KICD Grade 10 Math Draft Feedback"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 text-xs p-3 outline-none font-bold tracking-tight focus:bg-indigo-50/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">
                Notification Message / Question <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="e.g., Do you agree with the proposed learning outcomes for Algebra in Senior School?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 text-xs p-3 outline-none font-bold tracking-tight focus:bg-indigo-50/50 transition-all resize-none"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Poll Options (Up to 4) <span className="text-red-500">*</span>
                </label>
                {options.length < 4 && (
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="flex items-center gap-1 text-[9px] font-black uppercase text-indigo-700 hover:text-indigo-900 tracking-wider"
                  >
                    <Plus size={12} /> Add Option
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {options.map((option, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <span className="text-xs font-mono font-bold text-slate-400 w-5">
                      #{index + 1}
                    </span>
                    <input
                      type="text"
                      required={index < 2}
                      placeholder={`Option ${index + 1} ${index >= 2 ? '(Optional)' : ''}`}
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs p-2.5 outline-none font-bold tracking-tight focus:bg-indigo-50/50 transition-all"
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(index)}
                        className="text-rose-500 hover:text-rose-700 p-1.5 transition-colors"
                        title="Remove option"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Recipient Mode Selection Toggle */}
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Target Poll Audience
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRecipientMode('all')}
                  className={`flex-1 py-2 px-3 rounded-xl border border-slate-200 font-black uppercase text-[10px] tracking-wider transition-all duration-200 ${
                    recipientMode === 'all'
                      ? 'bg-emerald-600 text-white shadow-[2px_2px_0px_rgba(0,0,0,1)]'
                      : 'bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  All Users
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientMode('specific')}
                  className={`flex-1 py-2 px-3 rounded-xl border border-slate-200 font-black uppercase text-[10px] tracking-wider transition-all duration-200 ${
                    recipientMode === 'specific'
                      ? 'bg-indigo-600 text-white shadow-[2px_2px_0px_rgba(0,0,0,1)]'
                      : 'bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Select Users ({selectedUserIds.length})
                </button>
              </div>
            </div>

            {/* Specific User Selector Section */}
            {recipientMode === 'specific' && (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 animate-fade-in">
                <div className="p-2.5 bg-slate-100 border-b border-slate-200 flex flex-col gap-2 justify-between items-center">
                  <div className="relative w-full">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
                      <Search size={12} className="text-slate-400" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1 border border-slate-200 rounded-lg text-[11px] font-bold outline-none bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="text-[9px] font-black uppercase tracking-wider text-indigo-700 hover:underline align-self-end"
                  >
                    {filteredUsers.map(u => u.id).every(id => selectedUserIds.includes(id)) && filteredUsers.length > 0
                      ? 'Deselect All'
                      : 'Select All Filtered'}
                  </button>
                </div>

                <div className="max-h-40 overflow-y-auto p-1.5 space-y-1 scrollbar-thin">
                  {filteredUsers.length === 0 ? (
                    <p className="text-[10px] text-slate-500 italic text-center py-2">No matching users.</p>
                  ) : (
                    filteredUsers.map((user) => {
                      const isSelected = selectedUserIds.includes(user.id);
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => handleToggleUser(user.id)}
                          className={`w-full flex items-center justify-between p-2 rounded-lg border transition-all text-left ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-black'
                              : 'bg-white border-slate-200 hover:border-slate-200 text-slate-700 font-bold'
                          }`}
                        >
                          <div className="truncate pr-4">
                            <div className="text-[11px] truncate">{user.name || 'Anonymous'}</div>
                            <div className="text-[8px] text-slate-400 truncate font-mono">{user.email}</div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[8px] px-1 py-0.2 bg-slate-100 rounded border border-slate-200">
                              {user.role}
                            </span>
                            {isSelected ? (
                              <CheckSquare size={14} className="text-indigo-600" />
                            ) : (
                              <Square size={14} className="text-slate-300" />
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
              <div className={`p-4 rounded-xl border border-slate-200 flex items-start gap-2 text-xs font-bold uppercase tracking-tight ${
                status.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
              }`}>
                {status.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
                <span>{status.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 text-xs font-black rounded-xl text-white bg-slate-900 hover:bg-black border border-slate-200 uppercase tracking-wider transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSubmitting ? 'Creating...' : 'Create & Broadcast Poll'}
            </button>
          </form>
        </div>

        {/* Right Column: Active Polls and Realtime Results */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
            <div>
              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <BarChart2 className="text-indigo-600 h-5 w-5" />
                Active Poll Records
              </h4>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mt-1">
                Real-time voter turnouts and survey statistics
              </p>
            </div>
            <span className="px-2.5 py-1 text-[9px] font-black bg-indigo-50 border border-slate-200 text-indigo-800 rounded-full uppercase tracking-wider">
              Total Polls: {polls.length}
            </span>
          </div>

          {isLoadingPolls ? (
            <div className="p-16 text-center text-slate-400 font-black uppercase tracking-widest italic animate-pulse">
              Loading interactive polls...
            </div>
          ) : polls.length === 0 ? (
            <div className="p-16 text-center border-2 border-dashed border-slate-200/20 rounded-2xl text-slate-400 font-black uppercase tracking-widest italic">
              No active polls launched yet.
            </div>
          ) : (
            <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
              {polls.map((poll) => {
                const totalVotes = getTotalVotes(poll.id);
                const votesMap = getVotesMap(poll.id, poll.options);
                const isTargetAll = !poll.targetUsers || poll.targetUsers === 'all';
                const targetText = isTargetAll 
                  ? 'All Users' 
                  : `${Array.isArray(poll.targetUsers) ? poll.targetUsers.length : 0} Selected User(s)`;

                return (
                  <div key={poll.id} className="p-5 border border-slate-200 rounded-2xl bg-slate-50/50 space-y-4 shadow-[2px_2px_0px_rgba(0,0,0,0.05)] hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <span className="text-[8px] font-black uppercase bg-indigo-100 text-indigo-800 border border-slate-200 px-2 py-0.5 rounded tracking-widest">
                            Poll Campaign
                          </span>
                          <span className="text-[8px] font-bold uppercase bg-slate-200 text-slate-700 border border-slate-300 px-2 py-0.5 rounded tracking-wider">
                            Audience: {targetText}
                          </span>
                        </div>
                        <h5 className="text-sm font-black text-slate-900 uppercase tracking-tight mt-1.5">
                          {poll.title}
                        </h5>
                        <p className="text-xs text-slate-500 font-bold mt-1 tracking-tight leading-relaxed">
                          {poll.message}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeletePoll(poll.id)}
                        className="text-rose-500 hover:text-rose-700 p-2 border border-slate-200 hover:bg-rose-50 bg-white rounded-xl transition-colors shrink-0 shadow-[1px_1px_0px_rgba(0,0,0,1)]"
                        title="Delete Poll"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Options list with vote count and progress bar */}
                    <div className="space-y-3 pt-2">
                      {poll.options.map((option) => {
                        const count = votesMap[option] || 0;
                        const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                        return (
                          <div key={option} className="space-y-1">
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-700 uppercase tracking-tight">
                              <span>{option}</span>
                              <span className="font-mono">
                                {count} votes ({percentage}%)
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 h-2.5 rounded-full border border-slate-200/30 overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-slate-200/10 pt-3 flex flex-wrap justify-between items-center text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                      <span>Created By: {poll.createdBy}</span>
                      <span className="flex items-center gap-1 text-slate-600">
                        <MessageSquare size={10} /> {totalVotes} Turnout
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PollsManagementPanel;
