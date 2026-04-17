const Razorpay = require('razorpay');

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    // Ensure you add these to Vercel Environment Variables
    const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const { amount } = req.body;

    try {
        const options = {
            amount: amount * 100, // Amount in paise
            currency: 'INR',
            receipt: 'receipt_' + Math.random().toString(36).substring(7)
        };
        const order = await razorpay.orders.create(options);
        res.status(200).json(order);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create order' });
    }
}
