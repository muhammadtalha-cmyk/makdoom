// Default policy copy. Review with the brand owner and adjust the numbers (days, fees) to match real operations.
export interface Policy { slug: string; title: string; updated: string; sections: { h: string; p: string[] }[] }

export const POLICIES: Policy[] = [
  {
    slug: 'shipping-and-cod',
    title: 'Shipping & cash on delivery',
    updated: 'October 2026',
    sections: [
      { h: 'Where we deliver', p: ['We deliver to cities and towns across Pakistan through our courier partners.'] },
      { h: 'Delivery time', p: ['Most orders arrive within 3 to 5 working days. Remote areas can take longer. We will update you on WhatsApp if there is a delay.'] },
      { h: 'Delivery charges', p: ['A flat delivery charge applies to small orders and is shown in your bag and at checkout before you order. Orders above the free-delivery amount ship free.'] },
      { h: 'Cash on delivery', p: ['We accept cash on delivery only. Please keep the exact amount ready for the rider. There are no online or card payments.', 'After you place an order we confirm it with you on WhatsApp. Orders we cannot confirm may be cancelled.'] },
    ],
  },
  {
    slug: 'returns',
    title: 'Returns & exchange',
    updated: 'October 2026',
    sections: [
      { h: 'Damaged or wrong item', p: ['If your parcel arrives damaged or you receive the wrong fragrance, message us on WhatsApp within 48 hours of delivery with photos and your order number. We will arrange a replacement.'] },
      { h: 'Opened or used perfume', p: ['For hygiene reasons we cannot accept returns of perfumes that have been opened or used, unless they arrived damaged or incorrect.'] },
      { h: 'How to reach us', p: ['Use the WhatsApp button on any page or the contact form, and include your order number.'] },
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy policy',
    updated: 'October 2026',
    sections: [
      { h: 'What we collect', p: ['When you order we collect your name, mobile number, city, delivery address, optional email and any notes you add. If you subscribe or contact us we keep your email and message.'] },
      { h: 'How we use it', p: ['We use your details only to confirm, pack and deliver your order, to answer your messages, and, if you subscribed, to send news about our fragrances. We do not sell your data.'] },
      { h: 'Who sees it', p: ['Your details are stored with our database provider and shared with the courier only as needed to deliver your parcel. Order notifications are emailed to our team.'] },
      { h: 'Your choices', p: ['You can ask us to correct or delete your details, or unsubscribe at any time, by emailing us.'] },
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of service',
    updated: 'October 2026',
    sections: [
      { h: 'Orders', p: ['An order is confirmed when our team verifies it with you, usually on WhatsApp. We may cancel orders with incorrect details or those we cannot confirm.'] },
      { h: 'Prices', p: ['Prices are in Pakistani rupees and may change without notice. The price shown when you place your order applies.'] },
      { h: 'Products', p: ['Our Eau de Parfums are inspired by popular designer fragrances. Makhdoom Fragrances is not affiliated with, or endorsed by, those brands. Scent longevity varies from person to person.'] },
    ],
  },
];
