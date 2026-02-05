import { Router } from 'express';
import authRoutes from './auth.js';
import regulationRoutes from './regulations.js';
import updateRoutes from './updates.js';
import enforcementRoutes from './enforcements.js';
import regionRoutes from './regions.js';
import chatRoutes from './chat.js';
import checklistRoutes from './checklists.js';
import reportRoutes from './reports.js';
import searchRoutes from './search.js';
import userRoutes from './users.js';
import scrapingRoutes from './scraping.js';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/regulations', regulationRoutes);
router.use('/updates', updateRoutes);
router.use('/enforcements', enforcementRoutes);
router.use('/regions', regionRoutes);
router.use('/chat', chatRoutes);
router.use('/checklists', checklistRoutes);
router.use('/reports', reportRoutes);
router.use('/search', searchRoutes);
router.use('/users', userRoutes);
router.use('/scraping', scrapingRoutes);

export default router;
