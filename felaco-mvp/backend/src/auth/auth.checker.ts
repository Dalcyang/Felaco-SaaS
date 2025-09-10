import { Action } from 'routing-controllers';
import { User } from '../entity/User';
import { getRepository } from 'typeorm';
import { verifyToken } from './jwt.utils';
import { UnauthorizedError, ForbiddenError } from '../middleware/error.middleware';

export const authChecker = async (action: Action, roles: string[] = []) => {
  try {
    const token = action.request.headers['authorization']?.split(' ')[1];
    
    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    // Verify the token and get the payload
    const payload = verifyToken(token);
    
    if (!payload || !payload.userId) {
      throw new UnauthorizedError('Invalid token');
    }

    // Get user from database
    const userRepository = getRepository(User);
    const user = await userRepository.findOne(payload.userId);
    
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Check if user has required roles
    if (roles && roles.length > 0) {
      const hasRole = roles.some(role => user.roles.includes(role));
      if (!hasRole) {
        throw new ForbiddenError('Insufficient permissions');
      }
    }

    // Attach user to request for use in controllers
    action.request.user = user;
    
    return true;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new UnauthorizedError('Invalid token');
    }
    throw error;
  }
};

export const currentUserChecker = async (action: Action) => {
  try {
    const token = action.request.headers['authorization']?.split(' ')[1];
    
    if (!token) {
      return null;
    }

    const payload = verifyToken(token);
    
    if (!payload || !payload.userId) {
      return null;
    }

    const userRepository = getRepository(User);
    const user = await userRepository.findOne(payload.userId, {
      select: ['id', 'email', 'name', 'roles', 'createdAt', 'updatedAt']
    });
    
    return user || null;
  } catch (error) {
    return null;
  }
};
