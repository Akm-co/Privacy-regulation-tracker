import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  HiOutlineGlobeAlt,
  HiOutlineTrendingUp,
  HiOutlineBell,
  HiOutlineScale,
  HiOutlineArrowRight,
  HiOutlineSparkles
} from 'react-icons/hi';
import WorldMap from '../components/map/WorldMap';
import UpdateCard from '../components/feed/UpdateCard';
import { regionsApi, updatesApi, enforcementsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 15
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 20
    }
  }
};

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [selectedRegion, setSelectedRegion] = useState(null);

  // Fetch map data
  const { data: mapData } = useQuery({
    queryKey: ['mapData'],
    queryFn: () => regionsApi.getMapData(),
    staleTime: 5 * 60 * 1000
  });

  // Fetch stats
  const { data: updateStats } = useQuery({
    queryKey: ['updateStats'],
    queryFn: () => updatesApi.getStats(),
    staleTime: 5 * 60 * 1000
  });

  // Fetch trending updates
  const { data: trendingUpdates } = useQuery({
    queryKey: ['trendingUpdates'],
    queryFn: () => updatesApi.getTrending(),
    staleTime: 5 * 60 * 1000
  });

  // Fetch top enforcements
  const { data: topEnforcements } = useQuery({
    queryKey: ['topEnforcements'],
    queryFn: () => enforcementsApi.getTop({ limit: 5 }),
    staleTime: 5 * 60 * 1000
  });

  const stats = updateStats?.data?.data || {};
  const trending = trendingUpdates?.data?.data || [];
  const enforcements = topEnforcements?.data?.data || [];

  return (
    <motion.div
      className="space-y-8"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Hero section with Map */}
      <motion.section variants={itemVariants} className="relative">
        <div className="grid lg:grid-cols-5 gap-6">
          {/* World Map */}
          <motion.div
            variants={cardVariants}
            className="lg:col-span-3 card-solid overflow-hidden"
          >
            <div className="h-[420px] lg:h-[520px] relative">
              <WorldMap
                data={mapData?.data?.data}
                onRegionSelect={setSelectedRegion}
                selectedRegion={selectedRegion}
              />

              {/* Region info overlay */}
              {selectedRegion && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="absolute bottom-4 left-4 right-4 glass-card p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{selectedRegion.name}</h3>
                      <p className="text-sm text-surface-500">
                        {selectedRegion.regulationCount} regulation{selectedRegion.regulationCount !== 1 ? 's' : ''} •{' '}
                        {selectedRegion.recentUpdateCount} recent update{selectedRegion.recentUpdateCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Link
                      to={`/library?region=${selectedRegion.code}`}
                      className="btn-primary btn-sm flex items-center gap-2"
                    >
                      Explore <HiOutlineArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Quick stats and actions */}
          <div className="lg:col-span-2 space-y-4">
            {/* Stats cards */}
            <motion.div variants={containerVariants} className="grid grid-cols-2 gap-3">
              {[
                { icon: HiOutlineTrendingUp, value: stats.todayCount || 0, label: "Today's Updates", color: 'text-[#6264a7]', bg: 'bg-[#6264a7]/10' },
                { icon: HiOutlineScale, value: enforcements.length, label: 'Recent Fines', color: 'text-orange-500', bg: 'bg-orange-500/10' },
                { icon: HiOutlineGlobeAlt, value: Object.keys(stats.byRegion || {}).length, label: 'Active Regions', color: 'text-green-500', bg: 'bg-green-500/10' },
                { icon: HiOutlineBell, value: stats.weekCount || 0, label: 'This Week', color: 'text-[#7b83eb]', bg: 'bg-[#7b83eb]/10' },
              ].map((stat, index) => (
                <motion.div
                  key={index}
                  variants={cardVariants}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="card p-4 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                      <p className="text-xs text-surface-500">{stat.label}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Top enforcements */}
            <motion.div variants={cardVariants} className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Recent Enforcements</h3>
                <Link to="/enforcements" className="text-sm text-accent-500 hover:text-accent-600 transition-colors">
                  View all →
                </Link>
              </div>
              <div className="space-y-3">
                {enforcements.slice(0, 4).map((enf, index) => (
                  <motion.div
                    key={enf._id || index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1, type: 'spring', stiffness: 100 }}
                    className="flex items-center justify-between text-sm py-2 border-b border-surface-100 dark:border-surface-700/50 last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-medium text-surface-400 w-6">
                        {enf.country}
                      </span>
                      <span className="truncate font-medium">{enf.company}</span>
                    </div>
                    <span className="font-semibold text-orange-500 tabular-nums">
                      ${(enf.fineAmountUSD / 1000000).toFixed(1)}M
                    </span>
                  </motion.div>
                ))}
                {enforcements.length === 0 && (
                  <p className="text-sm text-surface-400 text-center py-4">No recent enforcements</p>
                )}
              </div>
            </motion.div>

            {/* CTA for non-authenticated users */}
            {!isAuthenticated && (
              <motion.div
                variants={cardVariants}
                className="relative overflow-hidden rounded-2xl p-5"
                style={{
                  background: 'linear-gradient(135deg, #0071e3 0%, #00b4d8 100%)'
                }}
              >
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <HiOutlineSparkles className="w-5 h-5 text-white/80" />
                    <h3 className="font-semibold text-white">Stay Informed</h3>
                  </div>
                  <p className="text-sm text-white/80 mb-4">
                    Get personalized alerts for regulations that matter to you
                  </p>
                  <Link
                    to="/register"
                    className="btn bg-white text-[#0071e3] hover:bg-white/90 w-full justify-center"
                  >
                    Create Free Account
                  </Link>
                </div>
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-xl translate-y-1/2 -translate-x-1/2" />
              </motion.div>
            )}
          </div>
        </div>
      </motion.section>

      {/* Trending Updates */}
      <motion.section variants={itemVariants}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold tracking-tight">Trending Updates</h2>
          <Link
            to="/feed"
            className="flex items-center gap-1.5 text-sm text-accent-500 hover:text-accent-600 transition-colors"
          >
            View all <HiOutlineArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <motion.div
          variants={containerVariants}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {trending.slice(0, 6).map((update, index) => (
            <motion.div
              key={update._id || index}
              variants={cardVariants}
              whileHover={{ y: -4 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <UpdateCard update={update} />
            </motion.div>
          ))}
        </motion.div>

        {trending.length === 0 && (
          <motion.div variants={cardVariants} className="card p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
              <HiOutlineTrendingUp className="w-8 h-8 text-surface-400" />
            </div>
            <p className="text-surface-500">No trending updates at the moment</p>
            <p className="text-sm text-surface-400 mt-1">Check back later for the latest regulatory news</p>
          </motion.div>
        )}
      </motion.section>

      {/* Quick links */}
      <motion.section variants={itemVariants} className="grid md:grid-cols-3 gap-4">
        {[
          {
            to: '/library',
            icon: HiOutlineGlobeAlt,
            iconColor: 'text-sky-500',
            iconBg: 'bg-sky-500/10',
            title: 'Regulation Library',
            description: 'Browse our comprehensive database of global privacy laws'
          },
          {
            to: '/enforcements',
            icon: HiOutlineScale,
            iconColor: 'text-orange-500',
            iconBg: 'bg-orange-500/10',
            title: 'Enforcement Tracker',
            description: 'Track fines, penalties, and enforcement actions worldwide'
          },
          {
            to: isAuthenticated ? '/checklists' : '/register',
            icon: HiOutlineBell,
            iconColor: 'text-emerald-500',
            iconBg: 'bg-emerald-500/10',
            title: 'Compliance Tools',
            description: 'Generate checklists and reports for your compliance needs'
          }
        ].map((link, index) => (
          <motion.div
            key={index}
            variants={cardVariants}
            whileHover={{ y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <Link to={link.to} className="card p-6 block group h-full">
              <div className={`w-12 h-12 rounded-xl ${link.iconBg} flex items-center justify-center mb-4`}>
                <link.icon className={`w-6 h-6 ${link.iconColor}`} />
              </div>
              <h3 className="font-semibold mb-2 group-hover:text-accent-500 transition-colors">
                {link.title}
              </h3>
              <p className="text-sm text-surface-500 leading-relaxed">
                {link.description}
              </p>
            </Link>
          </motion.div>
        ))}
      </motion.section>
    </motion.div>
  );
}
