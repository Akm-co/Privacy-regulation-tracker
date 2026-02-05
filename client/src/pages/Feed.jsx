import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { HiOutlineFilter, HiOutlineRefresh } from 'react-icons/hi';
import UpdateCard from '../components/feed/UpdateCard';
import { updatesApi } from '../services/api';

export default function Feed() {
  const [filters, setFilters] = useState({
    region: '',
    type: '',
    impact: '',
    page: 1
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['updates', filters],
    queryFn: () => updatesApi.getAll(filters),
    staleTime: 60 * 1000
  });

  const updates = data?.data?.data || [];
  const pagination = data?.data?.pagination || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Live Feed</h1>
          <p className="text-surface-500">Real-time privacy regulation updates</p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-ghost flex items-center gap-2"
        >
          <HiOutlineRefresh className="w-5 h-5" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <HiOutlineFilter className="w-5 h-5 text-surface-500" />

          <select
            value={filters.region}
            onChange={(e) => setFilters({ ...filters, region: e.target.value, page: 1 })}
            className="input w-auto"
          >
            <option value="">All Regions</option>
            <option value="EU">European Union</option>
            <option value="US">United States</option>
            <option value="UK">United Kingdom</option>
            <option value="US-CA">California</option>
          </select>

          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value, page: 1 })}
            className="input w-auto"
          >
            <option value="">All Types</option>
            <option value="amendment">Amendment</option>
            <option value="guidance">Guidance</option>
            <option value="enforcement">Enforcement</option>
            <option value="news">News</option>
            <option value="research">Research</option>
          </select>

          <select
            value={filters.impact}
            onChange={(e) => setFilters({ ...filters, impact: e.target.value, page: 1 })}
            className="input w-auto"
          >
            <option value="">All Impact</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Updates grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-4 h-48 skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {updates.map((update, index) => (
            <motion.div
              key={update._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <UpdateCard update={update} />
            </motion.div>
          ))}
        </div>
      )}

      {updates.length === 0 && !isLoading && (
        <div className="card p-12 text-center">
          <p className="text-surface-500">No updates found matching your filters</p>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
            disabled={filters.page === 1}
            className="btn-ghost"
          >
            Previous
          </button>
          <span className="px-4 py-2">
            Page {filters.page} of {pagination.pages}
          </span>
          <button
            onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
            disabled={filters.page >= pagination.pages}
            className="btn-ghost"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
