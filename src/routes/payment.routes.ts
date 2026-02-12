/**
 * Payment Routes
 * 
 * Server-side payment processing for Paystack integration.
 * SECRET keys are ONLY used here on the backend - NEVER on frontend.
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';

const router = Router();

// Paystack API response types
interface PaystackResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url?: string;
    access_code?: string;
    reference?: string;
    amount?: number;
    currency?: string;
    channel?: string;
    paid_at?: string;
    customer?: {
      email?: string;
    };
    metadata?: Record<string, any>;
  };
}

// SECURITY: Secret key from environment only
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET;

/**
 * POST /api/payments/initialize
 * Initialize a transaction server-side
 */
router.post('/initialize', async (req: Request, res: Response) => {
  if (!PAYSTACK_SECRET_KEY) {
    return res.status(503).json({
      status: false,
      message: 'Payment service not configured. Contact administrator.',
    });
  }

  try {
    const { email, amount, reference, metadata, channels } = req.body;

    if (!email || !amount || !reference) {
      return res.status(400).json({
        status: false,
        message: 'Missing required fields: email, amount, reference',
      });
    }

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount, // Amount in kobo
        reference,
        currency: 'NGN',
        channels: channels || ['card', 'bank', 'ussd', 'bank_transfer'],
        metadata,
      }),
    });

    const data: PaystackResponse = await response.json();

    if (!response.ok) {
      console.error('[Payment] Paystack initialization failed:', data);
      return res.status(response.status).json({
        status: false,
        message: data.message || 'Payment initialization failed',
      });
    }

    return res.json({
      status: true,
      message: 'Transaction initialized',
      data: {
        authorization_url: data.data?.authorization_url,
        access_code: data.data?.access_code,
        reference: data.data?.reference,
      },
    });
  } catch (error: any) {
    console.error('[Payment] Initialize error:', error);
    return res.status(500).json({
      status: false,
      message: 'Payment service error',
    });
  }
});

/**
 * POST /api/payments/verify
 * Verify a transaction server-side
 */
router.post('/verify', async (req: Request, res: Response) => {
  if (!PAYSTACK_SECRET_KEY) {
    return res.status(503).json({
      status: false,
      message: 'Payment service not configured',
    });
  }

  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({
        status: false,
        message: 'Reference is required',
      });
    }

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data: PaystackResponse = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        status: false,
        message: data.message || 'Verification failed',
      });
    }

    // Return sanitized verification result
    return res.json({
      status: data.status,
      message: data.message,
      data: data.data ? {
        reference: data.data.reference,
        amount: data.data.amount,
        currency: data.data.currency,
        channel: data.data.channel,
        status: data.data.status,
        paid_at: data.data.paid_at,
        customer: {
          email: data.data.customer?.email,
        },
        metadata: data.data.metadata,
      } : null,
    });
  } catch (error: any) {
    console.error('[Payment] Verify error:', error);
    return res.status(500).json({
      status: false,
      message: 'Verification service error',
    });
  }
});

/**
 * POST /api/payments/webhook
 * Handle Paystack webhook events
 */
router.post('/webhook', async (req: Request, res: Response) => {
  // Verify webhook signature
  const signature = req.headers['x-paystack-signature'] as string;
  
  if (PAYSTACK_WEBHOOK_SECRET && signature) {
    const hash = crypto
      .createHmac('sha512', PAYSTACK_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');
    
    if (hash !== signature) {
      console.error('[Payment] Invalid webhook signature');
      return res.status(401).json({ message: 'Invalid signature' });
    }
  }

  const event = req.body;
  console.log('[Payment] Webhook event:', event.event);

  try {
    switch (event.event) {
      case 'charge.success':
        // Handle successful payment
        console.log('[Payment] Charge successful:', event.data.reference);
        // TODO: Update payment record in database
        // TODO: Notify relevant services
        break;

      case 'charge.failed':
        console.log('[Payment] Charge failed:', event.data.reference);
        break;

      case 'transfer.success':
        console.log('[Payment] Transfer successful:', event.data.reference);
        break;

      case 'transfer.failed':
        console.log('[Payment] Transfer failed:', event.data.reference);
        break;

      default:
        console.log('[Payment] Unhandled event:', event.event);
    }

    // Always return 200 to acknowledge receipt
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Payment] Webhook processing error:', error);
    return res.status(200).json({ received: true }); // Still return 200
  }
});

/**
 * GET /api/payments/banks
 * Get list of supported banks
 */
router.get('/banks', async (_req: Request, res: Response) => {
  if (!PAYSTACK_SECRET_KEY) {
    // Return common Nigerian banks as fallback
    return res.json({
      status: true,
      data: [
        { name: 'Access Bank', code: '044', type: 'nuban' },
        { name: 'First Bank', code: '011', type: 'nuban' },
        { name: 'GTBank', code: '058', type: 'nuban' },
        { name: 'UBA', code: '033', type: 'nuban' },
        { name: 'Zenith Bank', code: '057', type: 'nuban' },
        { name: 'Fidelity Bank', code: '070', type: 'nuban' },
        { name: 'Union Bank', code: '032', type: 'nuban' },
        { name: 'Sterling Bank', code: '232', type: 'nuban' },
        { name: 'Wema Bank', code: '035', type: 'nuban' },
        { name: 'Stanbic IBTC', code: '221', type: 'nuban' },
      ],
    });
  }

  try {
    const response = await fetch('https://api.paystack.co/bank', {
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });

    const data: { data?: any[] } = await response.json();
    return res.json({
      status: true,
      data: data.data || [],
    });
  } catch (error) {
    console.error('[Payment] Failed to fetch banks:', error);
    return res.status(500).json({
      status: false,
      message: 'Failed to fetch banks',
    });
  }
});

export default router;
