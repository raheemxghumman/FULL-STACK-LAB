/* ==========================================================================
   Kashi Ghar — product catalogue, seeded reviews and SVG artwork
   Author: Abdulraheem · Full Stack Web Development Lab 3
   --------------------------------------------------------------------------
   This file only holds DATA. All behaviour (cart, auth, reviews, orders)
   lives in app.js. Product pictures are hand-drawn inline SVG <symbol>s so
   the store works without any external image files.
   ========================================================================== */

/* Categories used by the filter buttons (key -> label). */
window.KG_CATEGORIES = {
  vases: 'Vases',
  tableware: 'Tableware',
  tiles: 'Tiles',
  lamps: 'Lamps',
  textiles: 'Textiles & Shoes'
};

/* Product catalogue. `rating` and `reviewCount` are the stored aggregate;
   reviews written by customers in the browser are added on top of them. */
window.KG_PRODUCTS = [
  { id: 'p1',  name: 'Blue Kashi Surahi Vase',       category: 'vases',     price: 4800, oldPrice: 5500, rating: 4.8, reviewCount: 124, stock: 12, art: 'a-surahi', bg: '#e6ecf7',
    description: 'A long-necked surahi thrown on the wheel and painted by hand with the cobalt flowers Multan’s potters are known for. Glazed inside and out, 34 cm tall.' },
  { id: 'p2',  name: 'Nila Matka Vase',              category: 'vases',     price: 3200,                 rating: 4.6, reviewCount: 86,  stock: 9,  art: 'a-matka',  bg: '#e2f1ef',
    description: 'A round, low matka in turquoise glaze with a band of white kashi flowers. Looks best with dried pampas or on its own on a console table.' },
  { id: 'p3',  name: 'Tall Floral Bottle Vase',      category: 'vases',     price: 6500,                 rating: 4.7, reviewCount: 41,  stock: 5,  art: 'a-bottle', bg: '#e9e7f4',
    description: 'Deep cobalt bottle vase with a white vine climbing from foot to neck. Each piece is signed underneath by the artisan. 42 cm tall.' },
  { id: 'p4',  name: 'Hand-painted Wall Plate',      category: 'tableware', price: 1850,                 rating: 4.5, reviewCount: 158, stock: 25, art: 'a-plate',  bg: '#f3ece0',
    description: 'A 30 cm plate with a central kashi medallion and a ring of turquoise buds. Comes with a wall hook, and is food-safe if you would rather use it.' },
  { id: 'p5',  name: 'Kashi Serving Bowl',           category: 'tableware', price: 2400, oldPrice: 2900, rating: 4.7, reviewCount: 97,  stock: 14, art: 'a-bowl',   bg: '#e6ecf7',
    description: 'Wide serving bowl for salan, fruit or rice. Hand-painted outside, pale turquoise glaze inside. Dishwasher safe on a gentle cycle.' },
  { id: 'p6',  name: 'Chai Mugs · Set of 2',         category: 'tableware', price: 1600,                 rating: 4.4, reviewCount: 203, stock: 30, art: 'a-mugs',   bg: '#f5e9df',
    description: 'One white mug with a cobalt flower and one turquoise mug with a white one. 280 ml each, made for doodh patti on winter evenings.' },
  { id: 'p7',  name: 'Multani Tile Panel · 6 pcs',   category: 'tiles',     price: 7200,                 rating: 4.9, reviewCount: 32,  stock: 4,  art: 'a-tiles',  bg: '#e2f1ef',
    description: 'Six 15 cm hand-painted tiles that form one panel, the same star-and-flower pattern you see on the shrines of Multan. For kitchen backsplashes or framing.' },
  { id: 'p8',  name: 'Hexagon Coasters · Set of 4',  category: 'tiles',     price: 1400,                 rating: 4.5, reviewCount: 75,  stock: 22, art: 'a-hex',    bg: '#e6ecf7',
    description: 'Four hexagonal ceramic coasters with cork backing: two cobalt, one turquoise and one white. A small gift that travels well.' },
  { id: 'p9',  name: 'Camel-skin Naqashi Lamp',      category: 'lamps',     price: 8900, oldPrice: 9800, rating: 4.8, reviewCount: 64,  stock: 6,  art: 'a-camel',  bg: '#f6e7d6',
    description: 'Traditional Multani lamp made from stretched camel skin and painted in naqashi work. Gives a warm amber glow. Bulb and fitting included.' },
  { id: 'p10', name: 'Kashi Table Lamp',             category: 'lamps',     price: 5600,                 rating: 4.6, reviewCount: 38,  stock: 8,  art: 'a-lamp',   bg: '#f3ece0',
    description: 'A glazed kashi base with a cream linen shade. Height 48 cm, E27 fitting, 2 m braided cable.' },
  { id: 'p11', name: 'Hand-stitched Multani Khussa', category: 'textiles',  price: 3500,                 rating: 4.5, reviewCount: 146, stock: 18, art: 'a-khussa', bg: '#e9e7f4',
    description: 'Pure leather khussa with golden tilla embroidery on cobalt velvet. Soft padded insole, sizes 36 to 44 (add your size in the checkout notes).' },
  { id: 'p12', name: 'Block-printed Ajrak Shawl',    category: 'textiles',  price: 2800,                 rating: 4.7, reviewCount: 118, stock: 20, art: 'a-ajrak',  bg: '#f6e3df',
    description: 'Cotton ajrak printed by hand with wooden blocks in crimson and indigo. 2.5 m long, softens with every wash.' }
];

