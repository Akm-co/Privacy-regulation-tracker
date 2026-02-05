import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { checklistsApi } from '../services/api';
import { HiOutlineClipboardList, HiOutlinePlus } from 'react-icons/hi';

export default function Checklists() {
  const { data, isLoading } = useQuery({
    queryKey: ['checklists'],
    queryFn: () => checklistsApi.getAll()
  });

  const checklists = data?.data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compliance Checklists</h1>
          <p className="text-surface-500">Track your compliance progress</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <HiOutlinePlus className="w-5 h-5" />
          New Checklist
        </button>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-6 h-40 skeleton" />
          ))}
        </div>
      ) : checklists.length === 0 ? (
        <div className="card p-12 text-center">
          <HiOutlineClipboardList className="w-12 h-12 mx-auto text-surface-400 mb-4" />
          <h3 className="font-semibold mb-2">No checklists yet</h3>
          <p className="text-surface-500 mb-4">Create checklists to track your compliance requirements</p>
          <button className="btn-primary">Create your first checklist</button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {checklists.map((checklist) => (
            <Link key={checklist._id} to={`/checklists/${checklist._id}`} className="card-hover p-6">
              <h3 className="font-semibold mb-2">{checklist.title}</h3>
              <p className="text-sm text-surface-500 mb-4">{checklist.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-500">
                  {checklist.progress?.completed || 0}/{checklist.progress?.total || 0} items
                </span>
                <div className="w-24 h-2 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-500 rounded-full"
                    style={{ width: `${checklist.progress?.percentage || 0}%` }}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
