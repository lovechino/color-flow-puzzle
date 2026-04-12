import { UniquenessValidator } from './src/generator/steps/ValidateUnique';
import { Color } from './src/types';

async function testPerformance() {
  const validator = new UniquenessValidator();
  const pairs = [
    { color: 'red' as Color, start: [0, 0] as [number, number], end: [4, 0] as [number, number] },
    { color: 'blue' as Color, start: [0, 4] as [number, number], end: [4, 4] as [number, number] },
    { color: 'green' as Color, start: [2, 0] as [number, number], end: [2, 4] as [number, number] },
  ];

  console.log("Testing UniquenessValidator performance on 5x5...");
  const start = Date.now();
  const count = validator.countSolutions({ gridSize: 5, pairs }, 2);
  const elapsed = Date.now() - start;
  console.log(`Count: ${count}, Time: ${elapsed}ms`);
}

testPerformance();