/* Overall star distribution behind the catalogue aggregates
   (sums to the total reviewCount above: 1,182). */
window.KG_RATING_BASE = { 5: 842, 4: 251, 3: 58, 2: 19, 1: 12 };

/* Seeded customer reviews shown in the "What customers say" section. */
window.KG_SEED_REVIEWS = [
  { id: 's1', productId: 'p1',  name: 'Ayesha Siddiqui', city: 'Lahore',     rating: 5, date: '2026-09-18', verified: true,
    text: 'The surahi is even prettier in person. The blue is deep and the glaze has that slightly uneven handmade look. Packed very carefully in straw and bubble wrap.' },
  { id: 's2', productId: 'p9',  name: 'Hamza Qureshi',   city: 'Karachi',    rating: 5, date: '2026-09-12', verified: true,
    text: 'Ordered the camel-skin lamp for my study. The warm light through the painted skin is beautiful at night. Delivered in four days.' },
  { id: 's3', productId: 'p4',  name: 'Mahnoor Tariq',   city: 'Islamabad',  rating: 4, date: '2026-09-05', verified: true,
    text: 'Lovely plate for the wall. One tiny chip on the rim, but they sent a replacement without any hassle.' },
  { id: 's4', productId: 'p11', name: 'Bilal Ahmed',     city: 'Multan',     rating: 5, date: '2026-08-29', verified: true,
    text: 'Proper Multani khussa, soft leather inside and the embroidery is neat. The size chart was accurate.' },
  { id: 's5', productId: 'p6',  name: 'Zainab Raza',     city: 'Rawalpindi', rating: 4, date: '2026-08-21', verified: true,
    text: 'Chai tastes better in these mugs, no joke. Slightly smaller than I expected, but still my favourite.' },
  { id: 's6', productId: 'p7',  name: 'Usman Farooq',    city: 'Faisalabad', rating: 5, date: '2026-08-14', verified: true,
    text: 'Used the tile panel above our kitchen counter. Everyone who visits asks where it is from.' },
  { id: 's7', productId: 'p12', name: 'Hira Malik',      city: 'Hyderabad',  rating: 5, date: '2026-07-30', verified: true,
    text: 'Genuine ajrak print and the colours did not bleed in the first wash. Gifted one to my mother as well.' },
  { id: 's8', productId: 'p5',  name: 'Saad Hussain',    city: 'Peshawar',   rating: 4, date: '2026-07-19', verified: true,
    text: 'The serving bowl is sturdy and you can see the brush strokes in the pattern. Delivery took about a week.' },
  { id: 's9', productId: 'p2',  name: 'Fatima Noor',     city: 'Sialkot',    rating: 5, date: '2026-07-08', verified: true,
    text: 'The turquoise matka is the centrepiece of our lounge now. Five stars from the whole family.' }
];

