const mongoose = require('mongoose');

const DB_URI = process.env.DB_URI;

if (!DB_URI) {
    console.error('Error: DB_URI is not defined in environment variables.');
    process.exit(1);
}

(async () => {
    try {
        await mongoose.connect(DB_URI);
        console.log('✅ Connected to the database');
        console.log(`🔗 Database URI: ${ DB_URI }`);
    } catch (err) {
        console.error('❌ Failed to connect to the database');
        console.error(err);
        process.exit(1);
    }
})();
