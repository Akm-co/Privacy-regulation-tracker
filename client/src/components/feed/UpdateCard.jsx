import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import {
  HiOutlineBookmark,
  HiBookmark,
  HiOutlineExternalLink,
  HiOutlineShare
} from 'react-icons/hi';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updatesApi } from '../../services/api';
import toast from 'react-hot-toast';

const impactColors = {
  critical: 'badge-critical',
  high: 'badge-high',
  medium: 'badge-medium',
  low: 'badge-low'
};

const typeLabels = {
  amendment: 'Amendment',
  guidance: 'Guidance',
  enforcement: 'Enforcement',
  news: 'News',
  research: 'Research',
  opinion: 'Opinion',
  rulemaking: 'Rulemaking',
  breach: 'Breach',
  policy: 'Policy'
};

export default function UpdateCard({ update, showFullContent = false }) {
  const { isAuthenticated } = useAuth();
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      toast.error('Please log in to save updates');
      return;
    }

    try {
      if (isSaved) {
        await updatesApi.unsave(update._id);
        setIsSaved(false);
        toast.success('Removed from saved');
      } else {
        await updatesApi.save(update._id, {});
        setIsSaved(true);
        toast.success('Saved for later');
      }
    } catch (error) {
      toast.error('Failed to save update');
    }
  };

  const handleShare = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (navigator.share) {
      try {
        await navigator.share({
          title: update.title,
          text: update.summary,
          url: update.sourceUrl
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          copyToClipboard();
        }
      }
    } else {
      copyToClipboard();
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(update.sourceUrl);
    toast.success('Link copied to clipboard');
  };

  const regions = update.regions?.slice(0, 3) || [];
  const regulations = update.regulations?.slice(0, 2) || [];
  const timeAgo = update.publicationDate
    ? formatDistanceToNow(new Date(update.publicationDate), { addSuffix: true })
    : '';

  return (
    <motion.article
      whileHover={{ y: -2 }}
      className="card-hover p-4 h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Regions */}
          {regions.map((region, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-100 dark:bg-surface-700 rounded text-xs font-medium"
            >
              {region.code}
            </span>
          ))}

          {/* Type */}
          {update.updateType && (
            <span className="badge-info">
              {typeLabels[update.updateType] || update.updateType}
            </span>
          )}
        </div>

        {/* Impact level */}
        <span className={impactColors[update.impactLevel] || 'badge-medium'}>
          {update.impactLevel?.charAt(0).toUpperCase() + update.impactLevel?.slice(1) || 'Medium'}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-accent-500 transition-colors">
        <a
          href={update.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-accent-500"
        >
          {update.title}
        </a>
      </h3>

      {/* Summary */}
      <p className={`text-surface-600 dark:text-surface-400 text-sm mb-3 ${showFullContent ? '' : 'line-clamp-3'}`}>
        {update.summary}
      </p>

      {/* Regulations */}
      {regulations.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {regulations.map((reg, i) => (
            <Link
              key={i}
              to={`/library/${reg._id || reg}`}
              className="text-xs px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {reg.acronym || reg.name || reg}
            </Link>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto pt-3 border-t border-surface-100 dark:border-surface-700 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-surface-500">
          <span>{update.sourceName || 'Source'}</span>
          <span>•</span>
          <span>{timeAgo}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleSave}
            className="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
            title={isSaved ? 'Remove from saved' : 'Save for later'}
          >
            {isSaved ? (
              <HiBookmark className="w-4 h-4 text-accent-500" />
            ) : (
              <HiOutlineBookmark className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={handleShare}
            className="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
            title="Share"
          >
            <HiOutlineShare className="w-4 h-4" />
          </button>

          <a
            href={update.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
            title="Open source"
            onClick={(e) => e.stopPropagation()}
          >
            <HiOutlineExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </motion.article>
  );
}
