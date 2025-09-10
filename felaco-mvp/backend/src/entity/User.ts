import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, BeforeInsert, BeforeUpdate, OneToMany } from 'typeorm';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, MaxLength, IsArray, IsIn } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { Site } from './Site';
import { AICredits } from './AICredits';
import { Payment } from './Payment';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @Column({ select: false })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(100, { message: 'Password cannot be longer than 100 characters' })
  password: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @MaxLength(100, { message: 'Name cannot be longer than 100 characters' })
  name?: string;

  @Column('text', { array: true, default: '{user}' })
  @IsArray({ message: 'Roles must be an array' })
  @IsIn(['user', 'admin'], { each: true, message: 'Invalid role' })
  roles: string[];

  @Column({ nullable: true })
  @IsOptional()
  @IsString({ message: 'Avatar URL must be a string' })
  avatarUrl?: string;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ nullable: true })
  emailVerificationToken?: string;

  @Column({ nullable: true })
  emailVerificationExpires?: Date;

  @Column({ nullable: true })
  passwordResetToken?: string;

  @Column({ nullable: true })
  passwordResetExpires?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastLogin?: Date;

  @OneToMany(() => Site, site => site.owner)
  sites: Site[];

  @OneToMany(() => AICredits, credits => credits.user)
  aiCredits: AICredits;

  @OneToMany(() => Payment, payment => payment.user)
  payments: Payment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Hash password before saving
  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }
  }

  // Validate password
  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  // Set password with hashing
  setPassword(password: string) {
    this.password = password;
  }

  // Generate email verification token
  generateEmailVerificationToken(): string {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    this.emailVerificationToken = token;
    this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    return token;
  }

  // Generate password reset token
  generatePasswordResetToken(): string {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    this.passwordResetToken = token;
    this.passwordResetExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour
    return token;
  }

  // Convert to JSON, excluding sensitive data
  toJSON(): any {
    const { password, emailVerificationToken, passwordResetToken, passwordResetExpires, ...user } = this;
    return user;
  }
}
