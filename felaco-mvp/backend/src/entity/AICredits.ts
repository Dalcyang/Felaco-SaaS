import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { IsInt, Min, IsUUID, IsOptional } from 'class-validator';
import { User } from './User';

@Entity('ai_credits')
export class AICredits {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', default: 0 })
  @IsInt()
  @Min(0, { message: 'Credits must be a positive number' })
  credits: number;

  @Column({ type: 'int', default: 0 })
  @IsInt()
  @Min(0, { message: 'Used credits must be a positive number' })
  usedCredits: number;

  @Column({ type: 'timestamp', nullable: true })
  @IsOptional()
  lastResetAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  @IsOptional()
  nextResetAt?: Date;

  @Column({ type: 'varchar', length: 50, default: 'monthly' })
  @IsOptional()
  resetFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

  @Column({ type: 'uuid', name: 'user_id' })
  @IsUUID()
  userId: string;

  @ManyToOne(() => User, (user) => user.aiCredits, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Helper method to check if there are enough credits available
  hasEnoughCredits(required: number): boolean {
    return this.credits - this.usedCredits >= required;
  }

  // Helper method to use credits
  useCredits(amount: number): boolean {
    if (!this.hasEnoughCredits(amount)) {
      return false;
    }
    this.usedCredits += amount;
    return true;
  }

  // Helper method to add credits
  addCredits(amount: number): void {
    this.credits += amount;
  }

  // Helper method to reset used credits based on reset frequency
  resetCreditsIfNeeded(): boolean {
    if (this.resetFrequency === 'never' || !this.nextResetAt) {
      return false;
    }

    const now = new Date();
    if (now >= this.nextResetAt) {
      this.lastResetAt = now;
      this.usedCredits = 0;
      
      // Set next reset date based on frequency
      const nextReset = new Date(now);
      switch (this.resetFrequency) {
        case 'daily':
          nextReset.setDate(now.getDate() + 1);
          break;
        case 'weekly':
          nextReset.setDate(now.getDate() + 7);
          break;
        case 'monthly':
          nextReset.setMonth(now.getMonth() + 1);
          break;
        case 'yearly':
          nextReset.setFullYear(now.getFullYear() + 1);
          break;
      }
      this.nextResetAt = nextReset;
      return true;
    }
    return false;
  }

  // Convert to JSON, excluding sensitive data
  toJSON(): any {
    const { user, ...credits } = this;
    return {
      ...credits,
      availableCredits: this.credits - this.usedCredits,
      user: user ? { id: user.id, email: user.email } : undefined,
    };
  }
}
