const languages = {
  English: {
    show: [
      /^You cast your line.+\.$/,
      /^You cast your line.+undiscovered fishing hole\.$/i
    ],
    stat: [
      /^You (gain|lose) the effect of .{2}(.+)\.$/,
      /gain/
    ],
    spot: [
      /^Data on .+ is added to your fishing log\.$/
    ],
    stop: [
      /^Something bites/,
      /^The fish gets away/,
      /^Nothing bites/,
      /^You reel in your line/,
    ],
    loot: [
      /^You land (an?|\d) .(.+) measuring ([0-9.]+) (\w+)!$/
    ],
    hide: [
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