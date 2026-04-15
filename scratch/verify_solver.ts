import { BacktrackingSolver } from '../src/generator/steps/BuildSolution';
import { UniquenessValidator } from '../src/generator/steps/ValidateUnique';
import type { DotPair } from '../src/types';

async function test() {
    const solver = new BacktrackingSolver();
    const validator = new UniquenessValidator();

    // Solvable 5x5 Grid (5 lines)
    const pairs: DotPair[] = [
        { color: 'red',    start: [0, 0], end: [4, 0] },
        { color: 'blue',   start: [0, 1], end: [4, 1] },
        { color: 'green',  start: [0, 2], end: [4, 2] },
        { color: 'yellow', start: [0, 3], end: [4, 3] },
        { color: 'purple', start: [0, 4], end: [4, 4] },
    ];

    console.log("Testing 5x5 solver...");
    const start = Date.now();
    const solution = solver.solve(5, pairs);
    const end = Date.now();

    if (solution) {
        console.log(`Success! Solved in ${end - start}ms`);
        solution.forEach(s => {
            console.log(`${s.color}: ${s.path.length} cells`);
        });

        const count = validator.countSolutions({ gridSize: 5, pairs }, 2);
        console.log(`Uniqueness check: ${count} solutions found`);
    } else {
        console.log("Failed to solve!");
    }
}

test().catch(console.error);
