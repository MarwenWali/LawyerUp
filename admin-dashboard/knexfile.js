require('dotenv').config();

module.exports = {
    development: {
        client: 'pg',
        connection: process.env.DATABASE_URL || 'postgresql://postgres:password@127.0.0.1:5432/lawyerup',
        migrations: {
            directory: __dirname + '/migrations'
        }
    }
};
