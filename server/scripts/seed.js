// Fills the local database with SAMPLE data so the app has something to show.
// It only touches the sample accounts below (example.com addresses) and their groups; other data is left alone.
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { config } from '../src/config.js';
import { splitEqually } from '../src/lib/money.js';
import { Expense } from '../src/models/Expense.js';
import { Group } from '../src/models/Group.js';
import { Settlement } from '../src/models/Settlement.js';
import { User } from '../src/models/User.js';

const SAMPLE_PASSWORD = 'fairshare-demo';
const SAMPLE_PEOPLE = [
  { name: 'Asha', email: 'asha@example.com' },
  { name: 'Ravi', email: 'ravi@example.com' },
  { name: 'Meera', email: 'meera@example.com' },
];

if (config.isProduction) {
  console.error('Refusing to add sample data to a production database.');
  process.exit(1);
}

await mongoose.connect(config.mongoUri);

// Start from a clean slate for the sample accounts only.
const oldSampleUsers = await User.find({ email: { $in: SAMPLE_PEOPLE.map((person) => person.email) } });
const oldGroups = await Group.find({ createdBy: { $in: oldSampleUsers.map((user) => user._id) } });
const oldGroupIds = oldGroups.map((group) => group._id);
await Expense.deleteMany({ group: { $in: oldGroupIds } });
await Settlement.deleteMany({ group: { $in: oldGroupIds } });
await Group.deleteMany({ _id: { $in: oldGroupIds } });
await User.deleteMany({ _id: { $in: oldSampleUsers.map((user) => user._id) } });

const passwordHash = await bcrypt.hash(SAMPLE_PASSWORD, 10);
const [asha, ravi, meera] = await User.create(SAMPLE_PEOPLE.map((person) => ({ ...person, passwordHash })));
const everyone = [asha, ravi, meera].map((user) => user._id);

const flat = await Group.create({ name: 'Flat 4B (sample data)', members: everyone, createdBy: asha._id });

function equalExpense(description, rupees, payer, day) {
  const amount = rupees * 100;
  return {
    group: flat._id,
    description,
    amount,
    paidBy: payer._id,
    splitType: 'equal',
    shares: splitEqually(amount, everyone),
    spentAt: new Date(`2026-10-${day}`),
    createdBy: payer._id,
  };
}

await Expense.create([
  equalExpense('October rent', 30000, asha, '01'),
  equalExpense('Groceries', 2450, ravi, '05'),
  equalExpense('Wi-Fi bill', 999, meera, '07'),
  {
    group: flat._id,
    description: 'Electricity (by room meter)',
    amount: 180000,
    paidBy: asha._id,
    splitType: 'exact',
    shares: [
      { user: asha._id, amount: 50000 },
      { user: ravi._id, amount: 70000 },
      { user: meera._id, amount: 60000 },
    ],
    spentAt: new Date('2026-10-10'),
    createdBy: asha._id,
  },
]);

await Settlement.create({
  group: flat._id,
  from: ravi._id,
  to: asha._id,
  amount: 500000,
  settledAt: new Date('2026-10-12'),
  createdBy: ravi._id,
});

console.log('Sample data added (all of it is made up):');
for (const person of SAMPLE_PEOPLE) {
  console.log(`  ${person.name.padEnd(6)} ${person.email}   password: ${SAMPLE_PASSWORD}`);
}

await mongoose.disconnect();
