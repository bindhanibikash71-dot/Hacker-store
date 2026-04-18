// ============================================================
// NeonHub X — /api/create-order.js
// Vercel Serverless Function — Razorpay Order Creation
// ============================================================
// ENV Variables required in Vercel dashboard:
//   RAZORPAY_KEY_ID     = rzp_live_xxxx
//   RAZORPAY_KEY_SECRET = your_secret
// ============================================================

const Razorpay = require('razorpay');

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount, currency = 'INR', receipt = 'order_receipt' } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    const razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const order = await razorpay.orders.create({
      amount:   Math.round(amount), // in paise
      currency,
      receipt:  receipt.slice(0, 40),
      payment_capture: 1
    });

    return res.status(200).json({
      id:       order.id,
      amount:   order.amount,
      currency: order.currency
    });
  } catch (error) {
    console.error('Razorpay create-order error:', error);
    return res.status(500).json({ error: 'Failed to create order', details: error.message });
  }
};
