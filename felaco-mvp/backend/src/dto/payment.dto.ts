import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsIn, IsUUID, IsEmail, IsBoolean, IsObject, ValidateNested, IsArray, IsInt, Max } from 'class-validator';
import { Type } from 'class-transformer';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
export type PaymentMethod = 'credit_card' | 'paypal' | 'stripe' | 'bank_transfer' | 'other';

export class BillingAddressDto {
  @IsString()
  @IsNotEmpty({ message: 'Address line 1 is required' })
  line1: string;

  @IsString()
  @IsOptional()
  line2?: string;

  @IsString()
  @IsNotEmpty({ message: 'City is required' })
  city: string;

  @IsString()
  @IsNotEmpty({ message: 'State/Province is required' })
  state: string;

  @IsString()
  @IsNotEmpty({ message: 'Postal code is required' })
  postalCode: string;

  @IsString()
  @IsNotEmpty({ message: 'Country is required' })
  country: string;
}

export class PaymentCardDto {
  @IsString()
  @IsNotEmpty({ message: 'Card number is required' })
  number: string;

  @IsString()
  @IsNotEmpty({ message: 'Expiration month is required' })
  expMonth: string;

  @IsString()
  @IsNotEmpty({ message: 'Expiration year is required' })
  expYear: string;

  @IsString()
  @IsNotEmpty({ message: 'CVC is required' })
  cvc: string;

  @IsString()
  @IsOptional()
  name?: string;
}

export class CreatePaymentMethodDto {
  @IsString()
  @IsIn(['card', 'paypal', 'bank_account'])
  type: 'card' | 'paypal' | 'bank_account';

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentCardDto)
  card?: PaymentCardDto;

  @IsString()
  @IsOptional()
  paypalEmail?: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => BillingAddressDto)
  billingDetails?: BillingAddressDto;

  @IsBoolean()
  @IsOptional()
  setAsDefault: boolean = false;
}

export class CreatePaymentIntentDto {
  @IsNumber()
  @Min(0.5, { message: 'Amount must be at least 0.50' })
  amount: number;

  @IsString()
  @IsIn(['usd', 'eur', 'gbp', 'cad', 'aud'])
  @IsOptional()
  currency: string = 'usd';

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  paymentMethodId?: string;

  @IsString()
  @IsOptional()
  customerId?: string;

  @IsBoolean()
  @IsOptional()
  savePaymentMethod: boolean = false;

  @IsBoolean()
  @IsOptional()
  setupFutureUsage: boolean = false;

  @IsString()
  @IsOptional()
  returnUrl?: string;

  @IsString()
  @IsOptional()
  receiptEmail?: string;
}

export class ConfirmPaymentIntentDto {
  @IsString()
  @IsNotEmpty({ message: 'Payment intent ID is required' })
  paymentIntentId: string;

  @IsString()
  @IsOptional()
  paymentMethodId?: string;

  @IsBoolean()
  @IsOptional()
  savePaymentMethod: boolean = false;

  @IsString()
  @IsOptional()
  receiptEmail?: string;
}

export class CreateSubscriptionDto {
  @IsString()
  @IsIn(['basic', 'pro', 'enterprise', 'custom'])
  planId: 'basic' | 'pro' | 'enterprise' | 'custom';

  @IsString()
  @IsIn(['month', 'year'])
  interval: 'month' | 'year';

  @IsNumber()
  @Min(1)
  quantity: number = 1;

  @IsString()
  @IsOptional()
  couponCode?: string;

  @IsString()
  @IsOptional()
  paymentMethodId?: string;

  @IsBoolean()
  @IsOptional()
  trialPeriod: boolean = false;

  @IsInt()
  @Min(0)
  @Max(365)
  @IsOptional()
  trialDays?: number;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateSubscriptionDto {
  @IsString()
  @IsIn(['basic', 'pro', 'enterprise', 'custom'])
  @IsOptional()
  planId?: 'basic' | 'pro' | 'enterprise' | 'custom';

  @IsString()
  @IsIn(['month', 'year'])
  @IsOptional()
  interval?: 'month' | 'year';

  @IsNumber()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @IsBoolean()
  @IsOptional()
  prorate: boolean = true;

  @IsString()
  @IsOptional()
  couponCode?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class CancelSubscriptionDto {
  @IsBoolean()
  @IsOptional()
  cancelAtPeriodEnd: boolean = true;

  @IsString()
  @IsOptional()
  cancellationReason?: string;

  @IsString()
  @IsOptional()
  feedback?: string;
}

export class PurchaseCreditsDto {
  @IsString()
  @IsIn(['100', '500', '1000', '5000', '10000', 'custom'])
  package: '100' | '500' | '1000' | '5000' | '10000' | 'custom';

  @IsNumber()
  @Min(1)
  @IsOptional()
  customAmount?: number;

  @IsString()
  @IsOptional()
  paymentMethodId?: string;

  @IsString()
  @IsOptional()
  couponCode?: string;
}

export class ApplyCouponDto {
  @IsString()
  @IsNotEmpty({ message: 'Coupon code is required' })
  code: string;
}

export class PaymentListQueryDto {
  @IsString()
  @IsIn(['all', 'completed', 'pending', 'failed', 'refunded', 'cancelled'])
  @IsOptional()
  status?: 'all' | 'completed' | 'pending' | 'failed' | 'refunded' | 'cancelled' = 'all';

  @IsString()
  @IsIn(['all', 'subscription', 'one_time', 'credit_purchase', 'refund'])
  @IsOptional()
  type?: 'all' | 'subscription' | 'one_time' | 'credit_purchase' | 'refund' = 'all';

  @IsString()
  @IsOptional()
  search?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @IsString()
  @IsIn(['date', 'amount', 'status'])
  @IsOptional()
  sortBy?: 'date' | 'amount' | 'status' = 'date';

  @IsString()
  @IsIn(['ASC', 'DESC'])
  @IsOptional()
  order?: 'ASC' | 'DESC' = 'DESC';
}

export class InvoiceListQueryDto {
  @IsString()
  @IsIn(['all', 'paid', 'unpaid', 'void', 'uncollectible'])
  @IsOptional()
  status?: 'all' | 'paid' | 'unpaid' | 'void' | 'uncollectible' = 'all';

  @IsString()
  @IsOptional()
  subscriptionId?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @IsString()
  @IsIn(['date', 'amount', 'status'])
  @IsOptional()
  sortBy?: 'date' | 'amount' | 'status' = 'date';

  @IsString()
  @IsIn(['ASC', 'DESC'])
  @IsOptional()
  order?: 'ASC' | 'DESC' = 'DESC';
}

export class PaymentMethodListQueryDto {
  @IsString()
  @IsIn(['all', 'card', 'paypal', 'bank_account'])
  @IsOptional()
  type?: 'all' | 'card' | 'paypal' | 'bank_account' = 'all';

  @IsBoolean()
  @IsOptional()
  includeExpired: boolean = false;
}

export class UpdatePaymentMethodDto {
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => BillingAddressDto)
  billingDetails?: BillingAddressDto;

  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
