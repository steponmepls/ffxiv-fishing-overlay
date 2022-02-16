let timerStart = 0, timerInterval, currentZone;

const container = document.getElementById("container");
const spotTitle = document.getElementById("fishing-spot");
const timer = document.getElementById("timer");
const spotFishes = document.getElementById("list");
const marker = document.getElementById("marker");

const events = {
  start: /^You cast your line (?:in|at(?: the)?) (.+)\.$/,
  stop: [
    /^Something bites/,
    /^The fish gets away/,
    /^You lose your/,
    /^Nothing bites/,
    /^You (reel in|put away) your/,
    /^The fish sense something amiss/
  ],
  success: /^You land (an?|\d) .(.+) measuring ([0-9.]+) (\w+)!$/,
  exit: [
    /^You put away your/,
    /^The fish sense something amiss/
  ]
};

addOverlayListener("ChangeZone", (e) => {
  const newZone = e.zoneID;
  currentZone = newZone;
  // console.debug(`Current zone ID: ${currentZone}`)
});

addOverlayListener("LogLine", (e) => {
  const newLog = e.line;
  if (newLog.length > 4 && newLog[0] === "00") {
    const chatLog = newLog[4];
    if (events.start.test(chatLog)) {
      const startCast = new CustomEvent("startCasting", {
        detail: {
          name: chatLog.match(events.start)[1]
        }
      });
      document.dispatchEvent(startCast)
    } else {
      for (const regex of events.stop) {
        if (regex.test(chatLog)) {
          const stopCast = new CustomEvent("stopCasting");
          document.dispatchEvent(stopCast);
          break
        }
      };
      for (const regex of events.exit) {
        if (regex.test(chatLog)) {
          const stopFishing = new CustomEvent("stopFishing");
          document.dispatchEvent(stopFishing);
          break
        }
      };
      if (events.success.test(chatLog)) {
        let total;
        const fish = chatLog.match(events.success);
        const elapsed = timer.innerText;
        if (/\d/.test(fish[1])) {
          total = parseInt(fish[1])
        } else {
          total = 1
        }
        const fishCaught = new CustomEvent("fishCaught", {
          detail: {
            name: fish[2],
            time: elapsed,
            size: fish[3],
            unit: fish[4],
            amount: total
          }
        });
        document.dispatchEvent(fishCaught)
      }
    }
  }
});

document.addEventListener("startCasting", startCasting);
document.addEventListener("stopCasting", clearTimer);
document.addEventListener("stopFishing", () => {
  container.removeAttribute("class");
  timer.innerText = 0.0.toFixed(1) // 0.toFixed(1) will fail!
});
document.addEventListener("fishCaught", (e) => {
  const fishName = e.detail.name;
  const fishTime = e.detail.time;
  const fishSize = e.detail.size;
  const sizeUnit = e.detail.unit;
  // console.debug(`Caught ${fishName} (${fishSize}${sizeUnit}) in ${fishTime}s`);
});

function startCasting(spot) {
  timerStart = Date.now();
  populateEntries(spot.detail.name);
  timer.innerText = 0.0.toFixed(1); // 0.toFixed(1) will fail!
  container.classList.add("show");
  timerInterval = window.setInterval(updateTimer, 100);
  if (marker.getAttribute("style")) {
    marker.style.width = "0px";
    marker.removeAttribute("style");
  }
  // Kinda ugly but it works for now soooo
  setTimeout(() => {
    marker.classList.add("transition");
    marker.classList.add("casting")
  }, 10)
}

function populateEntries(name) {
  // Pre-filter fishing log so you only search in relevant area
  const spots = Object.entries(fishingLog).find(zone => zone[0] == parseInt(currentZone));
  const regex = new RegExp(`${name}`, "i");
  for (const spot of spots[1]) {
    if (regex.test(spot.name)) {
      spotTitle.innerText = spot.name;
      // Clean items leftovers
      for (let i=0; i<10; i++) {
        const item = document.getElementById("item" + i);
        item.querySelector(".icon img").src = "";
        item.querySelector(".label").innerHTML = "";
        item.classList.remove("show")
      }
      // Fetch spot fishes and fill entries
      spot.fishes.forEach((fish, index) => {
        const name = fish.name;
        const icon = "https://xivapi.com" + fish.icon;
        const item = document.getElementById("item" + index);
        item.querySelector(".icon img").src = icon;
        item.querySelector(".label").innerText = name;
        item.classList.add("show");
      })
      break
    }
  }
}

function clearTimer() {
  if (timerInterval) {
    window.clearInterval(timerInterval);
    timerInterval = null;
    marker.style.width=getComputedStyle(marker).width;
    marker.removeAttribute("class")
  }
}

function updateTimer() {
  const raw = (Date.now() - timerStart) / 1000;
  const formatted = raw.toFixed(1);
  timer.innerText = formatted
}

function debug() {
  currentZone = 135;
  document.dispatchEvent(new CustomEvent("startCasting", {
    detail: {
      name: "the salt strand"
    }
  }));
  setInterval(() => {
    document.dispatchEvent(new CustomEvent("stopCasting"))
  }, 15000)
}

startOverlayEvents()
