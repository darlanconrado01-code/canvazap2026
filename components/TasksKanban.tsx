
import React, { useState } from 'react';
import { MOCK_TASKS } from '../constants';
import { Task, TaskStatus } from '../types';

const TasksKanban: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);

  const columns: TaskStatus[] = [TaskStatus.TODO, TaskStatus.DOING, TaskStatus.DONE];

  const moveTask = (taskId: string, newStatus: TaskStatus) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  return (
    <div className="flex space-x-6 overflow-x-auto pb-6 min-h-[calc(100vh-200px)]">
      {columns.map(status => (
        <div key={status} className="flex-shrink-0 w-80 bg-slate-100 rounded-2xl flex flex-col">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-slate-700">{status}</h3>
              <span className="bg-white text-slate-500 px-2 py-0.5 rounded-lg text-xs font-bold shadow-sm">
                {tasks.filter(t => t.status === status).length}
              </span>
            </div>
            <button className="text-slate-400 hover:text-indigo-600 transition-colors">
              <i className="fas fa-plus-circle"></i>
            </button>
          </div>

          <div className="flex-1 p-3 space-y-4 kanban-column">
            {tasks
              .filter(t => t.status === status)
              .map(task => (
                <div 
                  key={task.id} 
                  className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 group hover:border-indigo-300 transition-all cursor-grab active:cursor-grabbing"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded flex items-center space-x-1 ${
                      task.priority === 'high' ? 'bg-red-100 text-red-600' : task.priority === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <i className="fas fa-circle text-[6px]"></i>
                      <span>{task.priority}</span>
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                       <button 
                        onClick={() => {
                          const idx = columns.indexOf(status);
                          if (idx < columns.length - 1) moveTask(task.id, columns[idx + 1]);
                        }}
                        className="text-indigo-500 hover:bg-indigo-50 p-1 rounded"
                       >
                         <i className="fas fa-arrow-right text-xs"></i>
                       </button>
                    </div>
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm mb-1">{task.title}</h4>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-4">{task.description}</p>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                    <div className="flex -space-x-2">
                      <img src={`https://picsum.photos/seed/${task.assignee}/32/32`} className="w-6 h-6 rounded-full ring-2 ring-white" alt="Assignee" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">{task.assignee}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TasksKanban;
