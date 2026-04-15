import { BacktrackingSolver } from '../src/generator/steps/BuildSolution';

const s = new BacktrackingSolver();

// Test 1: Simple 3x3
console.log('Testing 3x3...');
const sol1 = s.solve(3, [
  { color: 'red', start: [0,0], end: [2,0] },
  { color: 'blue', start: [0,1], end: [2,1] },
  { color: 'green', start: [0,2], end: [2,2] },
], []);
console.log('3x3:', sol1 ? 'SOLVED' : 'FAILED');

// Test 2: 8x8 simple vertical columns
console.log('Testing 8x8...');
const sol2 = s.solve(8, [
  { color: 'red', start: [0,0], end: [7,0] },
  { color: 'blue', start: [0,1], end: [7,1] },
  { color: 'green', start: [0,2], end: [7,2] },
  { color: 'yellow', start: [0,3], end: [7,3] },
  { color: 'orange', start: [0,4], end: [7,4] },
  { color: 'purple', start: [0,5], end: [7,5] },
  { color: 'cyan', start: [0,6], end: [7,6] },
  { color: 'pink', start: [0,7], end: [7,7] },
], []);
console.log('8x8:', sol2 ? 'SOLVED (' + sol2.length + ' paths)' : 'FAILED');
