const mongoose = require('mongoose');

DB_URI = process.env.DB_URI;

mongoose.connect(DB_URI).then(() => {
    console.log('Connected to the database');
    console.log(`Database URI: ${ DB_URI }`);
}).catch((err) => {
    console.log('Failed to connect to the database');
    console.log(err);
    process.exit(1);
})