"use strict";

let zone;

// Prevent overlay from running if no internet available
if (!window.callOverlayHandler) throw new Error("No internet connection available.");

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

  const log = e.line[4]; // Chat log lines

  // Manually show settings
  if (e.line[2] == "0038" && /^\!fbs$/.test(log)) {
    const event = new CustomEvent("manualSettings");
    document.dispatchEvent(event)
  }

  // When to show the overlay
  if (regex[lang].start[0].test(log)) {
    const event = new CustomEvent("startCasting", { detail: { line: log }});
    document.dispatchEvent(event)
  };

  // You gain/lose effects
  for (const [index, rule] of regex[lang].buff.entries()) {
    if (rule.test(log)) {
      const bool = index < 1 ? true : false,
            name = log.match(rule)[1];

      const event = new CustomEvent("statusChange", {
        detail: {
          name: name,
          status: bool
        }
      });
      document.dispatchEvent(event);

      break
    }
  };

  // Discovered a new fishing spot
  if (regex[lang].spot[0].test(log)) {
    const event = new CustomEvent("newSpot", { detail: { line: log }});
    document.dispatchEvent(event)
  };

  // When to pause the timer
  for (const rule of regex[lang].pause) {
    if (rule.test(log)) {
      const event = new CustomEvent("stopCasting");
      document.dispatchEvent(event);
      break
    }
  };

  // You catch a fish
  if (regex[lang].loot[0].test(log)) {
    let total;

    const line = log.match(regex[lang].loot[0]);

    // Check how many fishes at once
    if (/\d/.test(line[1])) {
      total = parseInt(line[1])
    } else {
      total = 1
    }

    const event = new CustomEvent("fishCaught", {
      detail: {
        name: line[2],
        size: parseFloat(line[3]),
        unit: line[4],
        amount: total
      }
    });
    document.dispatchEvent(event)
  };

  // When to hide the overlay
  for (const rule of regex[lang].exit) {
    if (rule.test(log)) {
      const event = new CustomEvent("stopFishing");
      document.dispatchEvent(event);
      break
    }
  }
});

// OverlayPlugin will now start sending events
startOverlayEvents()
