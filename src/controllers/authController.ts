import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword } from '../utils/password';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { createAuditLog } from '../utils/audit';

const prisma = new PrismaClient();

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { hospital: true },
    });

    if (!user || !user.active) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate tokens
    const userPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const accessToken = generateAccessToken(userPayload);
    const refreshToken = generateRefreshToken(userPayload);

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Audit log
    await createAuditLog(prisma, {
      userId: user.id,
      hospitalId: user.hospitalId || undefined,
      action: 'LOGIN',
      entity: 'USER',
      entityId: user.id,
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        hospitalId: user.hospitalId,
        hospital: user.hospital,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

export const refreshTokenHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }

    // Verify token
    const decoded = verifyRefreshToken(refreshToken);

    // Check if token exists in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user || !user.active) {
      res.status(401).json({ error: 'User not found or inactive' });
      return;
    }

    // Generate new tokens
    const userPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const newAccessToken = generateAccessToken(userPayload);
    const newRefreshToken = generateRefreshToken(userPayload);

    // Delete old refresh token
    await prisma.refreshToken.delete({
      where: { token: refreshToken },
    });

    // Store new refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ error: 'Token refresh failed' });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }

    // Audit log
    if (req.user) {
      await createAuditLog(prisma, {
        userId: req.user.id,
        hospitalId: req.user.hospitalId || undefined,
        action: 'LOGOUT',
        entity: 'USER',
        entityId: req.user.id,
        ipAddress: String(req.ip || req.socket.remoteAddress || ''),
        userAgent: String(req.headers['user-agent'] || ''),
      });
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      res.status(400).json({ error: 'Old and new passwords are required' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters' });
      return;
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Verify old password
    const isValidPassword = await comparePassword(oldPassword, user.password);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Incorrect old password' });
      return;
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Audit log
    await createAuditLog(prisma, {
      userId: user.id,
      hospitalId: user.hospitalId || undefined,
      action: 'CHANGE_PASSWORD',
      entity: 'USER',
      entityId: user.id,
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Password change failed' });
  }
};

// First-time setup - creates initial superadmin when no users exist
export const initialSetup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Check if any users exist
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      res.status(403).json({ error: 'Setup already completed. Users already exist.' });
      return;
    }

    // Validate input
    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ error: 'Email, password, firstName, and lastName are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    // Create the initial superadmin
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'SUPER_ADMIN',
        active: true,
      },
    });

    // Generate tokens
    const userPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const accessToken = generateAccessToken(userPayload);
    const refreshToken = generateRefreshToken(userPayload);

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    res.status(201).json({
      message: 'Initial setup complete. Superadmin created.',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Initial setup error:', error);
    res.status(500).json({ error: 'Setup failed' });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        hospitalId: true,
        department: true,
        active: true,
        lastLogin: true,
        createdAt: true,
        hospital: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
};
