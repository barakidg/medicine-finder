import bcrypt from 'bcryptjs';

// Generate hash for password 'admin'
const password = 'admin';
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);

console.log('Password:', password);
console.log('Hash:', hash);
