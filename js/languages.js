const languages = {
  English: {
    start: [
      /^You cast your line.+\.$/,
      /^You cast your line.+undiscovered fishing hole\.$/i
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
    ],
    loot: [
      /^You land (an?|\d) .(.+) measuring ([0-9.]+) (\w+)!$/
    ],
    exit: [
      /^You put away your/,
      /^You reel in your line/,
      /^The fish sense something amiss/
    ]
  },
  French: {
    show: [],
    stat: [],
    spot: [],
    stop: [],
    loot: [],
    hide: []
  },
  German: {
    show: [],
    stat: [],
    spot: [],
    stop: [],
    loot: [],
    hide: []
  },
  Japanese: {
    show: [],
    stat: [],
    spot: [],
    stop: [],
    loot: [],
    hide: []
  }
}