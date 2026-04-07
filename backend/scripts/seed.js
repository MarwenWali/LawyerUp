import bcrypt from 'bcryptjs';
import pool from '../config/database.js';

const DEMO_PASSWORD = 'password123';

async function seed() {
  try {
    console.log('Seeding database...');

    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);

    await pool.query(
      `INSERT INTO users (email, password, full_name, role, is_verified, status)
       VALUES ('admin@lawyerup.tn', $1, 'System Admin', 'admin', true, 'active')
       ON CONFLICT (email) DO NOTHING`,
      [hashedPassword]
    );
    console.log('Admin user ready (admin@lawyerup.tn / password123)');

    await pool.query(
      `INSERT INTO users (email, password, full_name, phone_number, role, is_verified, status)
       VALUES
         ('user@demo.com', $1, 'Ahmed Ben Ali', '+21698765432', 'user', true, 'active'),
         ('user2@demo.com', $1, 'Fatima Mansour', '+21691234567', 'user', true, 'active')
       ON CONFLICT (email) DO NOTHING`,
      [hashedPassword]
    );

    const userResult = await pool.query(
      `SELECT id FROM users WHERE email = ANY($1) ORDER BY email ASC`,
      [['user@demo.com', 'user2@demo.com']]
    );
    if (userResult.rowCount === 0) {
      throw new Error('No demo users found after user seeding');
    }
    console.log(`Demo users ready (${userResult.rowCount})`);

    await pool.query(
      `INSERT INTO users (email, password, full_name, phone_number, role, is_verified, status)
       VALUES
         ('gharbi@lawyer.tn', $1, 'Gharbi Mohamed', '+21670123456', 'lawyer', true, 'active'),
         ('ben.salem@lawyer.tn', $1, 'Ben Salem Anis', '+21671234567', 'lawyer', true, 'active'),
         ('trabelsi@lawyer.tn', $1, 'Trabelsi Sana', '+21672345678', 'lawyer', true, 'active'),
         ('kammoun@lawyer.tn', $1, 'Kammoun Bilel', '+21673456789', 'lawyer', true, 'active'),
         ('jebali@lawyer.tn', $1, 'Jebali Amira', '+21674567890', 'lawyer', true, 'active')
       ON CONFLICT (email) DO NOTHING`,
      [hashedPassword]
    );

    const lawyerResult = await pool.query(
      `SELECT id, email FROM users WHERE email = ANY($1) ORDER BY email ASC`,
      [['gharbi@lawyer.tn', 'ben.salem@lawyer.tn', 'trabelsi@lawyer.tn', 'kammoun@lawyer.tn', 'jebali@lawyer.tn']]
    );

    if (lawyerResult.rowCount === 0) {
      throw new Error('No demo lawyers found after lawyer seeding');
    }

    console.log(`Demo lawyers ready (${lawyerResult.rowCount})`);

    const lawyers = lawyerResult.rows;

    const profileTemplates = [
      {
        specialization: 'Family',
        bio: 'Experienced family law attorney with over 15 years of practice in Tunisia.',
        experienceYears: 15,
        rating: 4.8,
        casesHandled: 124,
        isAvailable: true,
        consultationFee: 150.0,
      },
      {
        specialization: 'Commercial',
        bio: 'Specialist in commercial and business law, helping companies navigate legal complexities.',
        experienceYears: 12,
        rating: 4.9,
        casesHandled: 98,
        isAvailable: true,
        consultationFee: 200.0,
      },
      {
        specialization: 'Property',
        bio: 'Real estate and property law expert with extensive experience in Tunisian property disputes.',
        experienceYears: 18,
        rating: 4.7,
        casesHandled: 156,
        isAvailable: false,
        consultationFee: 175.0,
      },
      {
        specialization: 'Criminal',
        bio: 'Criminal defense attorney dedicated to protecting client rights in the Tunisian justice system.',
        experienceYears: 10,
        rating: 4.6,
        casesHandled: 87,
        isAvailable: true,
        consultationFee: 180.0,
      },
      {
        specialization: 'Labor',
        bio: 'Labor law specialist focusing on employee rights and workplace disputes.',
        experienceYears: 8,
        rating: 4.5,
        casesHandled: 65,
        isAvailable: true,
        consultationFee: 140.0,
      },
    ];

    for (let i = 0; i < lawyers.length; i += 1) {
      const profile = profileTemplates[i % profileTemplates.length];

      await pool.query(
        `INSERT INTO lawyer_profiles (
          user_id, specialization, bio, experience_years,
          rating, cases_handled, is_available, consultation_fee
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (user_id) DO NOTHING`,
        [
          lawyers[i].id,
          profile.specialization,
          profile.bio,
          profile.experienceYears,
          profile.rating,
          profile.casesHandled,
          profile.isAvailable,
          profile.consultationFee,
        ]
      );
    }

    console.log(`Lawyer profiles ensured (${lawyers.length})`);

    if (lawyers.length >= 2) {
      const userId = userResult.rows[0].id;
      const caseResult = await pool.query(
        `INSERT INTO cases (user_id, lawyer_id, subject, description, category, status, priority)
         VALUES
           ($1, $2, 'Property Dispute Resolution', 'Need legal advice regarding boundary dispute with neighbor', 'Property', 'accepted', 'medium'),
           ($1, NULL, 'Divorce Proceedings', 'Seeking consultation for divorce proceedings', 'Family', 'pending', 'high'),
           ($1, $3, 'Business Contract Review', 'Need review of partnership agreement', 'Commercial', 'completed', 'low')
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [userId, lawyers[0].id, lawyers[1].id]
      );
      console.log(`Demo cases ready (${caseResult.rowCount} inserted)`);
    } else {
      console.log('Skipped case seeding: at least 2 lawyers are required');
    }

    console.log('Database seeding completed successfully');
    console.log('Demo accounts:');
    console.log('  User: user@demo.com / password123');
    console.log('  Lawyer: gharbi@lawyer.tn / password123');

    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();