/* --------------------------------------------------------------------------
   SVG sprite. Injected once into every page by app.js; products reference
   their picture with <use href="#a-...">. The motifs (#m-flower, #m-leaf,
   #m-star) are reused so every piece shares the same kashi vocabulary.
   The `color` attribute on a <use> sets the motif colour via currentColor.
   -------------------------------------------------------------------------- */
window.KG_SPRITE = `
<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="g-glow"><stop offset="0" stop-color="#ffb347" stop-opacity=".6"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
    <linearGradient id="g-camel" x1="0" x2="1"><stop offset="0" stop-color="#c2641f"/><stop offset=".5" stop-color="#f4a95c"/><stop offset="1" stop-color="#c2641f"/></linearGradient>
    <linearGradient id="g-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf4e6"/><stop offset="1" stop-color="#efdfc0"/></linearGradient>
    <pattern id="p-ajrak" width="26" height="26" patternUnits="userSpaceOnUse">
      <rect width="26" height="26" fill="#8e1f28"/>
      <circle cx="13" cy="13" r="8" fill="#1b2f5c"/>
      <use href="#m-star" x="7" y="7" width="12" height="12" color="#f4ead7"/>
      <circle cx="0" cy="0" r="3" fill="#111"/><circle cx="26" cy="0" r="3" fill="#111"/><circle cx="0" cy="26" r="3" fill="#111"/><circle cx="26" cy="26" r="3" fill="#111"/>
    </pattern>
  </defs>

  <!-- ===== Motifs ===== -->
  <symbol id="m-flower" viewBox="-10 -10 20 20">
    <g fill="currentColor">
      <ellipse cy="-5" rx="2.6" ry="4.4"/><ellipse cy="-5" rx="2.6" ry="4.4" transform="rotate(60)"/>
      <ellipse cy="-5" rx="2.6" ry="4.4" transform="rotate(120)"/><ellipse cy="-5" rx="2.6" ry="4.4" transform="rotate(180)"/>
      <ellipse cy="-5" rx="2.6" ry="4.4" transform="rotate(240)"/><ellipse cy="-5" rx="2.6" ry="4.4" transform="rotate(300)"/>
    </g>
    <circle r="2.3" fill="#f2c14e"/>
  </symbol>
  <symbol id="m-leaf" viewBox="-6 -10 12 20">
    <path d="M0-9C5-5 5 5 0 9C-5 5-5-5 0-9Z" fill="currentColor"/>
  </symbol>
  <symbol id="m-star" viewBox="-10 -10 20 20">
    <rect x="-6.5" y="-6.5" width="13" height="13" fill="currentColor"/>
    <rect x="-6.5" y="-6.5" width="13" height="13" fill="currentColor" transform="rotate(45)"/>
  </symbol>

  <!-- ===== Logo ===== -->
  <symbol id="logo" viewBox="0 0 40 40">
    <rect x="1" y="1" width="38" height="38" rx="10" fill="#1f4e9c"/>
    <rect x="5" y="5" width="30" height="30" rx="7" fill="none" stroke="#5fc4c0" stroke-width="1.5"/>
    <use href="#m-flower" x="8" y="8" width="24" height="24" color="#ffffff"/>
  </symbol>

  <!-- ===== 1. Surahi vase ===== -->
  <symbol id="a-surahi" viewBox="0 0 200 200">
    <ellipse cx="100" cy="184" rx="48" ry="6" fill="#0b1b3a" opacity=".1"/>
    <path d="M84 20h32v6h-5v40c22 6 41 26 41 54 0 28-20 46-48 50v6h10v4H86v-4h10v-6c-28-4-48-22-48-50 0-28 19-48 41-54V26h-5z" fill="#fbfaf6" stroke="#1f4e9c" stroke-width="3" stroke-linejoin="round"/>
    <rect x="84" y="20" width="32" height="6" fill="#1f4e9c"/>
    <rect x="89" y="40" width="22" height="6" fill="#2a9d9b"/>
    <path d="M56 104c28 10 60 10 88 0" fill="none" stroke="#2a9d9b" stroke-width="3"/>
    <path d="M52 140c30 12 66 12 96 0" fill="none" stroke="#1f4e9c" stroke-width="2"/>
    <use href="#m-flower" x="83" y="105" width="34" height="34" color="#1f4e9c"/>
    <use href="#m-flower" x="60" y="112" width="18" height="18" color="#2a9d9b"/>
    <use href="#m-flower" x="122" y="112" width="18" height="18" color="#2a9d9b"/>
    <use href="#m-leaf" x="92" y="80" width="8" height="16" color="#1f4e9c"/>
    <use href="#m-leaf" x="101" y="80" width="8" height="16" color="#1f4e9c"/>
    <use href="#m-flower" x="92" y="146" width="16" height="16" color="#1f4e9c"/>
  </symbol>

  <!-- ===== 2. Matka vase ===== -->
  <symbol id="a-matka" viewBox="0 0 200 200">
    <ellipse cx="100" cy="184" rx="66" ry="6" fill="#0b1b3a" opacity=".1"/>
    <path d="M70 58H130V68C158 78 174 102 174 128C174 158 142 176 100 176C58 176 26 158 26 128C26 102 42 78 70 68Z" fill="#2a9d9b" stroke="#17606a" stroke-width="3" stroke-linejoin="round"/>
    <rect x="64" y="50" width="72" height="11" rx="4" fill="#1f4e9c"/>
    <path d="M34 104Q100 90 166 104" fill="none" stroke="#fff" stroke-width="3"/>
    <path d="M34 152Q100 168 166 152" fill="none" stroke="#fff" stroke-width="3"/>
    <use href="#m-flower" x="84" y="110" width="32" height="32" color="#ffffff"/>
    <use href="#m-flower" x="44" y="114" width="24" height="24" color="#ffffff"/>
    <use href="#m-flower" x="132" y="114" width="24" height="24" color="#ffffff"/>
    <use href="#m-leaf" x="70" y="118" width="8" height="16" color="#1f4e9c"/>
    <use href="#m-leaf" x="122" y="118" width="8" height="16" color="#1f4e9c"/>
  </symbol>

  <!-- ===== 3. Bottle vase ===== -->
  <symbol id="a-bottle" viewBox="0 0 200 200">
    <ellipse cx="100" cy="188" rx="40" ry="5" fill="#0b1b3a" opacity=".1"/>
    <path d="M90 14H110V22C110 34 104 40 104 52C128 62 138 90 138 124C138 156 124 176 100 180C76 176 62 156 62 124C62 90 72 62 96 52C96 40 90 34 90 22Z" fill="#1f4e9c" stroke="#15356b" stroke-width="3" stroke-linejoin="round"/>
    <rect x="84" y="178" width="32" height="7" rx="2" fill="#15356b"/>
    <path d="M100 60C84 80 116 100 100 120C84 140 116 160 100 176" fill="none" stroke="#fff" stroke-width="2.5"/>
    <use href="#m-flower" x="89" y="79" width="22" height="22" color="#ffffff"/>
    <use href="#m-flower" x="87" y="118" width="26" height="26" color="#5fc4c0"/>
    <use href="#m-flower" x="91" y="152" width="18" height="18" color="#ffffff"/>
    <use href="#m-leaf" x="80" y="62" width="8" height="16" color="#5fc4c0"/>
    <use href="#m-leaf" x="112" y="100" width="8" height="16" color="#5fc4c0"/>
    <use href="#m-leaf" x="80" y="142" width="8" height="16" color="#5fc4c0"/>
    <rect x="90" y="14" width="20" height="5" fill="#5fc4c0"/>
  </symbol>

  <!-- ===== 4. Wall plate ===== -->
  <symbol id="a-plate" viewBox="0 0 200 200">
    <circle cx="104" cy="106" r="82" fill="#0b1b3a" opacity=".08"/>
    <circle cx="100" cy="100" r="82" fill="#fbfaf6" stroke="#15356b" stroke-width="3"/>
    <circle cx="100" cy="100" r="72" fill="none" stroke="#1f4e9c" stroke-width="7"/>
    <circle cx="100" cy="100" r="63" fill="none" stroke="#2a9d9b" stroke-width="2"/>
    <circle cx="100" cy="100" r="30" fill="#e6ecf7"/>
    <use href="#m-flower" x="72" y="72" width="56" height="56" color="#1f4e9c"/>
    <use href="#m-flower" x="138" y="93" width="14" height="14" color="#2a9d9b"/>
    <use href="#m-flower" x="124.8" y="124.8" width="14" height="14" color="#1f4e9c"/>
    <use href="#m-flower" x="93" y="138" width="14" height="14" color="#2a9d9b"/>
    <use href="#m-flower" x="61.2" y="124.8" width="14" height="14" color="#1f4e9c"/>
    <use href="#m-flower" x="48" y="93" width="14" height="14" color="#2a9d9b"/>
    <use href="#m-flower" x="61.2" y="61.2" width="14" height="14" color="#1f4e9c"/>
    <use href="#m-flower" x="93" y="48" width="14" height="14" color="#2a9d9b"/>
    <use href="#m-flower" x="124.8" y="61.2" width="14" height="14" color="#1f4e9c"/>
  </symbol>

  <!-- ===== 5. Serving bowl ===== -->
  <symbol id="a-bowl" viewBox="0 0 200 200">
    <ellipse cx="100" cy="176" rx="60" ry="6" fill="#0b1b3a" opacity=".1"/>
    <path d="M78 156L82 170H118L122 156Z" fill="#1f4e9c"/>
    <path d="M26 78C30 134 62 160 100 160C138 160 170 134 174 78Z" fill="#fbfaf6" stroke="#1f4e9c" stroke-width="3" stroke-linejoin="round"/>
    <path d="M34 96C70 108 130 108 166 96" fill="none" stroke="#2a9d9b" stroke-width="3"/>
    <use href="#m-flower" x="49" y="104" width="22" height="22" color="#1f4e9c"/>
    <use href="#m-flower" x="86" y="110" width="28" height="28" color="#1f4e9c"/>
    <use href="#m-flower" x="129" y="104" width="22" height="22" color="#1f4e9c"/>
    <ellipse cx="100" cy="78" rx="74" ry="20" fill="#c4e8e4" stroke="#1f4e9c" stroke-width="3"/>
    <use href="#m-flower" x="90" y="68" width="20" height="20" color="#2a9d9b"/>
  </symbol>

  <!-- ===== 6. Chai mugs ===== -->
  <symbol id="a-mugs" viewBox="0 0 200 200">
    <ellipse cx="104" cy="164" rx="76" ry="6" fill="#0b1b3a" opacity=".1"/>
    <path d="M64 58C58 48 70 42 64 32M80 58C74 48 86 42 80 32" fill="none" stroke="#9aa9c4" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M104 88C126 88 126 132 104 132" fill="none" stroke="#1f4e9c" stroke-width="7"/>
    <rect x="40" y="70" width="64" height="88" rx="8" fill="#fbfaf6" stroke="#1f4e9c" stroke-width="3"/>
    <rect x="40" y="78" width="64" height="8" fill="#1f4e9c"/>
    <use href="#m-flower" x="57" y="104" width="30" height="30" color="#1f4e9c"/>
    <path d="M166 100C186 100 186 140 166 140" fill="none" stroke="#17606a" stroke-width="7"/>
    <rect x="108" y="84" width="58" height="74" rx="8" fill="#2a9d9b" stroke="#17606a" stroke-width="3"/>
    <use href="#m-flower" x="124" y="108" width="26" height="26" color="#ffffff"/>
    <rect x="108" y="92" width="58" height="5" fill="#fff" opacity=".7"/>
  </symbol>

  <!-- ===== 7. Tile panel ===== -->
  <symbol id="a-tiles" viewBox="0 0 200 200">
    <rect x="28" y="56" width="152" height="104" fill="#0b1b3a" opacity=".08"/>
    <g stroke="#1f4e9c" stroke-width="2">
      <rect x="24" y="48" width="50" height="52" fill="#fbfaf6"/><rect x="74" y="48" width="52" height="52" fill="#e6ecf7"/><rect x="126" y="48" width="50" height="52" fill="#fbfaf6"/>
      <rect x="24" y="100" width="50" height="52" fill="#e6ecf7"/><rect x="74" y="100" width="52" height="52" fill="#fbfaf6"/><rect x="126" y="100" width="50" height="52" fill="#e6ecf7"/>
    </g>
    <use href="#m-star" x="32" y="57" width="34" height="34" color="#1f4e9c"/><use href="#m-flower" x="40" y="65" width="18" height="18" color="#ffffff"/>
    <use href="#m-star" x="83" y="57" width="34" height="34" color="#2a9d9b"/><use href="#m-flower" x="91" y="65" width="18" height="18" color="#ffffff"/>
    <use href="#m-star" x="134" y="57" width="34" height="34" color="#1f4e9c"/><use href="#m-flower" x="142" y="65" width="18" height="18" color="#ffffff"/>
    <use href="#m-star" x="32" y="109" width="34" height="34" color="#2a9d9b"/><use href="#m-flower" x="40" y="117" width="18" height="18" color="#ffffff"/>
    <use href="#m-star" x="83" y="109" width="34" height="34" color="#1f4e9c"/><use href="#m-flower" x="91" y="117" width="18" height="18" color="#ffffff"/>
    <use href="#m-star" x="134" y="109" width="34" height="34" color="#2a9d9b"/><use href="#m-flower" x="142" y="117" width="18" height="18" color="#ffffff"/>
    <rect x="24" y="48" width="152" height="104" fill="none" stroke="#15356b" stroke-width="4" rx="2"/>
  </symbol>

  <!-- ===== 8. Hexagon coasters ===== -->
  <symbol id="a-hex" viewBox="0 0 200 200">
    <ellipse cx="102" cy="168" rx="72" ry="6" fill="#0b1b3a" opacity=".1"/>
    <path d="M60 50L86 65V95L60 110L34 95V65Z" fill="#fbfaf6" stroke="#1f4e9c" stroke-width="2.5"/>
    <use href="#m-flower" x="45" y="65" width="30" height="30" color="#1f4e9c"/>
    <path d="M116 50L142 65V95L116 110L90 95V65Z" fill="#1f4e9c" stroke="#15356b" stroke-width="2.5"/>
    <use href="#m-flower" x="101" y="65" width="30" height="30" color="#ffffff"/>
    <path d="M88 98L114 113V143L88 158L62 143V113Z" fill="#2a9d9b" stroke="#17606a" stroke-width="2.5"/>
    <use href="#m-flower" x="73" y="113" width="30" height="30" color="#ffffff"/>
    <path d="M144 98L170 113V143L144 158L118 143V113Z" fill="#fbfaf6" stroke="#2a9d9b" stroke-width="2.5"/>
    <use href="#m-flower" x="129" y="113" width="30" height="30" color="#2a9d9b"/>
  </symbol>

  <!-- ===== 9. Camel-skin lamp ===== -->
  <symbol id="a-camel" viewBox="0 0 200 200">
    <circle cx="100" cy="104" r="86" fill="url(#g-glow)"/>
    <path d="M100 30C110 50 146 70 146 112C146 146 126 164 100 164C74 164 54 146 54 112C54 70 90 50 100 30Z" fill="url(#g-camel)" stroke="#7a3b12" stroke-width="2.5"/>
    <path d="M72 84Q100 104 128 84M62 118Q100 142 138 118M68 146Q100 160 132 146" fill="none" stroke="#6b2f0d" stroke-width="2.5"/>
    <g fill="#3f6b3a"><path d="M100 96l6 8-6 8-6-8z"/><path d="M78 126l5 7-5 7-5-7z"/><path d="M122 126l5 7-5 7-5-7z"/></g>
    <use href="#m-leaf" x="95" y="56" width="10" height="20" color="#6b2f0d"/>
    <circle cx="100" cy="27" r="5" fill="#caa047"/>
    <path d="M80 164H120L130 178H70Z" fill="#6b2f0d"/>
    <rect x="64" y="178" width="72" height="6" rx="3" fill="#4a2008"/>
  </symbol>

  <!-- ===== 10. Kashi table lamp ===== -->
  <symbol id="a-lamp" viewBox="0 0 200 200">
    <ellipse cx="100" cy="100" rx="70" ry="16" fill="#ffe6a8" opacity=".5"/>
    <path d="M62 34H138L158 92H42Z" fill="url(#g-shade)" stroke="#c9b58f" stroke-width="2"/>
    <path d="M42 92H158" stroke="#b39a6b" stroke-width="3"/>
    <rect x="96" y="92" width="8" height="12" fill="#caa047"/>
    <path d="M86 104H114V110C136 120 142 138 138 152C134 168 120 176 100 176C80 176 66 168 62 152C58 138 64 120 86 110Z" fill="#fbfaf6" stroke="#1f4e9c" stroke-width="3" stroke-linejoin="round"/>
    <rect x="86" y="106" width="28" height="5" fill="#2a9d9b"/>
    <use href="#m-flower" x="84" y="128" width="32" height="32" color="#1f4e9c"/>
    <use href="#m-leaf" x="70" y="136" width="8" height="16" color="#2a9d9b"/>
    <use href="#m-leaf" x="122" y="136" width="8" height="16" color="#2a9d9b"/>
    <ellipse cx="100" cy="179" rx="44" ry="6" fill="#15356b"/>
  </symbol>

  <!-- ===== 11. Khussa ===== -->
  <symbol id="a-khussa" viewBox="0 0 200 200">
    <ellipse cx="104" cy="160" rx="82" ry="6" fill="#0b1b3a" opacity=".12"/>
    <path d="M26 138H178C178 146 170 152 152 152H42C32 152 26 148 26 138Z" fill="#8a5a2b"/>
    <path d="M30 140C28 114 44 96 70 94C86 93 94 108 112 110C140 112 160 104 174 92C180 88 186 92 182 98C174 114 172 128 174 140Z" fill="#1f4e9c" stroke="#15356b" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M174 92C182 78 196 80 190 90" fill="none" stroke="#d9a441" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="62" cy="98" rx="24" ry="6" fill="#0d224a"/>
    <path d="M40 124C70 116 110 122 170 112" fill="none" stroke="#d9a441" stroke-width="2" stroke-dasharray="1 5" stroke-linecap="round"/>
    <use href="#m-flower" x="116" y="112" width="24" height="24" color="#d9a441"/>
    <use href="#m-flower" x="84" y="116" width="16" height="16" color="#d9a441"/>
    <use href="#m-leaf" x="144" y="110" width="7" height="14" color="#d9a441"/>
    <use href="#m-leaf" x="104" y="116" width="7" height="14" color="#d9a441"/>
  </symbol>

  <!-- ===== 12. Ajrak shawl ===== -->
  <symbol id="a-ajrak" viewBox="0 0 200 200">
    <ellipse cx="102" cy="170" rx="78" ry="6" fill="#0b1b3a" opacity=".12"/>
    <rect x="44" y="46" width="132" height="104" rx="3" fill="#1b2f5c" transform="rotate(-5 110 98)"/>
    <rect x="26" y="60" width="140" height="104" rx="3" fill="url(#p-ajrak)" stroke="#1b2f5c" stroke-width="3"/>
    <rect x="26" y="60" width="140" height="12" fill="#1b2f5c"/>
    <rect x="26" y="152" width="140" height="12" fill="#1b2f5c"/>
    <path d="M30 66H162M30 158H162" stroke="#f4ead7" stroke-width="1.5" stroke-dasharray="2 4"/>
    <path d="M166 64v96" stroke="#8e1f28" stroke-width="3" stroke-dasharray="1 3"/>
  </symbol>
</svg>`;
