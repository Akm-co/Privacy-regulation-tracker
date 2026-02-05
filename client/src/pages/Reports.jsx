import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../services/api';
import { HiOutlineDocumentReport, HiOutlinePlus, HiOutlineDownload } from 'react-icons/hi';

export default function Reports() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: () => reportsApi.getAll()
  });

  const reports = data?.data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-surface-500">Generate compliance reports</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <HiOutlinePlus className="w-5 h-5" />
          New Report
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-4 h-20 skeleton" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="card p-12 text-center">
          <HiOutlineDocumentReport className="w-12 h-12 mx-auto text-surface-400 mb-4" />
          <h3 className="font-semibold mb-2">No reports generated</h3>
          <p className="text-surface-500 mb-4">Create reports to share regulatory updates with your team</p>
          <button className="btn-primary">Generate your first report</button>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report._id} className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <HiOutlineDocumentReport className="w-8 h-8 text-surface-400" />
                <div>
                  <h3 className="font-semibold">{report.title}</h3>
                  <p className="text-sm text-surface-500">
                    {report.type} • Generated {new Date(report.generatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge ${report.status === 'completed' ? 'badge-low' : 'badge-medium'}`}>
                  {report.status}
                </span>
                {report.status === 'completed' && (
                  <button className="btn-ghost btn-sm">
                    <HiOutlineDownload className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
