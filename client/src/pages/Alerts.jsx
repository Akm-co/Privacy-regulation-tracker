import { useQuery } from '@tanstack/react-query';
import { userApi } from '../services/api';
import { HiOutlineBell, HiOutlinePlus } from 'react-icons/hi';

export default function Alerts() {
  const { data, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => userApi.getAlerts()
  });

  const alerts = data?.data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Alerts</h1>
          <p className="text-surface-500">Manage your notification preferences</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <HiOutlinePlus className="w-5 h-5" />
          New Alert
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-4 h-24 skeleton" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="card p-12 text-center">
          <HiOutlineBell className="w-12 h-12 mx-auto text-surface-400 mb-4" />
          <h3 className="font-semibold mb-2">No alerts configured</h3>
          <p className="text-surface-500 mb-4">Set up alerts to get notified about regulatory updates</p>
          <button className="btn-primary">Create your first alert</button>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div key={alert._id} className="card p-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{alert.name}</h3>
                <p className="text-sm text-surface-500">{alert.type}</p>
              </div>
              <span className={`badge ${alert.active ? 'badge-low' : 'badge-medium'}`}>
                {alert.active ? 'Active' : 'Paused'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
