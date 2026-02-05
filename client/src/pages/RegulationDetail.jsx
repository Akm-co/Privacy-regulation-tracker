import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { regulationsApi } from '../services/api';

export default function RegulationDetail() {
  const { id } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['regulation', id],
    queryFn: () => regulationsApi.getById(id),
    staleTime: 5 * 60 * 1000
  });

  const regulation = data?.data?.data;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-64 skeleton rounded" />
        <div className="card p-6 space-y-4">
          <div className="h-6 w-full skeleton rounded" />
          <div className="h-4 w-3/4 skeleton rounded" />
          <div className="h-4 w-1/2 skeleton rounded" />
        </div>
      </div>
    );
  }

  if (!regulation) {
    return (
      <div className="card p-12 text-center">
        <p className="text-surface-500">Regulation not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{regulation.name}</h1>
        <p className="text-surface-500">{regulation.fullName}</p>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold mb-4">Summary</h2>
        <p className="text-surface-600 dark:text-surface-400">{regulation.summary}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-6">
          <h2 className="font-semibold mb-4">Jurisdiction</h2>
          <p>Region: {regulation.jurisdiction?.region}</p>
          <p>Type: {regulation.jurisdiction?.type}</p>
        </div>

        <div className="card p-6">
          <h2 className="font-semibold mb-4">Status</h2>
          <p>Status: {regulation.status}</p>
          <p>Effective: {new Date(regulation.effectiveDate).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}
