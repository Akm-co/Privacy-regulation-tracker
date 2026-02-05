import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { HiOutlineSearch } from 'react-icons/hi';
import UpdateCard from '../components/feed/UpdateCard';
import { searchApi } from '../services/api';

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');

  const { data, isLoading } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchApi.search({ q: query }),
    enabled: query.length >= 2
  });

  const results = data?.data?.data || {};

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query });
    }
  };

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setQuery(q);
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Search</h1>
        <p className="text-surface-500">Find regulations, updates, and enforcements</p>
      </div>

      <form onSubmit={handleSearch}>
        <div className="relative">
          <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-surface-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="input pl-12 py-4 text-lg"
            autoFocus
          />
        </div>
      </form>

      {isLoading && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-4 h-48 skeleton" />
          ))}
        </div>
      )}

      {results.updates?.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Updates ({results.totals?.updates || 0})</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.updates.map((update) => (
              <UpdateCard key={update._id} update={update} />
            ))}
          </div>
        </div>
      )}

      {results.regulations?.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Regulations ({results.totals?.regulations || 0})</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.regulations.map((reg) => (
              <div key={reg._id} className="card p-4">
                <h3 className="font-semibold">{reg.name}</h3>
                <p className="text-sm text-surface-500 mt-1">{reg.summary?.substring(0, 100)}...</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {query && !isLoading && Object.values(results.totals || {}).every(c => c === 0) && (
        <div className="card p-12 text-center">
          <p className="text-surface-500">No results found for "{query}"</p>
        </div>
      )}
    </div>
  );
}
