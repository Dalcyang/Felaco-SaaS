import {
  JsonController,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  QueryParams,
  CurrentUser,
  Authorized,
  HttpCode,
  OnUndefined,
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from 'routing-controllers';
import { getRepository, In } from 'typeorm';
import { User } from '../entity/User';
import { Payment } from '../entity/Payment';
import { AICredits } from '../entity/AICredits';
import { 
  CreatePaymentMethodDto, 
  CreatePaymentIntentDto, 
  ConfirmPaymentIntentDto,
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  CancelSubscriptionDto,
  PurchaseCreditsDto,
  ApplyCouponDto,
  PaymentListQueryDto,
  InvoiceListQueryDto,
  PaymentMethodListQueryDto,
  UpdatePaymentMethodDto,
  BillingAddressDto
} from '../dto/payment.dto';
import { validate } from 'class-validator';
import { logger } from '../common/logger';
import { ApiResponse } from '../common/api.response';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

@JsonController('/payments')
@Authorized()
export class PaymentController {
  private userRepository = getRepository(User);
  private paymentRepository = getRepository(Payment);
  private aiCreditsRepository = getRepository(AICredits);
  private stripe: Stripe;

  constructor() {
    // Initialize Stripe with API key from environment variables
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16', // Use the latest API version
    });
  }

  /**
   * Get payment methods for the current user
   */
  @Get('/methods')
  async getPaymentMethods(
    @QueryParams() query: PaymentMethodListQueryDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<{ methods: any[] }>> {
    // If user doesn't have a Stripe customer ID, return empty array
    if (!user.stripeCustomerId) {
      return {
        success: true,
        data: { methods: [] },
      };
    }

    try {
      // List payment methods from Stripe
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
        type: query.type === 'all' ? undefined : query.type as any,
      });

      // Filter out expired cards if needed
      let methods = paymentMethods.data;
      if (!query.includeExpired) {
        const now = new Date();
        methods = methods.filter(method => {
          if (method.type !== 'card') return true;
          const expYear = method.card?.exp_year || 0;
          const expMonth = (method.card?.exp_month || 0) - 1; // JS months are 0-indexed
          const expiryDate = new Date(expYear, expMonth + 1, 0); // Last day of expiry month
          return expiryDate > now;
        });
      }

      return {
        success: true,
        data: { methods },
      };
    } catch (error) {
      logger.error('Failed to fetch payment methods', { error, userId: user.id });
      throw new BadRequestError('Failed to fetch payment methods. Please try again.');
    }
  }

  /**
   * Add a payment method
   */
  @Post('/methods')
  async addPaymentMethod(
    @Body() createMethodDto: CreatePaymentMethodDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<{ method: any }>> {
    // Validate DTO
    const errors = await validate(createMethodDto);
    if (errors.length > 0) {
      throw new BadRequestError('Validation failed', { errors });
    }

    try {
      // Create or retrieve Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await this.stripe.customers.create({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`.trim(),
          metadata: { userId: user.id },
        });
        
        // Save customer ID to user
        user.stripeCustomerId = customer.id;
        await this.userRepository.save(user);
        customerId = customer.id;
      }

      // Handle different payment method types
      let paymentMethod: Stripe.PaymentMethod;
      
      if (createMethodDto.type === 'card' && createMethodDto.card) {
        // Create payment method from card details
        paymentMethod = await this.stripe.paymentMethods.create({
          type: 'card',
          card: {
            number: createMethodDto.card.number,
            exp_month: parseInt(createMethodDto.card.expMonth),
            exp_year: parseInt(createMethodDto.card.expYear),
            cvc: createMethodDto.card.cvc,
          },
          billing_details: createMethodDto.billingDetails ? {
            name: createMethodDto.billingDetails.name || createMethodDto.card.name,
            email: user.email,
            address: createMethodDto.billingDetails ? {
              line1: createMethodDto.billingDetails.line1,
              line2: createMethodDto.billingDetails.line2,
              city: createMethodDto.billingDetails.city,
              state: createMethodDto.billingDetails.state,
              postal_code: createMethodDto.billingDetails.postalCode,
              country: createMethodDto.billingDetails.country,
            } : undefined,
          } : undefined,
        });
      } else if (createMethodDto.type === 'paypal' && createMethodDto.paypalEmail) {
        // For PayPal, we would typically handle this differently (client-side with Stripe Elements)
        // This is a simplified example
        throw new BadRequestError('PayPal integration requires client-side implementation');
      } else {
        throw new BadRequestError('Invalid payment method type or missing required fields');
      }

      // Attach payment method to customer
      await this.stripe.paymentMethods.attach(paymentMethod.id, {
        customer: customerId,
      });

      // If this is the first payment method or user wants to set as default
      if (createMethodDto.setAsDefault) {
        await this.stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethod.id,
          },
        });
      }

      logger.info(`Payment method ${paymentMethod.id} added for user ${user.id}`);

      return {
        success: true,
        data: { method: paymentMethod },
        message: 'Payment method added successfully',
      };
    } catch (error) {
      logger.error('Failed to add payment method', { error, userId: user.id });
      
      // Handle Stripe errors
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestError(error.message);
      }
      
      throw new BadRequestError('Failed to add payment method. Please try again.');
    }
  }

  /**
   * Update a payment method
   */
  @Put('/methods/:id')
  async updatePaymentMethod(
    @Param('id') id: string,
    @Body() updateMethodDto: UpdatePaymentMethodDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<{ method: any }>> {
    // Validate DTO
    const errors = await validate(updateMethodDto);
    if (errors.length > 0) {
      throw new BadRequestError('Validation failed', { errors });
    }

    if (!user.stripeCustomerId) {
      throw new BadRequestError('No payment methods found');
    }

    try {
      // Verify the payment method belongs to the user
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
      });
      
      const paymentMethod = paymentMethods.data.find(pm => pm.id === id);
      if (!paymentMethod) {
        throw new NotFoundError('Payment method not found');
      }

      // Update payment method
      const updatedMethod = await this.stripe.paymentMethods.update(id, {
        billing_details: updateMethodDto.billingDetails ? {
          name: updateMethodDto.name,
          address: updateMethodDto.billingDetails ? {
            line1: updateMethodDto.billingDetails.line1,
            line2: updateMethodDto.billingDetails.line2,
            city: updateMethodDto.billingDetails.city,
            state: updateMethodDto.billingDetails.state,
            postal_code: updateMethodDto.billingDetails.postalCode,
            country: updateMethodDto.billingDetails.country,
          } : undefined,
        } : undefined,
        metadata: updateMethodDto.metadata,
      });

      // If setting as default
      if (updateMethodDto.isDefault) {
        await this.stripe.customers.update(user.stripeCustomerId, {
          invoice_settings: {
            default_payment_method: id,
          },
        });
      }

      logger.info(`Payment method ${id} updated by user ${user.id}`);

      return {
        success: true,
        data: { method: updatedMethod },
        message: 'Payment method updated successfully',
      };
    } catch (error) {
      logger.error('Failed to update payment method', { error, userId: user.id, methodId: id });
      
      // Handle Stripe errors
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestError(error.message);
      }
      
      throw new BadRequestError('Failed to update payment method. Please try again.');
    }
  }

  /**
   * Remove a payment method
   */
  @Delete('/methods/:id')
  @HttpCode(204)
  @OnUndefined(204)
  async removePaymentMethod(
    @Param('id') id: string,
    @CurrentUser() user: User
  ): Promise<void> {
    if (!user.stripeCustomerId) {
      throw new BadRequestError('No payment methods found');
    }

    try {
      // Verify the payment method belongs to the user
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
      });
      
      const paymentMethod = paymentMethods.data.find(pm => pm.id === id);
      if (!paymentMethod) {
        throw new NotFoundError('Payment method not found');
      }

      // Detach payment method from customer
      await this.stripe.paymentMethods.detach(id);

      logger.info(`Payment method ${id} removed by user ${user.id}`);
    } catch (error) {
      logger.error('Failed to remove payment method', { error, userId: user.id, methodId: id });
      
      // Handle Stripe errors
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestError(error.message);
      }
      
      throw new BadRequestError('Failed to remove payment method. Please try again.');
    }
  }

  /**
   * Create a payment intent for one-time payments
   */
  @Post('/intents')
  async createPaymentIntent(
    @Body() createIntentDto: CreatePaymentIntentDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<{ clientSecret: string; intentId: string }>> {
    // Validate DTO
    const errors = await validate(createIntentDto);
    if (errors.length > 0) {
      throw new BadRequestError('Validation failed', { errors });
    }

    try {
      // Create or retrieve Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await this.stripe.customers.create({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`.trim(),
          metadata: { userId: user.id },
        });
        
        // Save customer ID to user
        user.stripeCustomerId = customer.id;
        await this.userRepository.save(user);
        customerId = customer.id;
      }

      // Create a payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(createIntentDto.amount * 100), // Convert to cents
        currency: createIntentDto.currency || 'usd',
        customer: customerId,
        description: createIntentDto.description,
        metadata: createIntentDto.metadata,
        payment_method: createIntentDto.paymentMethodId,
        confirm: false, // Just create, don't confirm yet
        setup_future_usage: createIntentDto.setupFutureUsage ? 'off_session' : undefined,
        return_url: createIntentDto.returnUrl,
        receipt_email: createIntentDto.receiptEmail || user.email,
      });

      // Create a payment record
      const payment = new Payment();
      payment.amount = createIntentDto.amount;
      payment.currency = createIntentDto.currency || 'usd';
      payment.status = 'pending';
      payment.paymentMethod = createIntentDto.paymentMethodId || 'card';
      payment.paymentType = createIntentDto.metadata?.type || 'one_time';
      payment.description = createIntentDto.description || 'One-time payment';
      payment.user = user;
      payment.metadata = {
        ...createIntentDto.metadata,
        stripePaymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
      };

      await this.paymentRepository.save(payment);

      logger.info(`Payment intent created: ${paymentIntent.id} for user ${user.id}`);

      return {
        success: true,
        data: {
          clientSecret: paymentIntent.client_secret || '',
          intentId: paymentIntent.id,
        },
        message: 'Payment intent created successfully',
      };
    } catch (error) {
      logger.error('Failed to create payment intent', { error, userId: user.id });
      
      // Handle Stripe errors
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestError(error.message);
      }
      
      throw new BadRequestError('Failed to create payment intent. Please try again.');
    }
  }

  /**
   * Confirm a payment intent
   */
  @Post('/intents/:id/confirm')
  async confirmPaymentIntent(
    @Param('id') id: string,
    @Body() confirmIntentDto: ConfirmPaymentIntentDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<{ payment: any; status: string }>> {
    // Validate DTO
    const errors = await validate(confirmIntentDto);
    if (errors.length > 0) {
      throw new BadRequestError('Validation failed', { errors });
    }

    try {
      // Retrieve the payment intent
      const paymentIntent = await this.stripe.paymentIntents.retrieve(id);
      
      // Verify the payment intent belongs to the user
      if (paymentIntent.customer !== user.stripeCustomerId) {
        throw new ForbiddenError('You do not have permission to confirm this payment');
      }

      // Update payment method if provided
      if (confirmIntentDto.paymentMethodId) {
        await this.stripe.paymentIntents.update(id, {
          payment_method: confirmIntentDto.paymentMethodId,
        });
      }

      // Confirm the payment intent
      const confirmedIntent = await this.stripe.paymentIntents.confirm(id, {
        payment_method: confirmIntentDto.paymentMethodId,
        receipt_email: confirmIntentDto.receiptEmail || user.email,
      });

      // Update the payment record
      const payment = await this.paymentRepository.findOne({
        where: { metadata: { stripePaymentIntentId: id } },
      });

      if (payment) {
        payment.status = confirmedIntent.status as any;
        payment.paidAt = new Date();
        
        if (confirmIntentDto.savePaymentMethod && user.stripeCustomerId) {
          // Save the payment method for future use
          await this.stripe.setupIntents.create({
            payment_method: confirmedIntent.payment_method as string,
            customer: user.stripeCustomerId,
            confirm: true,
          });
        }

        await this.paymentRepository.save(payment);
      }

      logger.info(`Payment intent confirmed: ${id} for user ${user.id}`);

      return {
        success: true,
        data: {
          payment: confirmedIntent,
          status: confirmedIntent.status,
        },
        message: 'Payment confirmed successfully',
      };
    } catch (error) {
      logger.error('Failed to confirm payment intent', { error, userId: user.id, intentId: id });
      
      // Handle Stripe errors
      if (error instanceof Stripe.errors.StripeError) {
        // Update payment status if it's a failure
        if (error.type === 'card_error' || error.type === 'invalid_request_error') {
          const payment = await this.paymentRepository.findOne({
            where: { metadata: { stripePaymentIntentId: id } },
          });
          
          if (payment) {
            payment.status = 'failed';
            payment.metadata = {
              ...payment.metadata,
              error: error.message,
              errorType: error.type,
              errorCode: (error as any).code,
            };
            await this.paymentRepository.save(payment);
          }
        }
        
        throw new BadRequestError(error.message);
      }
      
      throw new BadRequestError('Failed to confirm payment. Please try again.');
    }
  }

  /**
   * Create a subscription
   */
  @Post('/subscriptions')
  async createSubscription(
    @Body() createSubDto: CreateSubscriptionDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<{ subscription: any; clientSecret?: string }>> {
    // Validate DTO
    const errors = await validate(createSubDto);
    if (errors.length > 0) {
      throw new BadRequestError('Validation failed', { errors });
    }

    try {
      // Create or retrieve Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await this.stripe.customers.create({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`.trim(),
          metadata: { userId: user.id },
        });
        
        // Save customer ID to user
        user.stripeCustomerId = customer.id;
        await this.userRepository.save(user);
        customerId = customer.id;
      }

      // Get the price ID for the selected plan and interval
      const priceId = this.getPriceIdForPlan(createSubDto.planId, createSubDto.interval);
      
      if (!priceId) {
        throw new BadRequestError('Invalid plan or interval');
      }

      // Create subscription
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [
          {
            price: priceId,
            quantity: createSubDto.quantity || 1,
          },
        ],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        trial_period_days: createSubDto.trialPeriod ? (createSubDto.trialDays || 14) : undefined,
        metadata: {
          userId: user.id,
          planId: createSubDto.planId,
          interval: createSubDto.interval,
        },
      });

      const latestInvoice = subscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent;

      // Create a payment record
      const payment = new Payment();
      payment.amount = latestInvoice?.amount_due ? latestInvoice.amount_due / 100 : 0;
      payment.currency = latestInvoice?.currency || 'usd';
      payment.status = 'pending';
      payment.paymentMethod = createSubDto.paymentMethodId || 'card';
      payment.paymentType = 'subscription';
      payment.description = `Subscription to ${createSubDto.planId} plan (${createSubDto.interval}ly)`;
      payment.user = user;
      payment.metadata = {
        planId: createSubDto.planId,
        interval: createSubDto.interval,
        subscriptionId: subscription.id,
        invoiceId: latestInvoice?.id,
        paymentIntentId: paymentIntent?.id,
        clientSecret: paymentIntent?.client_secret,
      };

      await this.paymentRepository.save(payment);

      logger.info(`Subscription created: ${subscription.id} for user ${user.id}`);

      return {
        success: true,
        data: {
          subscription,
          clientSecret: paymentIntent?.client_secret,
        },
        message: 'Subscription created successfully',
      };
    } catch (error) {
      logger.error('Failed to create subscription', { error, userId: user.id });
      
      // Handle Stripe errors
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestError(error.message);
      }
      
      throw new BadRequestError('Failed to create subscription. Please try again.');
    }
  }

  /**
   * Update a subscription
   */
  @Put('/subscriptions/:id')
  async updateSubscription(
    @Param('id') id: string,
    @Body() updateSubDto: UpdateSubscriptionDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<{ subscription: any }>> {
    // Validate DTO
    const errors = await validate(updateSubDto);
    if (errors.length > 0) {
      throw new BadRequestError('Validation failed', { errors });
    }

    try {
      // Retrieve the subscription
      const subscription = await this.stripe.subscriptions.retrieve(id);
      
      // Verify the subscription belongs to the user
      if (subscription.customer !== user.stripeCustomerId) {
        throw new ForbiddenError('You do not have permission to update this subscription');
      }

      // Build update object
      const updateParams: Stripe.SubscriptionUpdateParams = {};
      
      // Update plan if needed
      if (updateSubDto.planId && updateSubDto.interval) {
        const priceId = this.getPriceIdForPlan(updateSubDto.planId, updateSubDto.interval);
        
        if (!priceId) {
          throw new BadRequestError('Invalid plan or interval');
        }

        // Find the subscription item to update
        const itemId = subscription.items.data[0]?.id;
        
        if (itemId) {
          updateParams.items = [{
            id: itemId,
            price: priceId,
            quantity: updateSubDto.quantity || 1,
          }];
          
          updateParams.proration_behavior = updateSubDto.prorate ? 'create_prorations' : 'none';
        }
      }
      
      // Update quantity if needed
      if (updateSubDto.quantity && !updateSubDto.planId) {
        const itemId = subscription.items.data[0]?.id;
        
        if (itemId) {
          updateParams.items = [{
            id: itemId,
            quantity: updateSubDto.quantity,
          }];
        }
      }
      
      // Apply coupon if provided
      if (updateSubDto.couponCode) {
        updateParams.coupon = updateSubDto.couponCode;
      }
      
      // Update metadata if provided
      if (updateSubDto.metadata) {
        updateParams.metadata = {
          ...subscription.metadata,
          ...updateSubDto.metadata,
        };
      }

      // Update the subscription
      const updatedSubscription = await this.stripe.subscriptions.update(id, updateParams);

      logger.info(`Subscription updated: ${id} by user ${user.id}`);

      return {
        success: true,
        data: { subscription: updatedSubscription },
        message: 'Subscription updated successfully',
      };
    } catch (error) {
      logger.error('Failed to update subscription', { error, userId: user.id, subscriptionId: id });
      
      // Handle Stripe errors
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestError(error.message);
      }
      
      throw new BadRequestError('Failed to update subscription. Please try again.');
    }
  }

  /**
   * Cancel a subscription
   */
  @Post('/subscriptions/:id/cancel')
  async cancelSubscription(
    @Param('id') id: string,
    @Body() cancelDto: CancelSubscriptionDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<{ subscription: any }>> {
    try {
      // Retrieve the subscription
      const subscription = await this.stripe.subscriptions.retrieve(id);
      
      // Verify the subscription belongs to the user
      if (subscription.customer !== user.stripeCustomerId) {
        throw new ForbiddenError('You do not have permission to cancel this subscription');
      }

      // Cancel the subscription
      const canceledSubscription = await this.stripe.subscriptions.update(id, {
        cancel_at_period_end: cancelDto.cancelAtPeriodEnd,
        metadata: {
          ...subscription.metadata,
          cancellationReason: cancelDto.cancellationReason,
          feedback: cancelDto.feedback,
        },
      });

      // Update the payment record
      const payment = await this.paymentRepository.findOne({
        where: { metadata: { subscriptionId: id } },
        order: { createdAt: 'DESC' },
      });

      if (payment) {
        payment.status = cancelDto.cancelAtPeriodEnd ? 'pending_cancelation' : 'canceled';
        payment.metadata = {
          ...payment.metadata,
          cancellationReason: cancelDto.cancellationReason,
          canceledAt: new Date().toISOString(),
        };
        await this.paymentRepository.save(payment);
      }

      logger.info(`Subscription ${cancelDto.cancelAtPeriodEnd ? 'scheduled for cancellation' : 'canceled'}: ${id} by user ${user.id}`);

      return {
        success: true,
        data: { subscription: canceledSubscription },
        message: cancelDto.cancelAtPeriodEnd 
          ? 'Subscription will be canceled at the end of the billing period' 
          : 'Subscription canceled successfully',
      };
    } catch (error) {
      logger.error('Failed to cancel subscription', { error, userId: user.id, subscriptionId: id });
      
      // Handle Stripe errors
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestError(error.message);
      }
      
      throw new BadRequestError('Failed to cancel subscription. Please try again.');
    }
  }

  /**
   * Purchase AI credits
   */
  @Post('/credits/purchase')
  async purchaseCredits(
    @Body() purchaseDto: PurchaseCreditsDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<{ payment: any; clientSecret?: string }>> {
    // Validate DTO
    const errors = await validate(purchaseDto);
    if (errors.length > 0) {
      throw new BadRequestError('Validation failed', { errors });
    }

    try {
      // Get the credit package
      const creditPackage = this.getCreditPackage(purchaseDto.package, purchaseDto.customAmount);
      
      if (!creditPackage) {
        throw new BadRequestError('Invalid credit package');
      }

      // Create or retrieve Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await this.stripe.customers.create({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`.trim(),
          metadata: { userId: user.id },
        });
        
        // Save customer ID to user
        user.stripeCustomerId = customer.id;
        await this.userRepository.save(user);
        customerId = customer.id;
      }

      // Create a payment intent for the credit purchase
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: creditPackage.amount * 100, // Convert to cents
        currency: 'usd',
        customer: customerId,
        description: `Purchase of ${creditPackage.credits} AI credits`,
        metadata: {
          type: 'credit_purchase',
          credits: creditPackage.credits,
          package: purchaseDto.package,
        },
        payment_method: purchaseDto.paymentMethodId,
        confirm: false, // Just create, don't confirm yet
        setup_future_usage: 'off_session',
      });

      // Create a payment record
      const payment = new Payment();
      payment.amount = creditPackage.amount;
      payment.currency = 'usd';
      payment.status = 'pending';
      payment.paymentMethod = purchaseDto.paymentMethodId || 'card';
      payment.paymentType = 'credit_purchase';
      payment.description = `Purchase of ${creditPackage.credits} AI credits`;
      payment.user = user;
      payment.metadata = {
        credits: creditPackage.credits,
        package: purchaseDto.package,
        stripePaymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
      };

      await this.paymentRepository.save(payment);

      logger.info(`Credit purchase initiated: ${paymentIntent.id} for ${creditPackage.credits} credits by user ${user.id}`);

      return {
        success: true,
        data: {
          payment,
          clientSecret: paymentIntent.client_secret,
          credits: creditPackage.credits,
        },
        message: 'Credit purchase initiated',
      };
    } catch (error) {
      logger.error('Failed to process credit purchase', { error, userId: user.id });
      
      // Handle Stripe errors
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestError(error.message);
      }
      
      throw new BadRequestError('Failed to process credit purchase. Please try again.');
    }
  }

  /**
   * Apply a coupon code
   */
  @Post('/coupons/apply')
  async applyCoupon(
    @Body() applyCouponDto: ApplyCouponDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<{ coupon: any; valid: boolean }>> {
    // Validate DTO
    const errors = await validate(applyCouponDto);
    if (errors.length > 0) {
      throw new BadRequestError('Validation failed', { errors });
    }

    try {
      // Retrieve the coupon from Stripe
      const coupon = await this.stripe.coupons.retrieve(applyCouponDto.code);
      
      // Check if the coupon is valid
      const now = Math.floor(Date.now() / 1000);
      const valid = !coupon.valid && 
                   (!coupon.redeem_by || coupon.redeem_by > now) && 
                   (coupon.max_redemptions === null || coupon.times_redeemed < coupon.max_redemptions);

      return {
        success: true,
        data: {
          coupon,
          valid,
        },
        message: valid ? 'Coupon applied successfully' : 'Invalid or expired coupon',
      };
    } catch (error) {
      // If coupon not found or other error, return invalid
      return {
        success: true,
        data: {
          coupon: null,
          valid: false,
        },
        message: 'Invalid or expired coupon',
      };
    }
  }

  /**
   * Get payment history
   */
  @Get('/history')
  async getPaymentHistory(
    @QueryParams() query: PaymentListQueryDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<{ payments: any[]; total: number }>> {
    const {
      status = 'all',
      type = 'all',
      search = '',
      page = 1,
      limit = 10,
      sortBy = 'date',
      order = 'DESC',
    } = query;

    const skip = (page - 1) * limit;
    
    // Build where clause
    const where: any = { user: user.id };
    
    // Apply status filter
    if (status !== 'all') {
      where.status = status;
    }
    
    // Apply type filter
    if (type !== 'all') {
      where.paymentType = type;
    }
    
    // Apply search filter
    if (search) {
      where.description = Like(`%${search}%`);
    }

    // Build order clause
    const orderClause: any = {};
    orderClause[sortBy === 'date' ? 'createdAt' : sortBy] = order.toUpperCase();

    // Get payments with pagination
    const [payments, total] = await this.paymentRepository.findAndCount({
      where,
      order: orderClause,
      skip,
      take: limit,
    });

    return {
      success: true,
      data: {
        payments,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get invoices
   */
  @Get('/invoices')
  async getInvoices(
    @QueryParams() query: InvoiceListQueryDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<{ invoices: any[]; total: number }>> {
    if (!user.stripeCustomerId) {
      return {
        success: true,
        data: { invoices: [], total: 0 },
      };
    }

    const {
      status = 'all',
      subscriptionId,
      page = 1,
      limit = 10,
    } = query;

    try {
      // List invoices from Stripe
      const invoices = await this.stripe.invoices.list({
        customer: user.stripeCustomerId,
        subscription: subscriptionId,
        status: status === 'all' ? undefined : status as any,
        limit,
        starting_after: page > 1 ? `in_${(page - 1) * limit}` : undefined,
      });

      // Get total count for pagination
      const total = await this.stripe.invoices.list({
        customer: user.stripeCustomerId,
        subscription: subscriptionId,
        status: status === 'all' ? undefined : status as any,
        limit: 1,
      }).autoPagingToArray({ limit: 10000 }).then(arr => arr.length);

      return {
        success: true,
        data: {
          invoices: invoices.data,
          total,
          page,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to fetch invoices', { error, userId: user.id });
      
      // Handle Stripe errors
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestError(error.message);
      }
      
      throw new BadRequestError('Failed to fetch invoices. Please try again.');
    }
  }

  /**
   * Helper method to get price ID for a plan and interval
   */
  private getPriceIdForPlan(planId: string, interval: 'month' | 'year'): string | null {
    // This should be replaced with your actual price IDs from Stripe
    const priceIds: Record<string, { month: string; year: string }> = {
      basic: {
        month: 'price_basic_monthly',
        year: 'price_basic_yearly',
      },
      pro: {
        month: 'price_pro_monthly',
        year: 'price_pro_yearly',
      },
      enterprise: {
        month: 'price_enterprise_monthly',
        year: 'price_enterprise_yearly',
      },
    };

    return priceIds[planId]?.[interval] || null;
  }

  /**
   * Helper method to get credit package details
   */
  private getCreditPackage(packageId: string, customAmount?: number): { credits: number; amount: number } | null {
    // Define available credit packages
    const packages: Record<string, { credits: number; amount: number }> = {
      '100': { credits: 100, amount: 10 },
      '500': { credits: 500, amount: 40 },
      '1000': { credits: 1000, amount: 70 },
      '5000': { credits: 5000, amount: 300 },
      '10000': { credits: 10000, amount: 500 },
    };

    // Handle custom amount
    if (packageId === 'custom' && customAmount) {
      // Calculate credits based on the best value package
      const basePackage = packages['1000']; // Use 1000 credits as base for custom
      const credits = Math.round((customAmount / basePackage.amount) * basePackage.credits);
      
      return {
        credits,
        amount: customAmount,
      };
    }

    return packages[packageId] || null;
  }
}
