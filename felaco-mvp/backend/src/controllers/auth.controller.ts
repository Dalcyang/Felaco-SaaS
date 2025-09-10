import {
  JsonController,
  Post,
  Body,
  HttpCode,
  UseBefore,
  Req,
  Res,
  Get,
  Authorized,
  CurrentUser,
} from 'routing-controllers';
import { Request, Response } from 'express';
import { getRepository } from 'typeorm';
import { User } from '../entity/User';
import { generateAuthTokens, verifyToken, TokenType } from '../auth/jwt.utils';
import { validate } from 'class-validator';
import { asyncHandler } from '../middleware/async.handler';
import { logger } from '../common/logger';
import { redisClient } from '../config/redis';
import {
  UnauthorizedError,
  ValidationErrorResponse,
  ConflictError,
  NotFoundError,
  BadRequestError,
} from '../middleware/error.middleware';
import { LoginDto, RegisterDto, RefreshTokenDto, ForgotPasswordDto, ResetPasswordDto } from '../dto/auth.dto';

@JsonController('/auth')
export class AuthController {
  private userRepository = getRepository(User);

  /**
   * Register a new user
   */
  @Post('/register')
  @HttpCode(201)
  async register(@Body() registerDto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({ where: { email: registerDto.email } });
    if (existingUser) {
      throw new ConflictError('Email already in use');
    }

    // Create new user
    const user = new User();
    user.email = registerDto.email;
    user.name = registerDto.name;
    user.setPassword(registerDto.password);
    user.roles = ['user']; // Default role

    // Validate user
    const errors = await validate(user);
    if (errors.length > 0) {
      throw new ValidationErrorResponse(errors);
    }

    // Save user to database
    await this.userRepository.save(user);

    // Generate tokens
    const { accessToken, refreshToken } = generateAuthTokens(user);

    // Store refresh token in Redis
    await redisClient.set(`refresh_token:${user.id}`, refreshToken, {
      EX: 7 * 24 * 60 * 60, // 7 days
    });

    // Remove sensitive data before sending response
    const userData = user.toJSON();
    delete userData.password;
    delete userData.refreshToken;

    logger.info(`New user registered: ${user.email}`);

    return {
      user: userData,
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  /**
   * Login user
   */
  @Post('/login')
  @HttpCode(200)
  async login(@Body() loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check password
    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateAuthTokens(user);

    // Store refresh token in Redis
    await redisClient.set(`refresh_token:${user.id}`, refreshToken, {
      EX: 7 * 24 * 60 * 60, // 7 days
    });

    // Update last login
    user.lastLogin = new Date();
    await this.userRepository.save(user);

    // Remove sensitive data before sending response
    const userData = user.toJSON();
    delete userData.password;
    delete userData.refreshToken;

    logger.info(`User logged in: ${user.email}`);

    return {
      user: userData,
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  /**
   * Refresh access token
   */
  @Post('/refresh-token')
  @HttpCode(200)
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = refreshTokenDto;

    if (!refreshToken) {
      throw new BadRequestError('Refresh token is required');
    }

    // Verify refresh token
    let payload;
    try {
      payload = verifyToken(refreshToken, TokenType.REFRESH);
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Get user from database
    const user = await this.userRepository.findOne(payload.userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify refresh token in Redis
    const storedRefreshToken = await redisClient.get(`refresh_token:${user.id}`);
    if (storedRefreshToken !== refreshToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Generate new tokens
    const tokens = generateAuthTokens(user);

    // Update refresh token in Redis
    await redisClient.set(`refresh_token:${user.id}`, tokens.refreshToken, {
      EX: 7 * 24 * 60 * 60, // 7 days
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Logout user
   */
  @Post('/logout')
  @Authorized()
  @HttpCode(200)
  async logout(@CurrentUser() user: User) {
    // Remove refresh token from Redis
    await redisClient.del(`refresh_token:${user.id}`);
    
    logger.info(`User logged out: ${user.email}`);
    
    return { success: true };
  }

  /**
   * Get current user profile
   */
  @Get('/me')
  @Authorized()
  @HttpCode(200)
  async getCurrentUser(@CurrentUser() user: User) {
    const userData = user.toJSON();
    delete userData.password;
    delete userData.refreshToken;
    
    return { user: userData };
  }

  /**
   * Forgot password - send reset password email
   */
  @Post('/forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    // Find user by email
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      // Don't reveal that the email doesn't exist for security reasons
      return { success: true };
    }

    // Generate password reset token
    const resetToken = generatePasswordResetToken(user);
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    // TODO: Send email with reset link
    logger.info(`Password reset link for ${email}: ${resetUrl}`);

    return { success: true };
  }

  /**
   * Reset password with token from email
   */
  @Post('/reset-password')
  @HttpCode(200)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    const { token, password } = resetPasswordDto;

    // Verify token
    let payload;
    try {
      payload = verifyPasswordResetToken(token);
    } catch (error) {
      throw new BadRequestError('Invalid or expired reset token');
    }

    // Find user
    const user = await this.userRepository.findOne(payload.userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Update password
    user.setPassword(password);
    await this.userRepository.save(user);

    // Invalidate all user's sessions
    await redisClient.del(`refresh_token:${user.id}`);

    logger.info(`Password reset for user: ${user.email}`);

    return { success: true };
  }
}

// Helper functions for password reset
export function generatePasswordResetToken(user: User): string {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT secret is not defined');
  }

  const payload = {
    userId: user.id,
    email: user.email,
    type: 'password_reset',
  };

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
}

export function verifyPasswordResetToken(token: string): { userId: string; email: string } {
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
}
