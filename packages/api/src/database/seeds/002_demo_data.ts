import type { Knex } from 'knex';
import bcrypt from 'bcrypt';
import { SnowflakeGenerator } from '../../lib/snowflake.js';
import { DEFAULT_MEMBER_PERMISSIONS } from '@crabac/shared';

const sf = new SnowflakeGenerator(2);
const id = () => sf.generate();

const SPACE_ID = '148175670671839232';
const BINGO_ID = '147122562336296960';
const DEFAULT_ROLE_ID = '148175670688616449';
const GENERAL_ID = '148175670697005056';

export async function seed(knex: Knex): Promise<void> {
  const passwordHash = await bcrypt.hash('demopassword', 12);

  // --- Fake users ---
  const users = [
    { id: id(), username: 'margot', display_name: 'Margot', email: 'margot@demo.crab.ac' },
    { id: id(), username: 'hank', display_name: 'Hank', email: 'hank@demo.crab.ac' },
    { id: id(), username: 'priya', display_name: 'Priya', email: 'priya@demo.crab.ac' },
    { id: id(), username: 'TJ', display_name: 'TJ', email: 'tj@demo.crab.ac' },
    { id: id(), username: 'suki', display_name: 'Suki', email: 'suki@demo.crab.ac' },
    { id: id(), username: 'owen', display_name: 'Owen', email: 'owen@demo.crab.ac' },
    { id: id(), username: 'lena', display_name: 'Lena', email: 'lena@demo.crab.ac' },
    { id: id(), username: 'felix', display_name: 'Felix', email: 'felix@demo.crab.ac' },
    { id: id(), username: 'noor', display_name: 'Noor', email: 'noor@demo.crab.ac' },
    { id: id(), username: 'cass', display_name: 'Cass', email: 'cass@demo.crab.ac' },
    { id: id(), username: 'reese', display_name: 'Reese', email: 'reese@demo.crab.ac' },
    { id: id(), username: 'dana', display_name: 'Dana', email: 'dana@demo.crab.ac' },
  ];

  // Insert users (ignore if email already exists)
  for (const u of users) {
    const exists = await knex('users').where('email', u.email).first();
    if (!exists) {
      await knex('users').insert({
        id: u.id,
        email: u.email,
        username: u.username,
        display_name: u.display_name,
        password_hash: passwordHash,
        email_verified: true,
      });
    }
  }

  // Re-fetch IDs (in case users already existed)
  const userRows = await knex('users').whereIn('email', users.map(u => u.email));
  const userMap: Record<string, string> = {};
  for (const row of userRows) {
    userMap[row.username] = row.id.toString();
  }

  const margot = userMap['margot'];
  const hank = userMap['hank'];
  const priya = userMap['priya'];
  const tj = userMap['TJ'];
  const suki = userMap['suki'];
  const owen = userMap['owen'];
  const lena = userMap['lena'];
  const felix = userMap['felix'];
  const noor = userMap['noor'];
  const cass = userMap['cass'];
  const reese = userMap['reese'];
  const dana = userMap['dana'];
  const bingo = BINGO_ID;

  const allMembers = [margot, hank, priya, tj, suki, owen, lena, felix, noor, cass, reese, dana];

  // --- Add everyone as space members ---
  for (const userId of allMembers) {
    const exists = await knex('space_members').where({ space_id: SPACE_ID, user_id: userId }).first();
    if (!exists) {
      await knex('space_members').insert({ space_id: SPACE_ID, user_id: userId });
      await knex('member_roles').insert({ space_id: SPACE_ID, user_id: userId, role_id: DEFAULT_ROLE_ID });
    }
  }

  // --- Create categories ---
  const communityCatId = id();
  const projectsCatId = id();
  const socialCatId = id();

  await knex('channel_categories').insert([
    { id: communityCatId, space_id: SPACE_ID, name: 'Community', position: 0 },
    { id: projectsCatId, space_id: SPACE_ID, name: 'Projects', position: 1 },
    { id: socialCatId, space_id: SPACE_ID, name: 'Social', position: 2 },
  ]);

  // --- Create channels ---
  const introId = id();
  const ridesId = id();
  const routesId = id();
  const wrenching = id();
  const newRidersId = id();
  const offTopicId = id();
  const foodId = id();
  const photosId = id();

  await knex('channels').insert([
    { id: introId, space_id: SPACE_ID, name: 'introductions', topic: 'Say hi, tell us about yourself and your bike', type: 'text', position: 1, category_id: communityCatId },
    { id: ridesId, space_id: SPACE_ID, name: 'rides', topic: 'Upcoming group rides, route planning, who\'s in?', type: 'text', position: 2, category_id: communityCatId },
    { id: routesId, space_id: SPACE_ID, name: 'routes', topic: 'Share your favorite routes and GPX files', type: 'text', position: 3, category_id: communityCatId },
    { id: newRidersId, space_id: SPACE_ID, name: 'new-riders', topic: 'Questions and advice for people just getting started', type: 'text', position: 4, category_id: communityCatId },
    { id: wrenching, space_id: SPACE_ID, name: 'wrenching', topic: 'Bike maintenance, repairs, and upgrades', type: 'text', position: 5, category_id: projectsCatId },
    { id: offTopicId, space_id: SPACE_ID, name: 'off-topic', topic: 'Anything goes', type: 'text', position: 6, category_id: socialCatId },
    { id: foodId, space_id: SPACE_ID, name: 'post-ride-food', topic: 'The most important part of any ride', type: 'text', position: 7, category_id: socialCatId },
    { id: photosId, space_id: SPACE_ID, name: 'photos', topic: 'Share your ride photos', type: 'text', position: 8, category_id: socialCatId },
  ]);

  // Move general into community category
  await knex('channels').where('id', GENERAL_ID).update({ category_id: communityCatId, position: 0 });

  // --- Helper to insert a message with a delay between snowflakes ---
  const msg = (channelId: string, authorId: string, content: string, replyToId?: string) => ({
    id: id(),
    channel_id: channelId,
    author_id: authorId,
    content,
    reply_to_id: replyToId || null,
  });

  // --- #general ---
  const g1 = msg(GENERAL_ID, bingo, 'Welcome to CRABAC HQ! This is the main hub for the bike club. Poke around, say hi in #introductions, and check #rides for the next group ride.');
  const g2 = msg(GENERAL_ID, margot, 'This is so much better than the group chat. Finally I can mute #off-topic in peace.');
  const g3 = msg(GENERAL_ID, hank, 'Wait, you can mute channels?');
  const g4 = msg(GENERAL_ID, margot, 'Right-click the channel name. You\'re welcome.');
  const g5 = msg(GENERAL_ID, tj, 'Just rode past the old brewery on River Rd. They tore it down. Pouring one out.');
  const g6 = msg(GENERAL_ID, suki, 'Nooo that was the best halfway rest stop');
  const g7 = msg(GENERAL_ID, owen, 'Has anyone heard back about the permit for the century ride?');
  const g8 = msg(GENERAL_ID, bingo, 'Still waiting. Parks dept said end of the month.');
  const g9 = msg(GENERAL_ID, lena, 'I added some new routes to #routes if anyone wants to check them out');
  const g10 = msg(GENERAL_ID, felix, 'The Tuesday night ride is looking a bit soggy this week. Still happening?');
  const g11 = msg(GENERAL_ID, priya, 'Rain or shine baby. That\'s the deal.');
  const g12 = msg(GENERAL_ID, cass, 'I just signed up. Is the Tuesday ride beginner-friendly?');
  const g13 = msg(GENERAL_ID, priya, 'Absolutely. We regroup at every turn and nobody gets dropped. Come through!');
  const g14 = msg(GENERAL_ID, noor, '@everyone reminder: club meeting this Thursday at the usual spot. 7pm. Agenda is pinned in #general.');
  const g15 = msg(GENERAL_ID, dana, 'Will there be snacks?');
  const g16 = msg(GENERAL_ID, noor, 'There are always snacks, Dana.');

  await knex('messages').insert([g1, g2, g3, g4, g5, g6, g7, g8, g9, g10, g11, g12, g13, g14, g15, g16]);

  // --- #introductions ---
  const i1 = msg(introId, cass, 'Hey everyone! I\'m Cass. Just moved to town and looking for people to ride with. I\'ve got a beat-up Surly Cross-Check and zero sense of direction.');
  const i2 = msg(introId, priya, 'Welcome Cass! The Cross-Check is a perfect club bike. You\'ll fit right in.');
  const i3 = msg(introId, reese, 'Reese here. Road and gravel. I heard about this place from someone at the coffee shop on 5th. Apparently you all stop there every Saturday?');
  const i4 = msg(introId, suki, 'That\'s us! The Saturday morning ride always ends at Fifth Press. Come find us around 9:30.');
  const i5 = msg(introId, dana, 'Hi! I\'m Dana. Mostly a runner but I bought a bike last spring and I\'ve been hooked ever since. Still figuring out clipless pedals (my knees have the scars to prove it).');
  const i6 = msg(introId, felix, 'Welcome to the "I fell over at a stoplight" club. It happens to everyone exactly once. Or in my case, four times.');
  const i7 = msg(introId, hank, 'Hank. Mountain bike background but getting into road stuff. Someone told me road cyclists shave their legs and I\'m choosing not to think about that.');
  const i8 = msg(introId, margot, 'It\'s about aerodynamics, Hank.');
  const i9 = msg(introId, tj, 'It\'s about the aesthetic.');
  const i10 = msg(introId, owen, 'It\'s about the post-crash road rash cleanup, actually.');
  const i11 = msg(introId, noor, 'Hi, I\'m Noor. I volunteer with the local trails coalition and ride pretty much everything — road, gravel, MTB, cargo bike for groceries. Happy to be here.');
  const i12 = msg(introId, lena, 'A cargo bike person! We need more of you. Welcome Noor.');

  await knex('messages').insert([i1, i2, i3, i4, i5, i6, i7, i8, i9, i10, i11, i12]);

  // --- #rides ---
  const r1 = msg(ridesId, bingo, '**Saturday Morning Ride — This Week**\nMeeting at the usual spot (bike rack by the fountain, Riverside Park) at 8:00 AM. Route is the standard lake loop, ~35 miles, moderate pace. We\'ll regroup at the top of every climb. Coffee at Fifth Press after.');
  const r2 = msg(ridesId, priya, 'I\'m in. Bringing Cass along for her first group ride.');
  const r3 = msg(ridesId, cass, 'Nervous but excited. How fast is "moderate pace"?');
  const r4 = msg(ridesId, bingo, '15-17 mph on the flats. But seriously, nobody gets dropped. If you can ride 35 miles you\'re fine.');
  const r5 = msg(ridesId, owen, 'I\'ll sweep. Got a spare tube and a pump if anyone needs.');
  const r6 = msg(ridesId, tj, 'Skipping Saturday but putting out feelers: anyone interested in a gravel ride next Sunday? I\'ve been eyeing the old rail trail that connects to the state forest.');
  const r7 = msg(ridesId, hank, 'Yes. Absolutely yes. How long are we talking?');
  const r8 = msg(ridesId, tj, 'Probably 45-50 miles. Some of it is pretty chunky gravel so 35c minimum. I\'ll post the GPX in #routes once I finalize it.');
  const r9 = msg(ridesId, noor, 'I did that trail last fall. There\'s a washed-out section about 20 miles in — you\'ll want to take the bypass that goes through the campground. Happy to mark it on the GPX if you share it.');
  const r10 = msg(ridesId, tj, 'That would be amazing, thanks Noor.');
  const r11 = msg(ridesId, margot, '**Tuesday Night Ride — Regular Schedule**\nEvery Tuesday, 6:30 PM, same meeting spot. 20-25 miles, chill pace, lights required (it\'ll be dark by the time we\'re done). This is the social ride — we talk the whole time.');
  const r12 = msg(ridesId, felix, 'Tuesday crew checking in. I\'ll be there unless the lightning forecast gets worse.');
  const r13 = msg(ridesId, suki, 'I have a spare front light if anyone needs to borrow one. It\'s not great but it\'s better than nothing.');
  const r14 = msg(ridesId, dana, 'Can I join Tuesday even though I\'m slow? I don\'t want to hold everyone up.');
  const r15 = msg(ridesId, margot, 'Dana, I promise you are not the slowest person on the Tuesday ride. That honor belongs to Felix when he\'s "warming up."');
  const r16 = msg(ridesId, felix, 'I feel attacked but it\'s accurate.');

  await knex('messages').insert([r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13, r14, r15, r16]);

  // --- #routes ---
  const rt1 = msg(routesId, bingo, 'Pinning the standard club routes here for reference:\n\n**Lake Loop** — 35 mi, 1,200 ft elevation. The Saturday classic.\n**River Out-and-Back** — 25 mi, 400 ft. Flat and fast.\n**Hills of Pain** — 42 mi, 3,800 ft. You have been warned.');
  const rt2 = msg(routesId, lena, 'I just mapped a new one: **Orchard Run** — 28 miles through the farm roads east of town. Almost zero traffic, beautiful this time of year. Mostly flat with one solid climb at mile 18.');
  const rt3 = msg(routesId, hank, 'That sounds great. Any gravel sections or all paved?');
  const rt4 = msg(routesId, lena, 'About 3 miles of hard-packed gravel near the orchard. 28c tires would be fine.');
  const rt5 = msg(routesId, noor, 'I love that area. There\'s a farm stand at mile 22 that sells the best apple cider. Just saying.');
  const rt6 = msg(routesId, tj, 'Here\'s the GPX for the **Rail Trail Gravel** route I mentioned in #rides. Total distance ~48 miles. Noor helped me route around the washout. There\'s a good lunch stop in the campground at the halfway point.');
  const rt7 = msg(routesId, owen, 'Has anyone ridden the Hills of Pain recently? I heard they resurfaced the descent on Ridge Rd.');
  const rt8 = msg(routesId, bingo, 'Yeah, it\'s buttery smooth now. Best descent in the county. Just watch for the cattle gate at the bottom.');
  const rt9 = msg(routesId, reese, 'I\'ve been commuting a route that could make a nice easy group ride — 15 miles through the greenway. Mostly separated bike path. Good for a recovery day or new riders.');
  const rt10 = msg(routesId, cass, 'That sounds perfect for me right now. Would you mind sharing it?');
  const rt11 = msg(routesId, reese, 'Uploading the GPX now. It\'s called **Greenway Spin**.');

  await knex('messages').insert([rt1, rt2, rt3, rt4, rt5, rt6, rt7, rt8, rt9, rt10, rt11]);

  // --- #new-riders ---
  const n1 = msg(newRidersId, cass, 'Okay dumb question: what do I actually bring on a group ride? I have a water bottle and that\'s it.');
  const n2 = msg(newRidersId, priya, 'Not dumb at all! Essentials:\n- Spare tube\n- Tire levers\n- Mini pump or CO2\n- Phone\n- ID/insurance card\n- Snack for anything over 20 miles\n\nYou don\'t need all of it on day one — someone will have extras. But get a spare tube and tire levers ASAP.');
  const n3 = msg(newRidersId, owen, 'Also: chamois cream. Trust me. Trust. Me.');
  const n4 = msg(newRidersId, cass, 'I don\'t know what chamois cream is but the tone of your message tells me I should Google it immediately.');
  const n5 = msg(newRidersId, dana, 'How do you signal in a group ride? I see people pointing at the ground sometimes.');
  const n6 = msg(newRidersId, bingo, 'Good question:\n- **Point at ground** = pothole/hazard, avoid this spot\n- **Wave behind back** = move over to this side (obstacle ahead)\n- **Fist up** = stopping\n- **Elbow flick** = your turn to pull (take the front of the pace line)\n\nDon\'t stress about memorizing it — you\'ll pick it up naturally.');
  const n7 = msg(newRidersId, hank, 'Coming from mountain biking: is it normal that road bike saddles feel like medieval torture devices?');
  const n8 = msg(newRidersId, margot, 'Yes. Give it two weeks. If it still hurts after that, get a bike fit.');
  const n9 = msg(newRidersId, felix, 'A proper bike fit changed my life. Not exaggerating. Went from hating rides over 30 miles to doing centuries comfortably. Worth every penny.');
  const n10 = msg(newRidersId, noor, 'Also Hank — don\'t wear underwear under cycling shorts. I know it feels wrong. Just trust the process.');
  const n11 = msg(newRidersId, hank, 'This sport is full of things I need to "just trust" apparently.');
  const n12 = msg(newRidersId, reese, 'What\'s a reasonable first goal for someone who can currently ride about 15 miles comfortably?');
  const n13 = msg(newRidersId, priya, 'A metric century (100km / 62 miles) in 3-4 months is very doable. Add about 10% distance per week and take a rest week every 4th week. You\'ll get there.');

  await knex('messages').insert([n1, n2, n3, n4, n5, n6, n7, n8, n9, n10, n11, n12, n13]);

  // --- #wrenching ---
  const w1 = msg(wrenching, hank, 'My rear derailleur is making a clicking sound in the two smallest cogs. Is this a cable tension thing or something worse?');
  const w2 = msg(wrenching, owen, 'Almost certainly cable tension. Turn the barrel adjuster on the rear derailleur counter-clockwise in half-turn increments until it shuts up. If that doesn\'t fix it, your cable might be stretched and need replacement.');
  const w3 = msg(wrenching, hank, 'Half turn fixed it. Owen you\'re a wizard.');
  const w4 = msg(wrenching, felix, 'Anyone have experience with tubeless conversion on older rims? I\'ve got some Mavic Open Pros I want to set up tubeless for gravel but I\'ve heard mixed things.');
  const w5 = msg(wrenching, tj, 'I tried it on similar rims. It works but you\'ll fight it every time you need to reseat a bead. I ended up just running tubes with sealant inside. 90% of the benefit, none of the headache.');
  const w6 = msg(wrenching, noor, 'Seconding TJ. True tubeless rims are worth the upgrade if you ride a lot of gravel. The old-rim-with-tape method is a weekend project that keeps coming back.');
  const w7 = msg(wrenching, suki, 'Quick tip: if your chain is skipping under load, it\'s usually a worn chain that\'s chewed up your cassette. Replace both at the same time or the new chain will skip on the old cassette teeth.');
  const w8 = msg(wrenching, bingo, 'This is why you replace your chain every 2,000 miles. A chain is $20. A cassette is $80. A cassette + chainrings is $200. Ask me how I know.');
  const w9 = msg(wrenching, margot, 'I need to bleed my disc brakes and the thought of it makes me want to sell my bike and take up knitting.');
  const w10 = msg(wrenching, owen, 'Shimano bleed is actually pretty easy if you have the funnel kit. I can walk you through it at the next meetup if you want to bring your bike.');
  const w11 = msg(wrenching, margot, 'You\'re an angel. I\'ll bring it Thursday.');
  const w12 = msg(wrenching, dana, 'Is there a good YouTube channel for basic bike maintenance? I want to learn to do my own stuff but I\'m starting from zero.');
  const w13 = msg(wrenching, priya, 'Park Tool\'s YouTube channel. Start with "How to Fix a Flat Tire" and work your way up. Calvin is the Bob Ross of bike repair.');

  await knex('messages').insert([w1, w2, w3, w4, w5, w6, w7, w8, w9, w10, w11, w12, w13]);

  // --- #off-topic ---
  const o1 = msg(offTopicId, tj, 'Unpopular opinion: oat milk is better than regular milk in every context');
  const o2 = msg(offTopicId, margot, 'That\'s not unpopular, that\'s just correct.');
  const o3 = msg(offTopicId, hank, 'This is a cycling space, not a dairy discourse space.');
  const o4 = msg(offTopicId, suki, 'The channel is literally called off-topic, Hank.');
  const o5 = msg(offTopicId, felix, 'Anyone watching the Tour this year? Stage 9 was unreal.');
  const o6 = msg(offTopicId, noor, 'I screamed at my TV. That sprint finish.');
  const o7 = msg(offTopicId, owen, 'I fell asleep during the flat stages and woke up to absolute chaos on the mountain stage. As is tradition.');
  const o8 = msg(offTopicId, cass, 'Does anyone else\'s non-cycling friends think they\'re insane? I told my coworker I rode 50 miles on Saturday and she looked at me like I confessed to a crime.');
  const o9 = msg(offTopicId, reese, 'My family has stopped asking how my weekend was because the answer is always "I rode my bike" with varying distances.');
  const o10 = msg(offTopicId, dana, 'I accidentally said "on your left" to someone in the grocery store aisle yesterday. I think I\'ve been riding too much.');
  const o11 = msg(offTopicId, bingo, 'You can never ride too much. That\'s the beauty of the sport.');
  const o12 = msg(offTopicId, lena, 'My dog now associates me putting on lycra with being abandoned for 3 hours. The guilt is real.');
  const o13 = msg(offTopicId, priya, 'Get a bike trailer for the dog. Problem solved. Dog ride. Best ride.');
  const o14 = msg(offTopicId, lena, 'She\'s a Great Dane.');
  const o15 = msg(offTopicId, priya, 'Get a bigger trailer.');

  await knex('messages').insert([o1, o2, o3, o4, o5, o6, o7, o8, o9, o10, o11, o12, o13, o14, o15]);

  // --- #post-ride-food ---
  const f1 = msg(foodId, suki, 'Fifth Press has a new breakfast burrito and it\'s life-changing. Scrambled eggs, black beans, avocado, hot sauce. I almost cried.');
  const f2 = msg(foodId, priya, 'I had three of them last Saturday. No regrets.');
  const f3 = msg(foodId, owen, 'Hot take: the best post-ride food is a gas station hot dog. When you\'re 60 miles deep and bonking, nothing hits harder.');
  const f4 = msg(foodId, margot, 'Owen this is disgusting and also completely true.');
  const f5 = msg(foodId, felix, 'I keep a ranking of every taco truck within 2 miles of a trailhead. I will share this sacred document with the club if there is interest.');
  const f6 = msg(foodId, tj, 'There is interest. Post the document Felix.');
  const f7 = msg(foodId, hank, 'There is EXTREME interest.');
  const f8 = msg(foodId, felix, 'Okay the **Felix Taco Index** is as follows:\n\n1. **El Rey** (by the Riverside trailhead) — al pastor is top tier\n2. **Taqueria Lupita** (near the greenway entrance) — massive burritos, cash only\n3. **Don Pedro\'s** (at the farmers market, Saturdays only) — birria tacos, get there early\n4. **The truck with no name** (parking lot on 4th & Oak) — I don\'t know what\'s in the green salsa but I would fight someone for it');
  const f9 = msg(foodId, noor, 'The truck with no name! I know exactly which one you mean. That green salsa haunts my dreams.');
  const f10 = msg(foodId, bingo, 'Pinning this. The Felix Taco Index is now official club documentation.');
  const f11 = msg(foodId, cass, 'What do people eat DURING rides? I bonked hard at mile 25 on Saturday and it was not fun.');
  const f12 = msg(foodId, priya, 'Gels, bars, bananas, rice cakes, gummy bears. Eat early and often — if you wait until you\'re hungry it\'s too late. I eat something every 45 minutes on long rides.');
  const f13 = msg(foodId, dana, 'Gummy bears are an elite cycling fuel and I will not hear otherwise.');

  await knex('messages').insert([f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11, f12, f13]);

  // --- #photos ---
  const p1 = msg(photosId, lena, 'Sunrise from the top of Ridge Rd this morning. Worth the 5am alarm.');
  const p2 = msg(photosId, tj, 'The rail trail was absolutely gorgeous today. Fall colors are peaking.');
  const p3 = msg(photosId, noor, 'Spotted a fox on the greenway during this morning\'s ride. It just sat there watching me like I was the weird one.');
  const p4 = msg(photosId, cass, 'My first group ride! Saturday crew representing. Thanks @priya for not letting me get lost.');
  const p5 = msg(photosId, priya, 'You crushed it Cass! That climb at mile 20 and you didn\'t even slow down.');
  const p6 = msg(photosId, suki, 'Flat tire selfie from the side of Route 9. Living the dream.');
  const p7 = msg(photosId, owen, 'Me, fixing Suki\'s flat tire, looking like a hero (she took the photo from a very flattering angle).');
  const p8 = msg(photosId, felix, 'Post-ride taco pic from El Rey. The al pastor was particularly photogenic today.');
  const p9 = msg(photosId, margot, 'My bike leaning against a barn. I don\'t know why we all take the same photo but here we are.');
  const p10 = msg(photosId, hank, 'First road ride! 30 miles! My legs are jelly but my heart is full. Also I fell over at a stoplight like Felix warned me about.');
  const p11 = msg(photosId, bingo, 'The whole crew at Fifth Press after the Saturday ride. We really need a bigger table.');
  const p12 = msg(photosId, reese, 'Commute home tonight was something else. Golden hour over the river. Sometimes I take the long way home on purpose.');

  await knex('messages').insert([p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12]);

  console.log('Demo data seeded successfully');
  console.log(`  12 fake users added to space ${SPACE_ID}`);
  console.log(`  3 categories, 8 channels created`);
  console.log(`  ~100 messages across all channels`);
}
