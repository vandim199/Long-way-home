// node tools/sim.js [runs]: plays the heuristic bot through many runs and prints the headline numbers.
const { runMany, summary } = require('./bot.js');
const N = +process.argv[2] || 2000;
const st = runMany(N);
console.log(`runs ${N}`);
console.table(summary(st));
console.log('season reached', st.reached);
console.log('reasons', st.why);
