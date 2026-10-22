-- Starting catalogue for Makhdoom Fragrances (prices in PKR). Safe to re-run: it upserts by slug.
insert into products
  (slug, name, inspired_by, gender, price, compare_at_price, tagline, short_description, description, scent_family, accent, is_bundle, bundle_slugs, image, gallery, in_stock, featured, sort_order)
values
 ('cyrus','Cyrus','Office for Men','men',2650,3500,
  'Confidence, bottled.',
  'Fresh, refined and confidently masculine. Inspired by Office for Men.',
  'Cyrus is a sophisticated, modern perfume inspired by Office for Men. Fresh, refined and confidently masculine, it creates a polished scent that fits perfectly from the office to an evening out.',
  '{Fresh,Refined,Masculine}','#d9a441',false,'{}','/images/products/cyrus-card.webp','{/images/products/cyrus-ad.webp}',true,true,1),
 ('nova','Nova','Allure Homme Sport','men',2290,2860,
  'Make your presence unforgettable.',
  'A vibrant opening and a smooth, masculine finish. Inspired by Allure Homme Sport.',
  'Nova is a fresh, energetic perfume for men, inspired by Allure Homme Sport. With a vibrant opening and a smooth, masculine finish, it creates a confident scent that is perfect for everyday wear.',
  '{Fresh,Energetic,Everyday}','#e7a94f',false,'{}','/images/products/nova-card.webp','{/images/products/nova-ad-black.webp,/images/products/nova-ad-city.webp}',true,true,2),
 ('mira','Mira','Miss Dior','women',2560,3200,
  'Elegance in every drop.',
  'A romantic floral with a warm vanilla and sandalwood base. Inspired by Miss Dior.',
  'MIRA is a sophisticated floral perfume for women, inspired by Miss Dior. Featuring fresh notes of Lily-of-the-Valley, Iris, and Peony, followed by a romantic Centifolia Rose heart with subtle fruity hints, and finished with a warm Vanilla and Sandalwood base, it is crafted for those who embrace elegance with confidence.',
  '{Floral,Romantic,Elegant}','#b99cff',false,'{}','/images/products/mira-card.webp','{/images/products/mira-ad.webp,/images/products/mira-ad-box.webp}',true,true,3),
 ('zest','Zest','YSL Y','men',2450,3050,
  'Fresh energy. Bold presence.',
  'Clean, energetic and smooth on the finish. Inspired by YSL Y.',
  'Zest is a modern, fresh perfume for men, inspired by YSL Y. With a clean and energetic character followed by a smooth, masculine finish, it is made for those who want to stand out with confidence.',
  '{Fresh,Clean,Energetic}','#c5d84a',false,'{}','/images/products/zest-card.webp','{/images/products/zest-ad.webp,/images/products/zest-leaf.webp,/images/products/zest-marble.webp}',true,true,4),
 ('flova','Flova','Gucci Flora','women',2490,3140,
  'Elegant. Feminine. Unforgettable.',
  'A fresh floral with a soft, elegant finish. Inspired by Gucci Flora.',
  'Flova is a graceful, feminine perfume inspired by Gucci Flora. With a fresh floral character and a soft, elegant finish, it leaves behind a beautiful scent that feels effortlessly charming.',
  '{Floral,Soft,Elegant}','#e8b0b6',false,'{}','/images/products/flova-card.webp','{/images/products/flova-ad-her.webp,/images/products/flova-roses.webp,/images/products/flova-peony.webp}',true,true,5),
 ('couple-deal','Couple Deal',null,'couple',3990,5140,
  'His fragrance. Her fragrance. One perfect deal.',
  'Cyrus + Flova together. Save up to Rs. 1,150.',
  'The Cyrus + Flova Couple Deal brings together two distinctive fragrances, one for him and one for her. Cyrus is fresh, refined and confidently masculine, while Flova is soft, elegant and beautifully feminine, making them a perfect fragrance duo for couples. Save up to Rs. 1,150.',
  '{"For him","For her"}','#d9a441',true,'{cyrus,flova}','/images/products/couple-card.webp','{/images/products/couple-ad.webp}',true,false,6)
on conflict (slug) do update set
  name=excluded.name, inspired_by=excluded.inspired_by, gender=excluded.gender, price=excluded.price,
  compare_at_price=excluded.compare_at_price, tagline=excluded.tagline, short_description=excluded.short_description,
  description=excluded.description, scent_family=excluded.scent_family, accent=excluded.accent, is_bundle=excluded.is_bundle,
  bundle_slugs=excluded.bundle_slugs, image=excluded.image, gallery=excluded.gallery, featured=excluded.featured, sort_order=excluded.sort_order;
