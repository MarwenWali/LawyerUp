const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../admin-dashboard/.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seedDatabase() {
  try {
    const existing = await pool.query(
      `SELECT COUNT(*) FROM lawyers WHERE status = $1`,
      ['approved']
    );

    const count = Number(existing.rows[0].count);
    if (count === 0) {
      console.log('No approved lawyers found. Adding sample lawyers...');

      const sampleLawyers = [
        {
          name: 'Mehdi Ben Ali',
          email: 'mehdi.benali@example.com',
          phone: '+216 20 000 000',
          specialization: ['Family Law'],
          experience_years: 10,
          fees: 50,
          rating: 4.5,
          bio: 'Experienced family lawyer specializing in divorce and custody cases.'
        },
        {
          name: 'Amina Trabelsi',
          email: 'amina.trabelsi@example.com',
          phone: '+216 21 111 111',
          specialization: ['Criminal Law'],
          experience_years: 12,
          fees: 80,
          rating: 4.8,
          bio: 'Criminal defense specialist with extensive courtroom experience.'
        },
        {
          name: 'Karim Jarray',
          email: 'karim.jarray@example.com',
          phone: '+216 22 222 222',
          specialization: ['Corporate Law'],
          experience_years: 15,
          fees: 120,
          rating: 4.2,
          bio: 'Expert in business law and corporate transactions.'
        }
      ];

      for (const lawyer of sampleLawyers) {
        await pool.query(
          `INSERT INTO lawyers
            (name, email, password_hash, phone, specialization, experience_years, status, fees, rating, bio, created_at, approved_at)
           VALUES
            ($1, $2, $3, $4, $5, $6, 'approved', $7, $8, $9, now(), now())`,
          [
            lawyer.name,
            lawyer.email,
            'placeholder',
            lawyer.phone,
            lawyer.specialization,
            lawyer.experience_years,
            lawyer.fees,
            lawyer.rating,
            lawyer.bio
          ]
        );
      }

      console.log('Sample lawyers added successfully.');
    } else {
      console.log(`Database already has ${count} approved lawyer(s).`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
