import { MemorySpace, User } from './types.js'

export const allUsers: User[] = [
  { id: 'u1', name: 'Jagadeesh', avatar: '', email: 'jagadeesh@example.com', phone: '9876543210' },
  { id: 'u2', name: 'Rahul', avatar: '', email: 'rahul@example.com', phone: '9876543211' },
  { id: 'u3', name: 'Priya', avatar: '', email: 'priya@example.com', phone: '9876543212' },
  { id: 'u4', name: 'Ankit', avatar: '', email: 'ankit@example.com', phone: '9876543213' },
  { id: 'u5', name: 'Vikram', avatar: '', email: 'vikram@example.com', phone: '9876543214' },
  { id: 'u6', name: 'Sneha', avatar: '', email: 'sneha@example.com', phone: '9876543215' },
]

const INVITE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateInviteCode(existingCodes: string[]): string {
  const existing = new Set(existingCodes)
  let code = ''
  do {
    code = ''
    for (let i = 0; i < 6; i++) code += INVITE_CHARS[Math.floor(Math.random() * INVITE_CHARS.length)]
  } while (existing.has(code))
  return code
}

export const spaces: MemorySpace[] = [
  // PERSONAL SPACES
  {
    id: 'personal-u1', title: 'Personal Life', coverImage: '', coverEmoji: '\u2728',
    memoryCount: 3, type: 'personal', createdBy: 'u1',
    membersList: [{ userId: 'u1', name: 'Jagadeesh', role: 'owner', status: 'active', joinedAt: '2024-01-01' }],
    joinRequests: [], description: 'My journey through life',
    memories: [
      {
        id: 'm1', title: 'Got my first pet - Luna', date: '2024-03-10', endDate: '2024-03-15', photos: [],
        story: 'Brought Luna home today. She was scared at first, hiding under the couch, but by evening she was curled up in my lap purring.',
        location: 'Bangalore', tags: ['pets', 'luna'], reactions: { '\u2764\uFE0F': 12 },
        substories: [
          { id: 'ms1-1', date: '2024-03-10', type: 'text', title: 'The drive home', content: 'She meowed the entire car ride. Tiny, scared meows that broke my heart.' },
          { id: 'ms1-2', date: '2024-03-11', type: 'text', title: 'She chose my lap', content: 'Woke up to find Luna sitting on my chest, staring at me. I didn\'t move for 30 minutes.' },
          { id: 'ms1-3', date: '2024-03-15', type: 'text', title: 'She knows her name', content: 'I called out "Luna" and she turned around and ran to me. We\'re officially best friends.' },
        ],
      },
      {
        id: 'm2', title: 'First day at my dream job', date: '2024-06-15', photos: [],
        story: 'Walked into the office with butterflies in my stomach. By lunch, I knew this was exactly where I was meant to be.',
        location: 'Hyderabad', tags: ['career', 'milestone'], reactions: { '\ud83c\udf89': 8 },
      },
      {
        id: 'm3', title: 'Moving to Bangalore', date: '2023-08-01', photos: [],
        story: 'A new city, a new chapter. The autorickshaw ride from the station felt like entering a different world.',
        location: 'Bangalore', tags: ['moving', 'new-beginnings'], reactions: { '\ud83c\udfe0': 8 },
      },
    ],
  },
  {
    id: 'personal-u2', title: 'Rahul\'s Diary', coverImage: '', coverEmoji: '\ud83c\udfb8',
    memoryCount: 2, type: 'personal', createdBy: 'u2',
    membersList: [{ userId: 'u2', name: 'Rahul', role: 'owner', status: 'active', joinedAt: '2024-01-01' }],
    joinRequests: [], description: 'Music, travel, and everything between',
    memories: [
      { id: 'r1', title: 'First open mic performance', date: '2024-05-20', photos: [], story: 'Hands shaking, voice cracking, but I did it. Sang in front of 50 strangers and they actually clapped.', location: 'Mumbai', tags: ['music', 'milestone'], reactions: { '\ud83c\udfb5': 15 } },
      { id: 'r2', title: 'Solo trip to Manali', date: '2024-09-10', photos: [], story: 'Just me, a backpack, and the mountains. Found peace I didn\'t know I was looking for.', location: 'Manali', tags: ['travel', 'solo'], reactions: { '\u26f0\uFE0F': 10 } },
    ],
  },
  {
    id: 'personal-u3', title: 'Priya\'s Corner', coverImage: '', coverEmoji: '\ud83c\udf3b',
    memoryCount: 2, type: 'personal', createdBy: 'u3',
    membersList: [{ userId: 'u3', name: 'Priya', role: 'owner', status: 'active', joinedAt: '2024-02-01' }],
    joinRequests: [], description: 'Art, sunsets, and small joys',
    memories: [
      { id: 'p1', title: 'First painting sold', date: '2024-07-15', photos: [], story: 'Someone actually paid money for something I created. I cried in the bathroom for ten minutes.', tags: ['art', 'milestone'], reactions: { '\ud83c\udfa8': 20 } },
      { id: 'p2', title: 'Adopted a street dog - Biscuit', date: '2025-01-20', photos: [], story: 'He followed me home three days in a row. On the fourth day, I brought him in. Best decision ever.', location: 'Pune', tags: ['pets', 'beginnings'], reactions: { '\ud83d\udc36': 18 } },
    ],
  },
  {
    id: 'personal-u4', title: 'Ankit\'s Log', coverImage: '', coverEmoji: '\ud83d\udcbb',
    memoryCount: 1, type: 'personal', createdBy: 'u4',
    membersList: [{ userId: 'u4', name: 'Ankit', role: 'owner', status: 'active', joinedAt: '2024-03-01' }],
    joinRequests: [], description: 'Code, coffee, chaos',
    memories: [
      { id: 'a1', title: 'Shipped my first side project', date: '2024-11-01', photos: [], story: 'After 6 months of weekends, it\'s live. Only 3 users so far but they\'re all me on different devices.', tags: ['coding', 'launch'], reactions: { '\ud83d\ude80': 12 } },
    ],
  },
  {
    id: 'personal-u5', title: 'Vikram\'s World', coverImage: '', coverEmoji: '\ud83c\udfb6',
    memoryCount: 1, type: 'personal', createdBy: 'u5',
    membersList: [{ userId: 'u5', name: 'Vikram', role: 'owner', status: 'active', joinedAt: '2024-01-01' }],
    joinRequests: [], description: 'Guitar, friends, and late nights',
    memories: [
      { id: 'v1', title: 'Learned my first full song', date: '2024-04-10', photos: [], story: 'Wonderwall. Yes, I\'m that guy now. But I played it all the way through without stopping and it felt amazing.', tags: ['music', 'guitar'], reactions: { '\ud83c\udfb8': 8 } },
    ],
  },
  {
    id: 'personal-u6', title: 'Sneha\'s Space', coverImage: '', coverEmoji: '\ud83d\udcda',
    memoryCount: 1, type: 'personal', createdBy: 'u6',
    membersList: [{ userId: 'u6', name: 'Sneha', role: 'owner', status: 'active', joinedAt: '2024-01-01' }],
    joinRequests: [], description: 'Books, baking, and big dreams',
    memories: [
      { id: 's1', title: 'Read 50 books this year', date: '2024-12-31', photos: [], story: 'Started the year with a goal and actually stuck to it. Book 50 was "A Gentleman in Moscow" and it was perfect.', tags: ['books', 'milestone'], reactions: { '\ud83d\udcda': 15 } },
    ],
  },

  // GROUP SPACES
  {
    id: 'thailand-trip', title: 'Thailand Trip 2025', coverImage: '', coverEmoji: '\ud83c\uddf9\ud83c\udded',
    memoryCount: 4, type: 'group', createdBy: 'u1', inviteCode: 'TH25XP',
    membersList: [
      { userId: 'u1', name: 'Jagadeesh', role: 'owner', status: 'active', joinedAt: '2025-01-01' },
      { userId: 'u2', name: 'Rahul', role: 'member', status: 'active', joinedAt: '2025-01-01' },
      { userId: 'u3', name: 'Priya', role: 'member', status: 'active', joinedAt: '2025-01-02' },
      { userId: 'u4', name: 'Ankit', role: 'admin', status: 'active', joinedAt: '2025-01-01' },
    ],
    joinRequests: [], description: 'Our unforgettable adventure through Thailand',
    memories: [
      {
        id: 'tm1', title: 'Landing in Bangkok', date: '2025-01-05', endDate: '2025-01-06', photos: [],
        story: 'The heat hit us as soon as we stepped out. Neon lights and incredible food smells everywhere.',
        location: 'Bangkok', tags: ['arrival', 'bangkok'], reactions: { '\u2708\uFE0F': 4 },
        substories: [
          { id: 'tms1-1', date: '2025-01-05', type: 'text', title: 'Airport chaos', content: 'Ankit forgot his boarding pass. Priya almost missed the flight buying duty-free.' },
          { id: 'tms1-2', date: '2025-01-05', type: 'photo', title: 'First tuk-tuk ride', photos: [], caption: 'Four of us crammed into one tuk-tuk. The driver was laughing at us.' },
          { id: 'tms1-3', date: '2025-01-06', type: 'text', title: 'Khao San Road at midnight', content: 'Rahul tried a scorpion on a stick and immediately regretted it.' },
        ],
      },
      { id: 'tm2', title: 'Floating Market Adventure', date: '2025-01-07', photos: [], story: 'Priya fell in the water and we couldn\'t stop laughing for an hour.', location: 'Damnoen Saduak', tags: ['market', 'funny'], reactions: { '\ud83d\ude02': 12 } },
      { id: 'tm3', title: 'Phi Phi Islands', date: '2025-01-10', photos: [], story: 'Crystal clear water and a sunset in shades of pink and gold. No words needed.', location: 'Phi Phi Islands', tags: ['beach', 'islands'], reactions: { '\ud83c\udf05': 18 } },
      { id: 'tm4', title: 'Last Night in Chiang Mai', date: '2025-01-14', photos: [], story: 'Lanterns floating into the night sky, each carrying a wish.', location: 'Chiang Mai', tags: ['lanterns', 'farewell'], reactions: { '\ud83c\udfee': 15 } },
    ],
  },
  {
    id: 'college-friends', title: 'College Gang', coverImage: '', coverEmoji: '\ud83c\udf93',
    memoryCount: 3, type: 'group', createdBy: 'u5', inviteCode: 'CLG4EV',
    membersList: [
      { userId: 'u5', name: 'Vikram', role: 'owner', status: 'active', joinedAt: '2019-08-01' },
      { userId: 'u1', name: 'Jagadeesh', role: 'member', status: 'active', joinedAt: '2019-08-01' },
      { userId: 'u6', name: 'Sneha', role: 'admin', status: 'active', joinedAt: '2019-08-02' },
      { userId: 'u2', name: 'Rahul', role: 'member', status: 'active', joinedAt: '2019-08-03' },
      { userId: 'u3', name: 'Priya', role: 'member', status: 'active', joinedAt: '2019-09-01' },
    ],
    joinRequests: [], description: 'The best four years of our lives',
    memories: [
      { id: 'cm1', title: 'First day of college', date: '2019-08-01', photos: [], story: 'Five strangers who had no idea they\'d become inseparable.', tags: ['college', 'beginnings'], reactions: { '\ud83e\udd7a': 10 } },
      { id: 'cm2', title: 'Winning the hackathon', date: '2021-03-15', photos: [], story: 'Red Bull cans everywhere. Sneha literally screamed when they announced our name.', tags: ['hackathon', 'victory'], reactions: { '\ud83c\udfc6': 20 } },
      { id: 'cm3', title: 'Farewell night under the stars', date: '2023-05-20', photos: [], story: 'Vikram brought his guitar. We didn\'t talk about the future \u2014 just lived in that moment.', tags: ['farewell', 'nostalgia'], reactions: { '\u2b50': 22 } },
    ],
  },
  {
    id: 'startup-journey', title: 'Startup Journey', coverImage: '', coverEmoji: '\ud83d\ude80',
    memoryCount: 2, type: 'group', createdBy: 'u1', inviteCode: 'STRT9K',
    membersList: [
      { userId: 'u1', name: 'Jagadeesh', role: 'owner', status: 'active', joinedAt: '2025-02-20' },
      { userId: 'u4', name: 'Ankit', role: 'admin', status: 'active', joinedAt: '2025-02-20' },
      { userId: 'u6', name: 'Sneha', role: 'member', status: 'active', joinedAt: '2025-02-21' },
    ],
    joinRequests: [], description: 'Building something from nothing',
    memories: [
      { id: 'sm1', title: 'The napkin sketch', date: '2025-02-20', photos: [], story: 'Three people, one coffee shop, and a napkin full of crazy ideas.', location: 'Third Wave Coffee, Bangalore', tags: ['idea', 'founding'], reactions: { '\ud83d\udca1': 10 } },
      { id: 'sm2', title: 'First user signed up', date: '2025-06-10', photos: [], story: 'User #1. A complete stranger believed in what we built.', tags: ['milestone', 'launch'], reactions: { '\ud83c\udf89': 30 } },
    ],
  },
  {
    id: 'weekend-trekkers', title: 'Weekend Trekkers', coverImage: '', coverEmoji: '\u26f0\uFE0F',
    memoryCount: 3, type: 'group', createdBy: 'u2', inviteCode: 'TREK77',
    membersList: [
      { userId: 'u2', name: 'Rahul', role: 'owner', status: 'active', joinedAt: '2024-06-01' },
      { userId: 'u1', name: 'Jagadeesh', role: 'member', status: 'active', joinedAt: '2024-06-01' },
      { userId: 'u5', name: 'Vikram', role: 'member', status: 'active', joinedAt: '2024-06-05' },
      { userId: 'u4', name: 'Ankit', role: 'admin', status: 'active', joinedAt: '2024-06-02' },
    ],
    joinRequests: [], description: 'Every weekend is an adventure',
    memories: [
      { id: 'wt1', title: 'Skandagiri sunrise trek', date: '2024-07-14', photos: [], story: 'Started at 2 AM. Reached the top just as the sun broke through the clouds. Worth every sleepy step.', location: 'Skandagiri', tags: ['trek', 'sunrise'], reactions: { '\ud83c\udf05': 14 } },
      { id: 'wt2', title: 'Lost in Coorg', date: '2024-09-22', photos: [], story: 'GPS died. We walked for 3 hours in the wrong direction. Found an amazing waterfall nobody knows about.', location: 'Coorg', tags: ['trek', 'adventure'], reactions: { '\ud83d\ude02': 10 } },
      { id: 'wt3', title: 'Camping at Nandi Hills', date: '2024-11-30', photos: [], story: 'Stars like we\'ve never seen. Ankit made the worst chai ever and we drank it all anyway.', location: 'Nandi Hills', tags: ['camping', 'stars'], reactions: { '\u2b50': 8 } },
    ],
  },
  {
    id: 'book-club', title: 'The Reading Room', coverImage: '', coverEmoji: '\ud83d\udcda',
    memoryCount: 2, type: 'group', createdBy: 'u6', inviteCode: 'READ42',
    membersList: [
      { userId: 'u6', name: 'Sneha', role: 'owner', status: 'active', joinedAt: '2024-03-01' },
      { userId: 'u3', name: 'Priya', role: 'member', status: 'active', joinedAt: '2024-03-05' },
      { userId: 'u5', name: 'Vikram', role: 'member', status: 'active', joinedAt: '2024-04-01' },
    ],
    joinRequests: [], description: 'Books that changed our lives',
    memories: [
      { id: 'bc1', title: 'First book club meeting', date: '2024-03-10', photos: [], story: 'We argued about "Norwegian Wood" for 3 hours. Priya hated it. Vikram cried. It was perfect.', tags: ['books', 'discussion'], reactions: { '\ud83d\udcda': 6 } },
      { id: 'bc2', title: 'Reading marathon at the cafe', date: '2024-08-15', photos: [], story: 'We booked a corner table and read in silence for 5 hours. The waiter thought we were weird. We were happy.', location: 'Cafe Mosaic', tags: ['books', 'cafe'], reactions: { '\u2615': 10 } },
    ],
  },
  {
    id: 'goa-trip', title: 'Goa Reunion 2024', coverImage: '', coverEmoji: '\ud83c\udf0a',
    memoryCount: 3, type: 'group', createdBy: 'u3', inviteCode: 'GOA24X',
    membersList: [
      { userId: 'u3', name: 'Priya', role: 'owner', status: 'active', joinedAt: '2024-12-01' },
      { userId: 'u1', name: 'Jagadeesh', role: 'member', status: 'active', joinedAt: '2024-12-01' },
      { userId: 'u2', name: 'Rahul', role: 'admin', status: 'active', joinedAt: '2024-12-01' },
      { userId: 'u6', name: 'Sneha', role: 'member', status: 'active', joinedAt: '2024-12-02' },
      { userId: 'u5', name: 'Vikram', role: 'member', status: 'active', joinedAt: '2024-12-02' },
      { userId: 'u4', name: 'Ankit', role: 'member', status: 'active', joinedAt: '2024-12-03' },
    ],
    joinRequests: [], description: 'The whole gang back together',
    memories: [
      { id: 'gt1', title: 'Beach bonfire night', date: '2024-12-21', photos: [], story: 'All six of us around a fire. Vikram played guitar. Rahul sang (badly). Nobody cared.', location: 'Palolem Beach', tags: ['beach', 'bonfire'], reactions: { '\ud83d\udd25': 20 } },
      { id: 'gt2', title: 'Scooter convoy chaos', date: '2024-12-22', photos: [], story: 'Six scooters, zero sense of direction. Sneha led us into a fish market. Ankit drove into a bush.', tags: ['adventure', 'funny'], reactions: { '\ud83d\ude02': 25 } },
      { id: 'gt3', title: 'Last sunset together', date: '2024-12-24', photos: [], story: 'We promised this wouldn\'t be the last trip. Priya made everyone pinky swear.', location: 'Vagator', tags: ['sunset', 'farewell'], reactions: { '\ud83e\udd7a': 30 } },
    ],
  },
  {
    id: 'fitness-buddies', title: 'Fitness Buddies', coverImage: '', coverEmoji: '\ud83d\udcaa',
    memoryCount: 2, type: 'group', createdBy: 'u4', inviteCode: 'FIT365',
    membersList: [
      { userId: 'u4', name: 'Ankit', role: 'owner', status: 'active', joinedAt: '2024-08-01' },
      { userId: 'u2', name: 'Rahul', role: 'member', status: 'active', joinedAt: '2024-08-05' },
      { userId: 'u1', name: 'Jagadeesh', role: 'member', status: 'active', joinedAt: '2024-08-10' },
    ],
    joinRequests: [], description: '5 AM alarm club',
    memories: [
      { id: 'fb1', title: 'First 5K run together', date: '2024-09-01', photos: [], story: 'Jagadeesh almost gave up at 3K. Rahul dragged him the rest of the way. We all collapsed at the finish.', tags: ['running', 'milestone'], reactions: { '\ud83c\udfc3': 8 } },
      { id: 'fb2', title: 'Completed 30-day challenge', date: '2024-10-01', photos: [], story: '30 days without missing a single workout. We celebrated with pizza. The irony was not lost on us.', tags: ['fitness', 'achievement'], reactions: { '\ud83c\udf55': 12 } },
    ],
  },
]
