import pkg from 'pg';
const { Client } = pkg;

async function test() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'lawyerup',
    user: 'postgres',
    password: 'Marwen661',
  });

  try {
    console.log('Connecting to local DB...');
    await client.connect();
    console.log('SUCCESS: Connected to DB');
    const res = await client.query('SELECT current_database()');
    console.log('Database:', res.rows[0].current_database);
    await client.end();
  } catch (err) {
    console.error('FAILED: Could not connect to local DB');
    console.error(err.message);
    process.exit(1);
  }
}

test();
