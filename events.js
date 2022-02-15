let start = 0, newTimer, currentZone = 0, currentSpot;

const overlay = document.getElementById("container");
const timer = document.getElementById("timer");
const events = {
  start: /^You cast your line in (.+)\.$/,
  stop: [
    /^Something bites/,
    /^The fish gets away/,
    /^You lose your/,
    /^Nothing bites/,
    /^You (reel in|put away) your/,
    /^The fish sense something amiss/
  ],
  success: /^You land (?:an?|\d) .(.+) measuring ([0-9.]+) (\w+)!$/,
  exit: [
    /^You (reel in|put away) your/,
    /^The fish sense something amiss/
  ]
};

addOverlayListener("ChangeZone", (e) => {
  const newZone = e.zoneID;
  currentZone = newZone;
  console.log(`Current zone ID: ${currentZone}`)
})

addOverlayListener("LogLine", (e) => {
  const newLine = e.line;
  if (newLine.length > 4 && newLine[0] == "00") { // Only if chat log line
    const chatLog = newLine[4];
    if (events.start.test(chatLog)) {
      currentSpot = chatLog.match(events.start)[1];
      populateEntries(currentSpot);
      overlay.classList.add("show");
      console.debug(`Start the timer now! - Logline: ${chatLog}`);
      timer.innerText = 0.0.toFixed(1);
      start = Date.now();
      newTimer = window.setInterval(updateTimer, 100);
    } else {
      for (const rule of events.stop) {
        if (rule.test(chatLog) && newTimer) {
          console.debug(`Stop the timer now! - Logline: ${chatLog}`);
          clearTimer();
          break // Exit loop
        }
      };
      if (events.success.test(chatLog)) {
        const fish = chatLog.match(events.success);
        const elapsed = timer.innerText;
        console.log (`Fish: ${fish[1]} - Size: ${fish[2]} - Unit: ${fish[3]} - Time: ${elapsed}s`)
      };
      for (const rule of events.exit) {
        if (rule.test(chatLog)) {
          overlay.classList.remove("show");
          timer.innerText = 0.0.toFixed(1);
          // Method source https://stackoverflow.com/a/3955238/16817358
          const fishEntries = document.querySelectorAll("#list > .fish");
          while (fishEntries.firstChild) {
            fishEntries.removeChild(fishEntries.lastChild);
          }
          break
        }
      }
    }
  }
});

function updateTimer() {
  const timer = document.getElementById("timer");
  const raw = (Date.now() - start) / 1000;
  const formatted = raw.toFixed(1);
  timer.innerText = formatted
}

function clearTimer() {
  if (newTimer) {
    window.clearInterval(newTimer);
    newTimer = null;
  }
;}

function populateEntries(spotName) {
  const spots = Object.entries(fishingLog).find(zone => zone[0] == parseInt(currentZone));
  for (const spot of spots[1]) { // Directly iterate through nested array of spots
    if (spot.name == spotName) {
      const fishEntries = document.getElementByid("list");
      for (fish of spot.fishes) {
        const name = fish.name;
        const icon = fish.icon;
        const newEntry = document.createElement("div");
        newEntry.classList.add("fish");
        newEntry.innerHTML = `<img src="https://xivapi.com${icon}"><div class="label">${name}</div>`;
        fishEntries.appendChild(newEntry)
      }
      break
    }
  }
}

startOverlayEvents()
