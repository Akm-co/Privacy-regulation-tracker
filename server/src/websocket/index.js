import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { logger } from '../utils/logger.js';

// Store connected clients
const connectedClients = new Map();

export const setupWebSocket = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('_id email preferences');

        if (user) {
          socket.user = user;
          socket.userId = user._id.toString();
        }
      }

      // Allow unauthenticated connections for public updates
      next();
    } catch (error) {
      // Allow connection even if auth fails (for public channels)
      next();
    }
  });

  io.on('connection', (socket) => {
    logger.info(`WebSocket connected: ${socket.id}${socket.user ? ` (user: ${socket.user.email})` : ' (anonymous)'}`);

    // Track connected client
    if (socket.userId) {
      if (!connectedClients.has(socket.userId)) {
        connectedClients.set(socket.userId, new Set());
      }
      connectedClients.get(socket.userId).add(socket.id);
    }

    // Join public updates channel
    socket.join('updates:public');

    // Join user-specific channels if authenticated
    if (socket.user) {
      socket.join(`user:${socket.userId}`);

      // Join region-specific channels based on preferences
      const watchedRegions = socket.user.preferences?.watchedRegions || [];
      watchedRegions.forEach(region => {
        socket.join(`region:${region}`);
      });
    }

    // Handle subscription to specific channels
    socket.on('subscribe', (channels) => {
      if (!Array.isArray(channels)) channels = [channels];

      channels.forEach(channel => {
        // Validate channel format
        if (isValidChannel(channel)) {
          socket.join(channel);
          logger.debug(`Socket ${socket.id} subscribed to ${channel}`);
        }
      });
    });

    // Handle unsubscription
    socket.on('unsubscribe', (channels) => {
      if (!Array.isArray(channels)) channels = [channels];

      channels.forEach(channel => {
        socket.leave(channel);
        logger.debug(`Socket ${socket.id} unsubscribed from ${channel}`);
      });
    });

    // Handle typing indicator for chat
    socket.on('chat:typing', (sessionId) => {
      if (socket.userId) {
        socket.to(`chat:${sessionId}`).emit('chat:typing', {
          userId: socket.userId,
          sessionId
        });
      }
    });

    // Handle read receipts
    socket.on('notification:read', async (notificationId) => {
      if (socket.userId) {
        // Update notification as read in database
        // This would be implemented with a Notification model
        socket.emit('notification:marked-read', notificationId);
      }
    });

    // Handle presence
    socket.on('presence:update', (status) => {
      if (socket.userId) {
        io.to(`user:${socket.userId}`).emit('presence:changed', {
          userId: socket.userId,
          status,
          lastSeen: new Date()
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`WebSocket disconnected: ${socket.id} (${reason})`);

      if (socket.userId) {
        const userSockets = connectedClients.get(socket.userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            connectedClients.delete(socket.userId);
          }
        }
      }
    });

    // Error handling
    socket.on('error', (error) => {
      logger.error(`WebSocket error for ${socket.id}:`, error);
    });
  });

  logger.info('WebSocket server initialized');
};

// Validate channel names
function isValidChannel(channel) {
  const validPrefixes = [
    'updates:',
    'region:',
    'regulation:',
    'enforcement:',
    'chat:',
    'user:'
  ];

  return validPrefixes.some(prefix => channel.startsWith(prefix));
}

// Broadcast new update to relevant channels
export const broadcastUpdate = (io, update) => {
  // Broadcast to public channel
  io.to('updates:public').emit('update:new', {
    id: update._id,
    title: update.title,
    summary: update.summary,
    impactLevel: update.impactLevel,
    updateType: update.updateType,
    regions: update.regions,
    publicationDate: update.publicationDate
  });

  // Broadcast to region-specific channels
  update.regions?.forEach(region => {
    io.to(`region:${region.code}`).emit('update:new', update);
  });

  // Broadcast to regulation-specific channels
  update.regulations?.forEach(regId => {
    io.to(`regulation:${regId}`).emit('update:new', update);
  });
};

// Broadcast new enforcement
export const broadcastEnforcement = (io, enforcement) => {
  io.to('updates:public').emit('enforcement:new', {
    id: enforcement._id,
    company: enforcement.company,
    fineAmountUSD: enforcement.fineAmountUSD,
    authority: enforcement.authority,
    country: enforcement.country,
    date: enforcement.date
  });

  io.to(`region:${enforcement.country}`).emit('enforcement:new', enforcement);
};

// Send notification to specific user
export const sendUserNotification = (io, userId, notification) => {
  io.to(`user:${userId}`).emit('notification', notification);
};

// Get online users count
export const getOnlineUsersCount = () => {
  return connectedClients.size;
};

// Check if user is online
export const isUserOnline = (userId) => {
  return connectedClients.has(userId);
};

// Get user's socket IDs
export const getUserSockets = (userId) => {
  return connectedClients.get(userId) || new Set();
};
