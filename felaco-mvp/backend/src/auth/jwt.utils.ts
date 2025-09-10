import jwt from 'jsonwebtoken';
import { User } from '../entity/User';

// Token expiration times
const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

// Token types
export enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh'
}

// Token payload interface
export interface TokenPayload {
  userId: string;
  email: string;
  type: TokenType;
  iat?: number;
  exp?: number;
}

/**
 * Generate JWT token
 */
export const generateToken = (
  user: User,
  type: TokenType = TokenType.ACCESS
): string => {
  const secret = type === TokenType.ACCESS 
    ? process.env.JWT_SECRET 
    : process.env.JWT_REFRESH_SECRET;
    
  if (!secret) {
    throw new Error('JWT secret is not defined');
  }

  const expiresIn = type === TokenType.ACCESS 
    ? ACCESS_TOKEN_EXPIRES_IN 
    : REFRESH_TOKEN_EXPIRES_IN;

  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    type,
  };

  return jwt.sign(payload, secret, { expiresIn });
};

/**
 * Generate both access and refresh tokens
 */
export const generateAuthTokens = (user: User): { accessToken: string; refreshToken: string } => {
  return {
    accessToken: generateToken(user, TokenType.ACCESS),
    refreshToken: generateToken(user, TokenType.REFRESH),
  };
};

/**
 * Verify JWT token
 */
export const verifyToken = (token: string, type: TokenType = TokenType.ACCESS): TokenPayload => {
  const secret = type === TokenType.ACCESS 
    ? process.env.JWT_SECRET 
    : process.env.JWT_REFRESH_SECRET;
    
  if (!secret) {
    throw new Error('JWT secret is not defined');
  }

  try {
    const payload = jwt.verify(token, secret) as TokenPayload;
    
    // Verify token type matches
    if (payload.type !== type) {
      throw new Error('Invalid token type');
    }
    
    return payload;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      throw expiredError;
    }
    
    const invalidError = new Error('Invalid token');
    invalidError.name = 'JsonWebTokenError';
    throw invalidError;
  }
};

/**
 * Decode JWT token without verification
 */
export const decodeToken = (token: string): TokenPayload | null => {
  try {
    const decoded = jwt.decode(token);
    return decoded as TokenPayload;
  } catch (error) {
    return null;
  }
};

/**
 * Generate password reset token
 */
export const generatePasswordResetToken = (user: User): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT secret is not defined');
  }

  const payload = {
    userId: user.id,
    email: user.email,
    type: 'password_reset',
  };

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
};

/**
 * Verify password reset token
 */
export const verifyPasswordResetToken = (token: string): { userId: string; email: string } => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT secret is not defined');
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET) as {
      userId: string;
      email: string;
      type: string;
    };

    if (payload.type !== 'password_reset') {
      throw new Error('Invalid token type');
    }

    return {
      userId: payload.userId,
      email: payload.email,
    };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      const expiredError = new Error('Password reset token has expired');
      expiredError.name = 'TokenExpiredError';
      throw expiredError;
    }
    
    const invalidError = new Error('Invalid password reset token');
    invalidError.name = 'JsonWebTokenError';
    throw invalidError;
  }
};
