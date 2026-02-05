import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import {
  HiOutlineGlobeAlt,
  HiOutlineNewspaper,
  HiOutlineLibrary,
  HiOutlineScale,
  HiOutlineBell,
  HiOutlineClipboardList,
  HiOutlineDocumentReport,
  HiOutlineSearch,
  HiOutlineX,
  HiOutlineChartBar,
  HiOutlineRefresh,
  HiOutlineDatabase
} from 'react-icons/hi';
import { useAuth } from '../../context/AuthContext';
import { scrapingApi } from '../../services/api';
import toast from 'react-hot-toast';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HiOutlineGlobeAlt },
  { name: 'Live Feed', href: '/feed', icon: HiOutlineNewspaper },
  { name: 'Regulation Library', href: '/library', icon: HiOutlineLibrary },
  { name: 'Enforcements', href: '/enforcements', icon: HiOutlineScale },
  { name: 'Search', href: '/search', icon: HiOutlineSearch },
];

const protectedNavigation = [
  { name: 'My Alerts', href: '/alerts', icon: HiOutlineBell },
  { name: 'Checklists', href: '/checklists', icon: HiOutlineClipboardList },
  { name: 'Reports', href: '/reports', icon: HiOutlineDocumentReport },
];

export default function Sidebar({ open, onClose }) {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [scraping, setScraping] = useState(false);
  const [initializing, setInitializing] = useState(false);

  const handleInitializeScraping = async () => {
    setInitializing(true);
    try {
      const response = await scrapingApi.initialize();
      toast.success(`Initialized ${response.data.data.jobsCount} scraping jobs`);
    } catch (error) {
      toast.error('Failed to initialize scraping');
      console.error(error);
    } finally {
      setInitializing(false);
    }
  };

  const handleTriggerScraping = async () => {
    setScraping(true);
    try {
      const response = await scrapingApi.triggerAll();
      toast.success(`Triggered ${response.data.data.triggered} scraping jobs`);
    } catch (error) {
      toast.error('Failed to trigger scraping');
      console.error(error);
    } finally {
      setScraping(false);
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <div className="mb-4">
          <p className="px-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Main
          </p>
        </div>
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-accent-500 text-white'
                  : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : ''}`} />
              {item.name}
              {item.name === 'Live Feed' && (
                <span className="ml-auto w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              )}
            </Link>
          );
        })}

        {isAuthenticated && (
          <>
            <div className="my-4 pt-4 border-t border-surface-200 dark:border-surface-700">
              <p className="px-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                My Workspace
              </p>
            </div>
            {protectedNavigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-accent-500 text-white'
                      : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : ''}`} />
                  {item.name}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Stats/Info section */}
      <div className="p-4 mx-3 mb-4 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl text-white">
        <div className="flex items-center gap-2 mb-2">
          <HiOutlineChartBar className="w-5 h-5" />
          <span className="font-semibold">Today's Stats</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-white/70">Updates</p>
            <p className="text-lg font-bold">47</p>
          </div>
          <div>
            <p className="text-white/70">Enforcements</p>
            <p className="text-lg font-bold">3</p>
          </div>
        </div>
      </div>

      {/* Scraping Controls */}
      <div className="p-4 mx-3 mb-4 bg-surface-100 dark:bg-surface-800 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <HiOutlineDatabase className="w-5 h-5 text-accent-500" />
          <span className="font-semibold text-sm">Data Scraping</span>
        </div>
        <div className="space-y-2">
          <button
            onClick={handleInitializeScraping}
            disabled={initializing}
            className="w-full btn-ghost btn-sm text-xs flex items-center justify-center gap-2 border border-surface-300 dark:border-surface-600"
          >
            <HiOutlineDatabase className={`w-4 h-4 ${initializing ? 'animate-pulse' : ''}`} />
            {initializing ? 'Initializing...' : 'Initialize Jobs'}
          </button>
          <button
            onClick={handleTriggerScraping}
            disabled={scraping}
            className="w-full btn-accent btn-sm text-xs flex items-center justify-center gap-2"
          >
            <HiOutlineRefresh className={`w-4 h-4 ${scraping ? 'animate-spin' : ''}`} />
            {scraping ? 'Scraping...' : 'Start Scraping'}
          </button>
        </div>
        <p className="text-xs text-surface-500 mt-2">
          Auto-runs every 20 minutes
        </p>
      </div>

      {/* Upgrade prompt for free users */}
      {!isAuthenticated && (
        <div className="p-4 mx-3 mb-4 bg-surface-100 dark:bg-surface-800 rounded-xl">
          <p className="text-sm font-medium mb-2">Unlock Pro Features</p>
          <p className="text-xs text-surface-500 mb-3">
            Get AI assistant, custom alerts, and more
          </p>
          <Link to="/register" className="btn-accent btn-sm w-full">
            Get Started Free
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:pt-12 border-r" style={{ background: 'var(--surface-secondary)', borderColor: 'var(--border)' }}>
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={onClose}
            />

            {/* Sidebar panel */}
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-surface-800 z-50 lg:hidden"
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>

              {/* Logo */}
              <div className="flex items-center gap-2 p-4 border-b border-surface-200 dark:border-surface-700">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">R</span>
                </div>
                <span className="text-xl font-bold text-gradient">RegWatch</span>
              </div>

              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
