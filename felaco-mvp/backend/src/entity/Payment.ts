import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsIn, IsUUID } from 'class-validator';
import { User } from './User';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
export type PaymentMethod = 'credit_card' | 'paypal' | 'stripe' | 'bank_transfer' | 'other';

export type PaymentMetadata = {
  paymentMethodId?: string;
  receiptUrl?: string;
  invoiceId?: string;
  subscriptionId?: string;
  customerId?: string;
  paymentIntentId?: string;
  chargeId?: string;
  refundId?: string;
  failureCode?: string;
  failureMessage?: string;
  [key: string]: any;
};

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  @IsNumber()
  @Min(0, { message: 'Amount must be a positive number' })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  @IsString()
  @IsOptional()
  currency: string = 'USD';

  @Column({ type: 'varchar', length: 50 })
  @IsString()
  @IsNotEmpty({ message: 'Status is required' })
  @IsIn(['pending', 'completed', 'failed', 'refunded', 'cancelled'])
  status: PaymentStatus;

  @Column({ type: 'varchar', length: 50 })
  @IsString()
  @IsNotEmpty({ message: 'Payment method is required' })
  @IsIn(['credit_card', 'paypal', 'stripe', 'bank_transfer', 'other'])
  paymentMethod: PaymentMethod;

  @Column({ type: 'varchar', length: 100 })
  @IsString()
  @IsNotEmpty({ message: 'Payment type is required' })
  paymentType: string; // e.g., 'subscription', 'one_time', 'credit_purchase', 'refund'

  @Column({ type: 'varchar', length: 255, nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Column({ type: 'jsonb', default: {} })
  @IsOptional()
  metadata?: PaymentMetadata;

  @Column({ type: 'timestamp', nullable: true })
  @IsOptional()
  paidAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  @IsOptional()
  refundedAt?: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  @IsNumber()
  @Min(0, { message: 'Refund amount must be a positive number' })
  @IsOptional()
  refundAmount?: number;

  @Column({ type: 'uuid', name: 'user_id' })
  @IsUUID()
  userId: string;

  @ManyToOne(() => User, (user) => user.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Helper method to mark payment as completed
  markAsPaid(metadata: PaymentMetadata = {}) {
    this.status = 'completed';
    this.paidAt = new Date();
    this.metadata = { ...this.metadata, ...metadata };
  }

  // Helper method to process a refund
  processRefund(amount: number, reason?: string, metadata: PaymentMetadata = {}) {
    if (this.status !== 'completed') {
      throw new Error('Only completed payments can be refunded');
    }
    
    if (amount <= 0 || amount > this.amount) {
      throw new Error('Invalid refund amount');
    }

    this.status = amount === this.amount ? 'refunded' : 'completed';
    this.refundedAt = new Date();
    this.refundAmount = amount;
    
    if (reason) {
      this.metadata = {
        ...this.metadata,
        ...metadata,
        refundReason: reason,
        refundedAt: this.refundedAt.toISOString(),
      };
    }
  }

  // Convert to JSON, excluding sensitive data
  toJSON(): any {
    const { user, ...payment } = this;
    return {
      ...payment,
      user: user ? { id: user.id, email: user.email } : undefined,
    };
  }
}
