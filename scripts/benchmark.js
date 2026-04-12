// Simple benchmark - just count iterations
let count = 0;
const start = Date.now();

while (Date.now() - start < 10000) { // 10 seconds
  count++;
  if (count % 1000000 === 0) {
    process.stderr.write(`\rIterations: ${(count/1000000).toFixed(1)}M`);
  }
}

console.error(`\nCompleted ${count} iterations in 10 seconds`);
console.error(`Rate: ${(count / 10000).toFixed(0)}K iterations/second`);
