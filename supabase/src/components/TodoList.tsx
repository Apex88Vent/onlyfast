import React, { useState, useEffect } from 'react';

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

interface UpcomingRace {
  track: string;
  date: string; // YYYY-MM-DD
}

const TODO_KEY = 'onlyfast_todos_v1';
const RACE_KEY = 'onlyfast_upcoming_race_v1';

const loadTodos = (): TodoItem[] => {
  try {
    const raw = localStorage.getItem(TODO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

const loadRace = (): UpcomingRace => {
  try {
    const raw = localStorage.getItem(RACE_KEY);
    if (!raw) return { track: '', date: '' };
    const parsed = JSON.parse(raw);
    return { track: parsed.track || '', date: parsed.date || '' };
  } catch { return { track: '', date: '' }; }
};

const daysUntil = (dateStr: string): number | null => {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

interface TodoListProps {
  onClose?: () => void;
  variant?: 'panel' | 'page';
}

const TodoList: React.FC<TodoListProps> = ({ onClose, variant = 'page' }) => {
  const [todos, setTodos] = useState<TodoItem[]>(() => loadTodos());
  const [race, setRace] = useState<UpcomingRace>(() => loadRace());
  const [raceDraft, setRaceDraft] = useState<UpcomingRace>(() => loadRace());
  const [newTodo, setNewTodo] = useState('');
  const [raceMsg, setRaceMsg] = useState('');

  useEffect(() => {
    try { localStorage.setItem(TODO_KEY, JSON.stringify(todos)); } catch {}
  }, [todos]);

  const addTodo = () => {
    const text = newTodo.trim();
    if (!text) return;
    setTodos(prev => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, done: false, createdAt: Date.now() },
      ...prev,
    ]);
    setNewTodo('');
  };

  const toggleTodo = (id: string) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const removeTodo = (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  };

  const clearCompleted = () => {
    setTodos(prev => prev.filter(t => !t.done));
  };

  const saveRace = () => {
    setRace(raceDraft);
    try { localStorage.setItem(RACE_KEY, JSON.stringify(raceDraft)); } catch {}
    setRaceMsg('Saved upcoming race');
    setTimeout(() => setRaceMsg(''), 2500);
  };

  const clearRace = () => {
    const empty = { track: '', date: '' };
    setRace(empty);
    setRaceDraft(empty);
    try { localStorage.removeItem(RACE_KEY); } catch {}
  };

  const days = daysUntil(race.date);
  const raceHappened = days !== null && days < 0;
  const raceToday = days === 0;

  const containerClass = variant === 'panel'
    ? 'p-4 space-y-4'
    : 'max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6';

  return (
    <div className={containerClass}>
      {variant === 'page' && (
        <div>
          <h2 className="text-2xl font-bold text-[#1A1B23]">To Do List</h2>
          <p className="text-sm text-[#6B7280] mt-1">Track upcoming races and your race-week task list.</p>
        </div>
      )}

      {/* Upcoming race */}
      <section className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-5 shadow-sm">
        <h3 className="text-sm font-bold text-[#1A1B23] flex items-center gap-2 mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Upcoming Race
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Track</label>
            <input
              type="text"
              value={raceDraft.track}
              onChange={(e) => setRaceDraft(d => ({ ...d, track: e.target.value }))}
              placeholder="e.g. Eldora Speedway"
              className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Date</label>
            <input
              type="date"
              value={raceDraft.date}
              onChange={(e) => setRaceDraft(d => ({ ...d, date: e.target.value }))}
              className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <div className="text-xs text-[#6B7280]">
            {raceMsg && <span className="text-green-700 font-medium">{raceMsg}</span>}
          </div>
          <div className="flex items-center gap-2">
            {(race.track || race.date) && (
              <button
                onClick={clearRace}
                className="text-xs text-[#9CA3AF] hover:text-red-500 underline"
              >
                Clear
              </button>
            )}
            <button
              onClick={saveRace}
              className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
            >
              Save
            </button>
          </div>
        </div>

        {race.date && (
          <div className="mt-4 bg-gradient-to-r from-[#00A8E8]/10 to-[#00A8E8]/5 border border-[#00A8E8]/30 rounded-xl px-4 py-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#00A8E8] font-bold">Next Race</div>
                <div className="text-base font-bold text-[#1A1B23]">
                  {race.track || 'Unnamed track'}
                </div>
                <div className="text-xs text-[#6B7280]">
                  {new Date(race.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              <div className="text-right">
                {raceToday ? (
                  <span className="inline-block bg-red-500 text-white px-3 py-1.5 rounded-full text-xs font-bold">
                    RACE DAY!
                  </span>
                ) : raceHappened ? (
                  <span className="inline-block bg-[#F0F0F2] text-[#6B7280] px-3 py-1.5 rounded-full text-xs font-semibold">
                    {Math.abs(days!)} day{Math.abs(days!) === 1 ? '' : 's'} ago
                  </span>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-[#00A8E8] leading-none">{days}</div>
                    <div className="text-[10px] uppercase tracking-wider text-[#6B7280] font-semibold">
                      day{days === 1 ? '' : 's'} away
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Todo list */}
      <section className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-5 shadow-sm">
        <h3 className="text-sm font-bold text-[#1A1B23] flex items-center gap-2 mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          Tasks
        </h3>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addTodo(); }}
            placeholder="Add a task… (e.g. swap tires, charge battery)"
            className="flex-1 px-3 py-2 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none text-sm"
          />
          <button
            onClick={addTodo}
            disabled={!newTodo.trim()}
            className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add
          </button>
        </div>

        <ul className="mt-3 space-y-1.5">
          {todos.length === 0 && (
            <li className="text-sm text-[#9CA3AF] italic py-4 text-center">
              No tasks yet — add one above.
            </li>
          )}
          {todos.map(t => (
            <li
              key={t.id}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors ${
                t.done ? 'bg-[#F9FAFB] border-[#F0F0F2]' : 'bg-white border-[#E5E7EB] hover:border-[#00A8E8]/40'
              }`}
            >
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggleTodo(t.id)}
                className="w-4 h-4 rounded border-[#D1D5DB] text-[#00A8E8] focus:ring-[#00A8E8] cursor-pointer"
                aria-label={`Mark "${t.text}" as ${t.done ? 'not done' : 'done'}`}
              />
              <span className={`flex-1 text-sm ${t.done ? 'line-through text-[#9CA3AF]' : 'text-[#1A1B23]'}`}>
                {t.text}
              </span>
              <button
                onClick={() => removeTodo(t.id)}
                className="text-[#9CA3AF] hover:text-red-500 p-1 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                aria-label={`Remove "${t.text}"`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>

        {todos.some(t => t.done) && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={clearCompleted}
              className="text-xs text-[#9CA3AF] hover:text-red-500 underline"
            >
              Clear completed
            </button>
          </div>
        )}
      </section>

      {variant === 'panel' && onClose && (
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="text-sm text-[#6B7280] hover:text-[#1A1B23] underline"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default TodoList;
