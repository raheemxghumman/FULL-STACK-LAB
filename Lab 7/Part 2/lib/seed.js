/* ==========================================================================
   lib/seed.js - the starting data and the shop's fixed settings
   --------------------------------------------------------------------------
   The catalogue below was taken unchanged from the Lab 3 store
   (js/products.js). In Lab 3 the browser held it; now only the API does,
   and the store pages ask for it with GET /api/products.

   createDatabase() copies this data into a fresh database the first time
   the API starts (when data/db.json does not exist yet).
   ========================================================================== */

export const CATEGORIES = {
  vases: "Vases",
  tableware: "Tableware",
  tiles: "Tiles",
  lamps: "Lamps",
  textiles: "Textiles & Shoes"
};

export const PRODUCTS = [
  { id: "p1", name: "Blue Kashi Surahi Vase", category: "vases", price: 4800, oldPrice: 5500, stock: 12, art: "a-surahi", bg: "#e6ecf7", description: "A long-necked surahi thrown on the wheel and painted by hand with the cobalt flowers Multan’s potters are known for. Glazed inside and out, 34 cm tall.", baseRating: 4.8, baseReviewCount: 124 },
  { id: "p2", name: "Nila Matka Vase", category: "vases", price: 3200, stock: 9, art: "a-matka", bg: "#e2f1ef", description: "A round, low matka in turquoise glaze with a band of white kashi flowers. Looks best with dried pampas or on its own on a console table.", oldPrice: null, baseRating: 4.6, baseReviewCount: 86 },
  { id: "p3", name: "Tall Floral Bottle Vase", category: "vases", price: 6500, stock: 5, art: "a-bottle", bg: "#e9e7f4", description: "Deep cobalt bottle vase with a white vine climbing from foot to neck. Each piece is signed underneath by the artisan. 42 cm tall.", oldPrice: null, baseRating: 4.7, baseReviewCount: 41 },
  { id: "p4", name: "Hand-painted Wall Plate", category: "tableware", price: 1850, stock: 25, art: "a-plate", bg: "#f3ece0", description: "A 30 cm plate with a central kashi medallion and a ring of turquoise buds. Comes with a wall hook, and is food-safe if you would rather use it.", oldPrice: null, baseRating: 4.5, baseReviewCount: 158 },
  { id: "p5", name: "Kashi Serving Bowl", category: "tableware", price: 2400, oldPrice: 2900, stock: 14, art: "a-bowl", bg: "#e6ecf7", description: "Wide serving bowl for salan, fruit or rice. Hand-painted outside, pale turquoise glaze inside. Dishwasher safe on a gentle cycle.", baseRating: 4.7, baseReviewCount: 97 },
  { id: "p6", name: "Chai Mugs · Set of 2", category: "tableware", price: 1600, stock: 30, art: "a-mugs", bg: "#f5e9df", description: "One white mug with a cobalt flower and one turquoise mug with a white one. 280 ml each, made for doodh patti on winter evenings.", oldPrice: null, baseRating: 4.4, baseReviewCount: 203 },
  { id: "p7", name: "Multani Tile Panel · 6 pcs", category: "tiles", price: 7200, stock: 4, art: "a-tiles", bg: "#e2f1ef", description: "Six 15 cm hand-painted tiles that form one panel, the same star-and-flower pattern you see on the shrines of Multan. For kitchen backsplashes or framing.", oldPrice: null, baseRating: 4.9, baseReviewCount: 32 },
  { id: "p8", name: "Hexagon Coasters · Set of 4", category: "tiles", price: 1400, stock: 22, art: "a-hex", bg: "#e6ecf7", description: "Four hexagonal ceramic coasters with cork backing: two cobalt, one turquoise and one white. A small gift that travels well.", oldPrice: null, baseRating: 4.5, baseReviewCount: 75 },
  { id: "p9", name: "Camel-skin Naqashi Lamp", category: "lamps", price: 8900, oldPrice: 9800, stock: 6, art: "a-camel", bg: "#f6e7d6", description: "Traditional Multani lamp made from stretched camel skin and painted in naqashi work. Gives a warm amber glow. Bulb and fitting included.", baseRating: 4.8, baseReviewCount: 64 },
  { id: "p10", name: "Kashi Table Lamp", category: "lamps", price: 5600, stock: 8, art: "a-lamp", bg: "#f3ece0", description: "A glazed kashi base with a cream linen shade. Height 48 cm, E27 fitting, 2 m braided cable.", oldPrice: null, baseRating: 4.6, baseReviewCount: 38 },
  { id: "p11", name: "Hand-stitched Multani Khussa", category: "textiles", price: 3500, stock: 18, art: "a-khussa", bg: "#e9e7f4", description: "Pure leather khussa with golden tilla embroidery on cobalt velvet. Soft padded insole, sizes 36 to 44 (add your size in the checkout notes).", oldPrice: null, baseRating: 4.5, baseReviewCount: 146 },
  { id: "p12", name: "Block-printed Ajrak Shawl", category: "textiles", price: 2800, stock: 20, art: "a-ajrak", bg: "#f6e3df", description: "Cotton ajrak printed by hand with wooden blocks in crimson and indigo. 2.5 m long, softens with every wash.", oldPrice: null, baseRating: 4.7, baseReviewCount: 118 }
];

