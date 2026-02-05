import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { checklistsApi } from '../services/api';

export default function ChecklistDetail() {
  const { id } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['checklist', id],
    queryFn: () => checklistsApi.getById(id)
  });

  const checklist = data?.data?.data;

  if (isLoading) {
    return <div className="card p-6 skeleton h-96" />;
  }

  if (!checklist) {
    return <div className="card p-12 text-center text-surface-500">Checklist not found</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{checklist.title}</h1>
        <p className="text-surface-500">{checklist.description}</p>
      </div>

      <div className="card p-6">
        <div className="space-y-3">
          {checklist.items?.map((item) => (
            <div key={item._id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800">
              <input
                type="checkbox"
                checked={item.completed}
                className="mt-1"
                readOnly
              />
              <div className="flex-1">
                <p className={item.completed ? 'line-through text-surface-500' : ''}>
                  {item.text}
                </p>
                {item.description && (
                  <p className="text-sm text-surface-500 mt-1">{item.description}</p>
                )}
              </div>
              <span className={`badge badge-${item.priority === 'critical' ? 'critical' : item.priority === 'important' ? 'high' : 'medium'}`}>
                {item.priority}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
