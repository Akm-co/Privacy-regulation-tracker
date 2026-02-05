import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { enforcementsApi } from '../services/api';

export default function Enforcements() {
  const [filters, setFilters] = useState({ page: 1, limit: 20 });

  const { data, isLoading } = useQuery({
    queryKey: ['enforcements', filters],
    queryFn: () => enforcementsApi.getAll(filters)
  });

  const enforcements = data?.data?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Enforcement Tracker</h1>
        <p className="text-surface-500">Track fines and penalties worldwide</p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-100 dark:bg-surface-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Company</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Fine</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Authority</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Country</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-4"><div className="h-4 w-32 skeleton rounded" /></td>
                  <td className="px-4 py-4"><div className="h-4 w-20 skeleton rounded" /></td>
                  <td className="px-4 py-4"><div className="h-4 w-24 skeleton rounded" /></td>
                  <td className="px-4 py-4"><div className="h-4 w-16 skeleton rounded" /></td>
                  <td className="px-4 py-4"><div className="h-4 w-24 skeleton rounded" /></td>
                </tr>
              ))
            ) : (
              enforcements.map((enf) => (
                <tr key={enf._id} className="hover:bg-surface-50 dark:hover:bg-surface-800/50">
                  <td className="px-4 py-4 font-medium">{enf.company}</td>
                  <td className="px-4 py-4 text-orange-500 font-semibold">
                    ${enf.fineAmountUSD?.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-surface-500">{enf.authority}</td>
                  <td className="px-4 py-4">{enf.country}</td>
                  <td className="px-4 py-4 text-surface-500">
                    {new Date(enf.date).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
