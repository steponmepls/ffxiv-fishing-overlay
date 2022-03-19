"use strict";

(async function() {
  if (!window.callOverlayHandler) {
    console.error("No internet connection available.");
    return
  };

  let lang;
  const overlayUuid = (window.OverlayPluginApi) ? window.OverlayPluginApi.overlayUuid : null;
  await callOverlayHandler({ call: "loadData", key: overlayUuid})
  .then(obj => lang = (obj.data && obj.data.lang) ? obj.data.lang.name : "English");

  // Report when you change character
  addOverlayListener("ChangePrimaryPlayer", (e) => {
    const event = new CustomEvent("changedCharacter", {
      detail: { name: e.charName, id: e.charID }
    });
    document.dispatchEvent(event)
  });

  // Update current zone ID every time you change zone in-game
  addOverlayListener("ChangeZone", (e) => {
    const event = new CustomEvent("changedZone", {
      detail: { zone: e.zoneID }
    });
    document.dispatchEvent(event)
  });

  // Generate and dispatch events when new log lines are parsed
  addOverlayListener("LogLine", (e) => {
    // Ignore new line if internal ACT line or a message from a player
    if (e.line[0] !== "00" && e.line[3] !== "")
      return

    const log = e.line[4]; // Chat log lines

    // Manually show settings
    if (e.line[2] == "0038" && /^\!fsettings$/.test(log)) {
      const event = new CustomEvent("showSettings");
      document.dispatchEvent(event)
    }

    // When to show the overlay
    if (regex[lang].start[0].test(log)) {
      const event = new CustomEvent("startCasting", { 
        detail: { 
          line: log,
          mooch: typeof log.match(regex[lang].start[0])[1] !== "undefined"
        }
      });
      document.dispatchEvent(event)
    };

    // You gain/lose effects
    for (const [index, rule] of regex[lang].buff.entries()) {
      if (rule.test(log)) {
        const bool = index < 1 ? true : false,
              name = log.match(rule)[1];

        const event = new CustomEvent("statusChange", {
          detail: { name: name, status: bool }
        });
        document.dispatchEvent(event);
        break
      }
    };

    // When to pause the timer
    for (const rule of regex[lang].pause) {
      if (rule.test(log)) {
        const event = new CustomEvent("stopCasting");
        document.dispatchEvent(event);
        break
      }
    };

    // Discovered a new fishing spot
    if (regex[lang].spot[0].test(log)) {
      const event = new CustomEvent("newSpot", { detail: { line: log }});
      document.dispatchEvent(event)
    };

    // You catch a fish
    if (regex[lang].loot[0].test(log)) {
      const line = log.match(regex[lang].loot[0]),
            total = (/\d/.test(line[1])) ? parseInt(line[1]) : 1;

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
  })
})()