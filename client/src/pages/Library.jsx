import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { HiOutlineSearch, HiOutlineFilter, HiOutlineGlobeAlt } from 'react-icons/hi';
import { regulationsApi } from '../services/api';

export default function Library() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    region: searchParams.get('region') || '',
    status: '',
    search: '',
    page: 1
  });

  const { data, isLoading } = useQuery({
    queryKey: ['regulations', filters],
    queryFn: () => regulationsApi.getAll(filters),
    staleTime: 5 * 60 * 1000
  });

  const regulations = data?.data?.data || [];
  const pagination = data?.data?.pagination || {};

  const getStrictnessColor = (score) => {
    if (!score) return 'bg-surface-300';
    if (score >= 8) return 'bg-red-500';
    if (score >= 6) return 'bg-orange-500';
    if (score >= 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Regulation Library</h1>
        <p className="text-surface-500">Comprehensive database of global privacy laws</p>
      </div>

      {/* Search and Filters */}
      <div className="card p-4 space-y-4">
        <div className="relative">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
            placeholder="Search regulations..."
            className="input pl-10"
          />
        </div>

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
            <option value="CN">China</option>
            <option value="BR">Brazil</option>
            <option value="IN">India</option>
            <option value="JP">Japan</option>
            <option value="AU">Australia</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
            className="input w-auto"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="proposed">Proposed</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Regulations grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-6 h-48 skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {regulations.map((reg, index) => (
            <motion.div
              key={reg._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link to={`/library/${reg._id}`} className="card-hover p-6 block h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <HiOutlineGlobeAlt className="w-5 h-5 text-surface-400" />
                    <span className="text-sm text-surface-500">
                      {reg.jurisdiction?.region}
                    </span>
                  </div>
                  {reg.strictnessScore && (
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${getStrictnessColor(reg.strictnessScore)}`} />
                      <span className="text-xs text-surface-500">{reg.strictnessScore}/10</span>
                    </div>
                  )}
                </div>

                <h3 className="font-semibold text-lg mb-1">{reg.acronym || reg.name}</h3>
                <p className="text-sm text-surface-500 mb-3">{reg.fullName || reg.name}</p>

                <p className="text-sm text-surface-600 dark:text-surface-400 line-clamp-2 mb-4">
                  {reg.summary}
                </p>

                <div className="flex flex-wrap gap-2 mt-auto">
                  <span className={`badge ${reg.status === 'active' ? 'badge-low' : 'badge-medium'}`}>
                    {reg.status}
                  </span>
                  {reg.effectiveDate && (
                    <span className="text-xs text-surface-500">
                      Since {new Date(reg.effectiveDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {regulations.length === 0 && !isLoading && (
        <div className="card p-12 text-center">
          <p className="text-surface-500">No regulations found matching your filters</p>
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
