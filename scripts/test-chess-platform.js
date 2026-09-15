/* Minimal chess regression suite. */
'use strict';
const assert = require('assert');
const E = require('../assets/chess-engine.js');
function legal(fen, uci){ return !!E.findMove(E.create(fen),uci); }
assert(legal(E.START_FEN,'e2e4'));
assert(legal(E.START_FEN,'g1f3'));
assert(!legal(E.START_FEN,'e2e5'));
assert(legal('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1','e1g1'));
assert(!legal('4k3/8/8/8/8/8/8/R3K3 w KQ - 0 1','e1g1'));
assert(legal('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1','e4d5'));
assert(legal('7k/P7/8/8/8/8/8/4K3 w - - 0 1','a7a8q'));
assert(legal('6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1','e1e8'));
console.log('SkySchool chess regression checks passed');
