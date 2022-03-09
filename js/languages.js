const regex = {
  English: {
    start: [
      /^You (?:re)?cast your line.+\.$/,
      /^You cast your line.+undiscovered fishing hole\.$/i,
      /^You recast your line with the fish still hooked\.$/
    ],
    buff: [
      /^You gain the effect of .{2}(.+)\.$/,
      /^You lose the effect of .{2}(.+)\.$/,
      /\bchum\b/i
    ],
    spot: [
      /^Data on .+ is added to your fishing log\.$/
    ],
    pause: [
      /^Something bites/,
      /^The fish gets away/,
      /^Nothing bites/,
      /^You reel in your line/,
      /^You lose your bait/
    ],
    loot: [
      /^You land (an? |\d )?.(.+) measuring ([0-9.]+) (\w+)!$/
    ],
    exit: [
      /^You put away your/,
      /^You reel in your line/,
      /^The fish sense something amiss/
    ]
  },
  French: {
    start: [],
    buff: [],
    spot: [],
    pause: [],
    loot: [],
    exit: []
  },
  German: {
    start: [],
    buff: [],
    spot: [],
    pause: [],
    loot: [],
    exit: []
  },
  Japanese: {
    start: [],
    buff: [],
    spot: [],
    pause: [],
    loot: [],
    exit: []
  }
}