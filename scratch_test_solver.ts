import { BacktrackingSolver } from './src/generator/steps/BuildSolution';
import { Color } from './src/types';

async function runTests() {
  console.log('🚀 Starting Solver Regression Tests...');

  // Test 1: Root bug - two valid components
  try {
    const solver = new BacktrackingSolver();
    const pairs = [
      { color: 'red' as Color, start: [0, 0] as [number, number], end: [5, 0] as [number, number] },
      { color: 'blue' as Color, start: [0, 3] as [number, number], end: [5, 3] as [number, number] }
    ];
    // Signature: solve(size, pairs, walls)
    const result = solver.solve(6, pairs, []);
    console.log('Test 1 (Root Bug):', result ? '✅ PASS' : '❌ FAIL (Should have found solution)');
  } catch (e) {
    console.log('Test 1 (Root Bug): ❌ ERROR', e);
  }

  // Test 2: Isolated cell
  try {
    const solver = new BacktrackingSolver();
    const pairs = [
      { color: 'red' as Color, start: [0, 0] as [number, number], end: [5, 5] as [number, number] }
    ];
    const walls: [number, number][] = [[1, 2], [2, 2]];
    const start = Date.now();
    const result = solver.solve(6, pairs, walls);
    const elapsed = Date.now() - start;
    console.log(`Test 2 (Isolated Cell): ${result === null ? '✅ PASS' : '❌ FAIL (Should be null)'} (${elapsed}ms)`);
  } catch (e) {
    console.log('Test 2 (Isolated Cell): ❌ ERROR', e);
  }

  // Test 3: Color split across components
  try {
    const solver = new BacktrackingSolver();
    const pairs = [
      { color: 'red' as Color, start: [0, 0] as [number, number], end: [0, 5] as [number, number] }
    ];
    const walls: [number, number][] = [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5]];
    const result = solver.solve(6, pairs, walls);
    console.log('Test 3 (Split Color):', result === null ? '✅ PASS' : '❌ FAIL (Should be null)');
  } catch (e) {
    console.log('Test 3 (Split Color): ❌ ERROR', e);
  }

  // Test 4: 3x3 full fill test
  try {
    const solver = new BacktrackingSolver();
    const pairs = [
      { color: 'red' as Color, start: [0, 0] as [number, number], end: [2, 0] as [number, number] },
      { color: 'blue' as Color, start: [0, 1] as [number, number], end: [2, 1] as [number, number] },
      { color: 'green' as Color, start: [0, 2] as [number, number], end: [2, 2] as [number, number] }
    ];
    console.log('Test 4 (3x3 Full Fill): Starting...');
    const start = Date.now();
    const result = solver.solve(3, pairs, []);
    const elapsed = Date.now() - start;
    console.log('Test 4 (3x3 Full Fill):', result ? '✅ PASS' : '❌ FAIL', `(${elapsed}ms)`);
    if (result) console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.log('Test 4 (3x3 Full Fill): ❌ ERROR', e);
  }
}

runTests();
