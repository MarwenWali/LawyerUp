const { sequelize, User } = require('./database');

async function seedDatabase() {
    try {
        await sequelize.sync();

        // Check if we already have lawyers
        const existingLawyers = await User.count({ where: { role: 'lawyer', status: 'approved' } });

        if (existingLawyers === 0) {
            console.log('No approved lawyers found. Adding sample lawyers...');

            // Create sample approved lawyers
            const sampleLawyers = [
                {
                    name: 'Mehdi Ben Ali',
                    email: 'mehdi.benali@example.com',
                    phone: '+216 20 000 000',
                    role: 'lawyer',
                    status: 'approved',
                    specialization: 'Family Law',
                    experience: 10,
                    fees: 50,
                    rating: 4.5,
                    bio: 'Experienced family lawyer specializing in divorce and custody cases.',
                    approvalDate: new Date()
                },
                {
                    name: 'Amina Trabelsi',
                    email: 'amina.trabelsi@example.com',
                    phone: '+216 21 111 111',
                    role: 'lawyer',
                    status: 'approved',
                    specialization: 'Criminal Law',
                    experience: 12,
                    fees: 80,
                    rating: 4.8,
                    bio: 'Criminal defense specialist with extensive courtroom experience.',
                    approvalDate: new Date()
                },
                {
                    name: 'Karim Jarray',
                    email: 'karim.jarray@example.com',
                    phone: '+216 22 222 222',
                    role: 'lawyer',
                    status: 'approved',
                    specialization: 'Corporate Law',
                    experience: 15,
                    fees: 120,
                    rating: 4.2,
                    bio: 'Expert in business law and corporate transactions.',
                    approvalDate: new Date()
                }
            ];

            for (const lawyer of sampleLawyers) {
                await User.create(lawyer);
            }

            console.log('✅ Sample lawyers added successfully!');
        } else {
            console.log(`✅ Database already has ${existingLawyers} approved lawyer(s).`);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase();
