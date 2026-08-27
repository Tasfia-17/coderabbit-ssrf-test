// Simple Express server
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Intentional lint issue for CodeRabbit to find
var unusedVar = 'test';
console.log('Starting server...');

app.listen(3000);