export const RATING_BASE = {1: 12, 2: 19, 3: 58, 4: 251, 5: 842};

export const SEED_REVIEWS = [
  { id: "s1", productId: "p1", name: "Ayesha Siddiqui", city: "Lahore", rating: 5, date: "2026-09-18", verified: true, text: "The surahi is even prettier in person. The blue is deep and the glaze has that slightly uneven handmade look. Packed very carefully in straw and bubble wrap.", seeded: true },
  { id: "s2", productId: "p9", name: "Hamza Qureshi", city: "Karachi", rating: 5, date: "2026-09-12", verified: true, text: "Ordered the camel-skin lamp for my study. The warm light through the painted skin is beautiful at night. Delivered in four days.", seeded: true },
  { id: "s3", productId: "p4", name: "Mahnoor Tariq", city: "Islamabad", rating: 4, date: "2026-09-05", verified: true, text: "Lovely plate for the wall. One tiny chip on the rim, but they sent a replacement without any hassle.", seeded: true },
  { id: "s4", productId: "p11", name: "Bilal Ahmed", city: "Multan", rating: 5, date: "2026-08-29", verified: true, text: "Proper Multani khussa, soft leather inside and the embroidery is neat. The size chart was accurate.", seeded: true },
  { id: "s5", productId: "p6", name: "Zainab Raza", city: "Rawalpindi", rating: 4, date: "2026-08-21", verified: true, text: "Chai tastes better in these mugs, no joke. Slightly smaller than I expected, but still my favourite.", seeded: true },
  { id: "s6", productId: "p7", name: "Usman Farooq", city: "Faisalabad", rating: 5, date: "2026-08-14", verified: true, text: "Used the tile panel above our kitchen counter. Everyone who visits asks where it is from.", seeded: true },
  { id: "s7", productId: "p12", name: "Hira Malik", city: "Hyderabad", rating: 5, date: "2026-07-30", verified: true, text: "Genuine ajrak print and the colours did not bleed in the first wash. Gifted one to my mother as well.", seeded: true },
  { id: "s8", productId: "p5", name: "Saad Hussain", city: "Peshawar", rating: 4, date: "2026-07-19", verified: true, text: "The serving bowl is sturdy and you can see the brush strokes in the pattern. Delivery took about a week.", seeded: true },
  { id: "s9", productId: "p2", name: "Fatima Noor", city: "Sialkot", rating: 5, date: "2026-07-08", verified: true, text: "The turquoise matka is the centrepiece of our lounge now. Five stars from the whole family.", seeded: true }
];

/* Delivery options and coupon codes (same rules as Lab 3). */
export const DELIVERY = {
  standard: { label: "Standard delivery", eta: "3–5 working days", fee: 250, freeOver: 5000 },
  express: { label: "Express delivery", eta: "1–2 working days", fee: 600 }
};

export const COUPONS = {
  MULTAN10: { type: "percent", value: 10, label: "10% off your order" },
  KASHI500: { type: "flat", value: 500, min: 3000, label: "PKR 500 off orders over PKR 3,000" }
};

/* Cities offered on the signup and checkout forms. */
export const CITIES = ["Multan", "Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad", "Peshawar", "Quetta",
  "Hyderabad", "Sialkot", "Bahawalpur", "Gujranwala", "Other"];

/* Picture names in the store's SVG sprite, so new products can reuse one. */
export const ART = PRODUCTS.map((p) => p.art);

/* Two accounts exist from the start. Their passwords are hashed when the database is created. */
export const SEED_USERS = [
  { name: "Demo Customer", email: "demo@kashighar.pk", phone: "03001234567", city: "Multan", role: "customer", password: "demo1234", created: "2026-09-01" },
  { name: "Store Admin", email: "admin@kashighar.pk", phone: "03007654321", city: "Multan", role: "admin", password: "admin1234", created: "2026-09-01" }
];
