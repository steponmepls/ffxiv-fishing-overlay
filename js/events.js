"use strict";

let lang;

// Get language from ACT and use "English" as fallback
callOverlayHandler({ call: 'getLanguage' })
.then(res => lang = ("language" in res) ? res.language : "English");

// Report when you change character
addOverlayListener("ChangePrimaryPlayer", (e) => {
  const event = new CustomEvent("changedCharacter", {
    detail: {
      id: e.charID,
      name: e.charName
    }
  });
  document.dispatchEvent(event)
});

// Update current zone ID every time you change zone in-game
addOverlayListener("ChangeZone", (e) => { zone = e.zoneID });

// Generate and dispatch events when new log lines are parsed
addOverlayListener("LogLine", (e) => {
  // Ignore new line if internal ACT line or a message from a player
  if (e.line[0] !== "00" && e.line[3] !== "")
    return

  const log = e.line[4], // Chat log lines
    regex = languages[lang]; // Filter events to current language

  // When to show the overlay
  if (regex.show[0].test(log)) {
    const event = new CustomEvent("startCasting", { detail: { line: log }});
    document.dispatchEvent(event)
  };

  // Used fishing action (buff)
  if (regex.stat[0].test(log)) {
    let bool;

    const state = log.match(regex.stat[0])[1], // gain|lose
          name = log.match(regex.stat[0])[2]; // name of buff|debuff

    // Match buff regex rule with state and return a boolean
    // A bit redundant but I would rather store state as a bool
    bool = regex.stat[1].test(state);

    const event = new CustomEvent("newStatus", {
      detail: {
        name: name,
        status: bool
      }
    });
    document.dispatchEvent(event)
  };

  // Discovered a new fishing spot
  if (regex.spot[0].test(log)) {
    const event = new CustomEvent("newSpot", { detail: { line: log }});
    document.dispatchEvent(event)
  };

  // When to pause the timer
  for (const rule of regex.stop) {
    if (rule.test(log)) {
      const event = new CustomEvent("stopCasting");
      document.dispatchEvent(event);
      break
    }
  };

  // You catch a fish
  if (regex.loot[0].test(log)) {
    let total;

    const line = log.match(regex.loot[0]),
          elapsed = parseFloat(timer.innerText);

    // Check how many fishes at once
    if (/\d/.test(line[1])) {
      total = parseInt(line[1])
    } else {
      total = 1
    }

    const event = new CustomEvent("fishCaught", {
      detail: {
        name: line[2],
        time: elapsed,
        size: parseFloat(line[3]),
        unit: line[4],
        amount: total,
        spotId: spot
      }
    });
    document.dispatchEvent(event)
  };

  // When to hide the overlay
  for (const rule of regex.hide) {
    if (rule.test(log)) {
      const event = new CustomEvent("stopFishing");
      document.dispatchEvent(event);
      break
    }
  }
});

// OverlayPlugin will now start sending events
startOverlayEvents()
