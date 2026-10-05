// Read from stdin, never argv. --owner-pin permits exactly six digits for Owner only.
const crypto = require('node:crypto');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; if (input.length > 2048) process.exit(1); });
process.stdin.on('end', () => {
  const password = input.replace(/\r?\n$/, '');
  if (process.argv.includes('--owner-pin') ? !/^\d{6}$/.test(password) : password.length < 12 || password.length > 1024) { console.error('Use six digits with --owner-pin, or a unique 12-1024 character Master password.'); process.exitCode = 1; return; }
  const salt = crypto.randomBytes(16);
  crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, key) => {
    if (error) { process.exitCode = 1; return; }
    process.stdout.write('scrypt$16384$8$1$' + salt.toString('hex') + '$' + key.toString('hex') + '\n');
  });
});
