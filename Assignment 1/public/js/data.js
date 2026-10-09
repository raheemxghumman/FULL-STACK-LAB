/* ==========================================================================
   ConnecFriend — seed data
   --------------------------------------------------------------------------
   The assignment says there are no server calls, so this file plays the part
   of the database. On first load it is copied into localStorage by store.js;
   after that every change (posts, likes, ratings, invites, messages) is saved
   there. Times are stored as "minutes ago" and turned into real timestamps
   when the database is created, so the demo always looks recent.
   ========================================================================== */

const SEED = {
  // Every member has an account (no registration page needed).
  // password is the demo password for that member.
  users: [
    { id: "u1",  username: "abdulraheem", password: "connect123", name: "Abdul Raheem",  city: "Islamabad", hometown: "Multan",      bio: "CS student at Air University. I build websites, do SEO and edit videos.", work: "Student, Air University", born: "Multan, Pakistan", joined: "2024-09-02", color: "#0f766e", lastLoginMin: 0,    friends: ["u2", "u3", "u4", "u5", "u6", "u7"], ignores: [] },
    { id: "u2",  username: "ayesha",      password: "connect123", name: "Ayesha Siddiqui", city: "Lahore",    hometown: "Lahore",      bio: "UI designer who sketches everything twice.",                             work: "Product Designer, Pixelwise", born: "Lahore, Pakistan",     joined: "2024-10-11", color: "#7c3aed", lastLoginMin: 4,    friends: ["u1", "u3", "u6"],             ignores: [] },
    { id: "u3",  username: "hamza",       password: "connect123", name: "Hamza Tariq",     city: "Islamabad", hometown: "Rawalpindi",  bio: "Backend developer. Coffee, Go and long bike rides.",                     work: "Software Engineer, Nexus Labs", born: "Rawalpindi, Pakistan", joined: "2024-11-03", color: "#2563eb", lastLoginMin: 12,   friends: ["u1", "u2", "u5"],             ignores: [] },
    { id: "u4",  username: "sara",        password: "connect123", name: "Sara Malik",      city: "Karachi",   hometown: "Karachi",     bio: "Data science student and part-time photographer.",                      work: "Student, NED University", born: "Karachi, Pakistan",    joined: "2025-01-15", color: "#db2777", lastLoginMin: 45,   friends: ["u1", "u7"],                   ignores: [] },
    { id: "u5",  username: "bilal",       password: "connect123", name: "Bilal Ahmed",     city: "Multan",    hometown: "Multan",      bio: "Cricket on weekends, Android apps on weekdays.",                       work: "Android Developer, AppCraft", born: "Multan, Pakistan",     joined: "2025-02-20", color: "#ea580c", lastLoginMin: 130,  friends: ["u1", "u3"],                   ignores: [] },
    { id: "u6",  username: "zainab",      password: "connect123", name: "Zainab Hussain",  city: "Peshawar",  hometown: "Peshawar",    bio: "Writes about tech for students. Always reading something.",            work: "Tech Writer, ByteSized", born: "Peshawar, Pakistan",   joined: "2025-03-08", color: "#0891b2", lastLoginMin: 380,  friends: ["u1", "u2"],                   ignores: [] },
    { id: "u7",  username: "usman",       password: "connect123", name: "Usman Raza",      city: "Faisalabad",hometown: "Faisalabad",  bio: "Network engineer and amateur chef.",                                    work: "Network Engineer, PTCL", born: "Faisalabad, Pakistan", joined: "2025-04-12", color: "#16a34a", lastLoginMin: 1500, friends: ["u1", "u4"],                   ignores: [] },
    { id: "u8",  username: "fatima",      password: "connect123", name: "Fatima Noor",     city: "Islamabad", hometown: "Quetta",      bio: "Cyber security enthusiast. Ask me about CTFs.",                         work: "Student, Air University", born: "Quetta, Pakistan",     joined: "2025-05-01", color: "#9333ea", lastLoginMin: 25,   friends: [],                             ignores: [] },
    { id: "u9",  username: "ali",         password: "connect123", name: "Ali Haider",      city: "Rawalpindi",hometown: "Jhelum",      bio: "Game developer, Unity and pixel art.",                                  work: "Game Developer, IndiePlay", born: "Jhelum, Pakistan",     joined: "2025-06-17", color: "#ca8a04", lastLoginMin: 90,   friends: [],                             ignores: [] },
    // u10 has put Abdul Raheem on their ignore list, so he cannot send them a friend request
    { id: "u10", username: "maryam",      password: "connect123", name: "Maryam Khan",     city: "Lahore",    hometown: "Sialkot",     bio: "Marketing student. Loves podcasts and planning trips.",                 work: "Student, LUMS", born: "Sialkot, Pakistan",    joined: "2025-07-22", color: "#be123c", lastLoginMin: 600,  friends: [],                             ignores: ["u1"] }
  ],

  // Friend ratings: rater -> { friendId: 1 | 2 | 3 }   (1 Stupid, 2 Cool, 3 Trustworthy)
  ratings: {
    u1: { u2: 3, u3: 2, u5: 3 }
  },

  // Pending friend requests
  invites: [
    { id: "i1", from: "u8", to: "u1", minAgo: 50 }
  ],

  // News posts. audience is "all" (all of the author's friends) or a list of user ids.
  posts: [
    { id: "p1", author: "u2", minAgo: 6,    audience: "all", text: "Finished the new onboarding screens for our app today. Three rounds of feedback later, it finally feels simple. 🎨", likes: ["u1", "u3"], dislikes: [] },
    { id: "p2", author: "u3", minAgo: 40,   audience: "all", text: "Tip for anyone learning Node.js: read the error message slowly before searching it online. It usually tells you exactly what is wrong.", likes: ["u1", "u5", "u2"], dislikes: [] },
    { id: "p3", author: "u4", minAgo: 70,   audience: "all", text: "Sunset at Clifton beach this evening. Karachi skies never disappoint. 🌅", likes: ["u7"], dislikes: [] },
    { id: "p4", author: "u5", minAgo: 200,  audience: "all", text: "Our Android app crossed 1,000 downloads this week! Thank you to everyone who tested the beta.", likes: ["u1", "u3"], dislikes: ["u7"] },
    { id: "p5", author: "u6", minAgo: 420,  audience: "all", text: "New article: 5 free resources to learn data structures properly. Link in my profile.", likes: [], dislikes: [] },
    { id: "p6", author: "u7", minAgo: 1600, audience: "all", text: "Tried making biryani from my grandmother's recipe. Verdict: needs more practice. 😅", likes: ["u4"], dislikes: ["u1"] },
    { id: "p7", author: "u2", minAgo: 900,  audience: ["u1"], text: "Abdul Raheem, can you review my portfolio colours before Friday? Only sharing this with you.", likes: [], dislikes: [] },
    { id: "p8", author: "u1", minAgo: 300,  audience: "all", text: "Started the Full Stack Web Development assignment. Bootstrap is making layouts so much faster.", likes: ["u2", "u6"], dislikes: [] }
  ],

  // Private messages (between any two members, friends or not)
  messages: [
    { id: "m1", from: "u2", to: "u1", minAgo: 30, text: "Hey! Did you see the new design system I shared?" },
    { id: "m2", from: "u1", to: "u2", minAgo: 28, text: "Yes, it looks great. The spacing is much cleaner now." },
    { id: "m3", from: "u2", to: "u1", minAgo: 27, text: "Thanks! I'll send the icons tonight." },
    { id: "m4", from: "u8", to: "u1", minAgo: 55, text: "Hi Abdul Raheem, I sent you a friend request. We are in the same CS class." }
  ]
};

// Labels and icons for the 1-3 friend rating scale (Bootstrap Icons)
const RATINGS = {
  1: { label: "Stupid", icon: "bi-emoji-dizzy", color: "danger" },
  2: { label: "Cool", icon: "bi-sunglasses", color: "info" },
  3: { label: "Trustworthy", icon: "bi-shield-check", color: "success" }
};
