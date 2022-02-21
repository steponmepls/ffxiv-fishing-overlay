let lang, timerStart = 0, timerInterval, currentZone, currentSpot, chumEffect = false, wasChum = false;

const html = document.body.parentElement;
const container = document.getElementById("container");
const spotTitle = document.getElementById("spot");
const timer = document.getElementById("timer");
const spotFishes = document.getElementById("entries");
const marker = document.getElementById("marker").querySelector(".markline");

const fishingLog = {};
const fishingRecord = {};

fetch("./fishinglog.json")
.then(res => res.json())
.then(data => {
  for (const key in data) {
    fishingLog[key] = data[key]
  };
  // Init zone ids record
  if (Object.entries(fishingRecord).length < 1) {
    for (const zone in fishingLog) {
      fishingRecord[zone] = {};
      for (const spot in fishingLog[zone]) {
        fishingRecord[zone][spot] = {}
      }
    }
  }
  if (Object.values(fishingLog).length < 1 || Object.values(fishingRecord).length < 1) {
    throw new Error("Missing database. Plugin is borked smh..");
  }
})

const regex = {
  English: {
    show: [
      /^You cast your line.+\.$/,
      /unknown/i
    ],
    stat: [
      /^.+You (gain|lose) the effect of .{2}(.+)\.$/
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
    stop: [],
    loot: [],
    hide: []
  },
  German: {
    show: [],
    stat: [],
    stop: [],
    loot: [],
    hide: []
  },
  Japanese: {
    show: [],
    stat: [],
    stop: [],
    loot: [],
    hide: []
  },
  Escaped: /[-\/\\^$*+?.()|[\]{}]/g
}

// Fetch game language from ACT settings
async function getLang() {
  const output = await callOverlayHandler({ call: 'getLanguage' });
  lang = output.language;
  if (!lang) {
    console.debug(lang)
    throw new Error("ACT is broken. Wait for an update..");
  }
}
getLang();

addOverlayListener("ChangeZone", (e) => {
  const newZone = e.zoneID;
  currentZone = newZone;
  // console.debug(`Current zone ID: ${currentZone}`)
});

addOverlayListener("LogLine", (e) => {
  const newLog = e.line;
  if (newLog.length > 4 && newLog[0] === "00" && newLog[3] === "") {
    // console.debug(newLog);
    const chatLog = newLog[4];
    const events = regex[lang];

    if (events.show[0].test(chatLog)) {
      const startCast = new CustomEvent("startCasting", {
        detail: {
          line: chatLog.match(events.show[0])[0]
        }
      });
      document.dispatchEvent(startCast)
    }
    if (events.stat[0].test(chatLog)) {
      const state = chatLog.match(events.stat[0])[1];
      const effect = chatLog.match(events.stat[0])[2];
      const bool = /gain/.test(state);
      const buffStatus = new CustomEvent("buffStatus", {
        detail: {
          name: effect,
          status: bool
        }
      });
      document.dispatchEvent(buffStatus)
    }
    for (const rule of events.stop) {
      if (rule.test(chatLog)) {
        const stopCast = new CustomEvent("stopCasting");
        document.dispatchEvent(stopCast);
        break
      }
    }
    if (events.loot[0].test(chatLog)) {
      let total;
      const fish = chatLog.match(events.loot[0]);
      const elapsed = parseFloat(timer.innerText);
      if (/\d/.test(fish[1])) {
        total = parseInt(fish[1])
      } else {
        total = 1
      }
      const fishCaught = new CustomEvent("fishCaught", {
        detail: {
          name: fish[2],
          time: elapsed,
          size: parseFloat(fish[3]),
          unit: fish[4],
          amount: total,
          chum: wasChum,
          spotID: currentSpot
        }
      });
      document.dispatchEvent(fishCaught);
    }
    for (const rule of events.hide) {
      if (rule.test(chatLog)) {
        const stopFishing = new CustomEvent("stopFishing");
        document.dispatchEvent(stopFishing);
        break
      }
    }
  }
});

document.addEventListener("startCasting", startCasting);
document.addEventListener("stopCasting", clearTimer);
document.addEventListener("stopFishing", () => {
  html.classList.remove("fishing");
  marker.removeAttribute("style");
  html.classList.remove("marker-active");
  timer.innerText = (0).toFixed(1);
  // currentSpot = undefined;
  chumEffect = false;
  wasChum = false
});
document.addEventListener("fishCaught", updateLog);
document.addEventListener("buffStatus", (e) => {
  if (/\bChum\b/.test(e.detail.name)) {
    if (e.detail.status) {
      chumEffect = e.detail.status
    }
  }
})

function clearTimer() {
  html.classList.remove("casting");
  marker.style.animationPlayState = "paused";
  if (timerInterval) {
    window.clearInterval(timerInterval);
  }
}

function updateTimer() {
  const raw = (Date.now() - timerStart) / 1000;
  const formatted = raw.toFixed(1);
  timer.innerText = formatted
}

function startCasting(e) {
  // Reset timers before rerun
  timerStart = Date.now();
  timer.innerText = (0).toFixed(1);
  timerInterval = window.setInterval(updateTimer, 100);

  // Reset classes
  html.classList.add("fishing");
  html.classList.remove("marker-active");
  marker.removeAttribute("style");
  html.classList.add("casting");

  // Chum check
  wasChum = false;
  if (!chumEffect) {
    html.classList.remove("chum-active")
  } else {
    html.classList.add("chum-active");
    wasChum = true
  }

  if (regex[lang].show[1].test(e.detail.line)) {
    console.log("Set spot to undefined!");
    currentSpot = undefined;
    spotTitle.innerText = "???"
  } else {
    const spots = fishingLog[currentZone];
    for (const spot in spots) {
      const sanitized = spots[spot].name.replace(regex.Escaped, '\\$&');
      const rule = new RegExp(sanitized, "i");
      if (rule.test(e.detail.line)) {
        if (spot != currentSpot) {
          currentSpot = parseInt(spot);
          spotTitle.innerText = spots[currentSpot].name;
          resetEntries();
          populateEntries()
        }
        break
      }
    }
    setTimeout(() => {
      html.classList.add("marker-active")
    }, 10);
  }
}

function resetEntries() {
  for (let i=0; i<10; i++) {
    const item = document.getElementById("item" + i);
    item.querySelector(".icon img").src = "";
    item.querySelector(".label .name").innerHTML = "";
    // item.querySelector(".label .window").innerHTML = "";
    item.removeAttribute("data-fishid");
    for (const tug of ["medium", "heavy", "light"]) {
      item.classList.remove(tug)
    };
    const records = item.querySelectorAll("div[class*='record']");
    console.log("Removing records..");
    for (const record of records) {
      record.removeAttribute("data-min");
      record.removeAttribute("data-max");
      record.removeAttribute("style")
    }
  }
}

function populateEntries() { // Fetch spot fishes and fill entries
  const spots = fishingLog[currentZone];

  spots[currentSpot].fishes.forEach((fish, index) => {
    const item = document.getElementById("item" + index);
    const name = fish.name;
    const icon = "https://xivapi.com" + fish.icon;
    const tug = fish.tug;
    item.querySelector(".icon img").src = icon;
    item.querySelector(".label .name").innerText = name;
    // item.querySelector(".label .window").innerHTML = "";
    item.setAttribute("data-fishid", fish.id);
    ["medium", "heavy", "light"].forEach((t, index) => {
      if (tug == index) {
        item.classList.add(t);
      }
    })
  })
}

function updateLog(fish) {
  let fishID, fishRecord;

  const fishName = fish.detail.name;
  const fishTime = fish.detail.time;
  // const fishSize = fish.detail.size;
  // const sizeUnit = fish.detail.unit;
  // const totalFishes = fish.detail.amount;
  const chum = fish.detail.chum;
  const spotID = fish.detail.spotID;

  const regex = new RegExp(`${fishName}`, "i");
  for (const item of fishingLog[currentZone][currentSpot].fishes) {
    if (regex.test(item.name)) {
      fishID = item.id;
      break
    };
  }

  const spotRecord = fishingRecord[currentZone][spotID];

  // Init if no entries yet
  if (!(fishID in spotRecord)) {
    spotRecord[fishID] = {}
    spotRecord[fishID].chum = {}
  }

  if (!chum) {
    fishRecord = spotRecord[fishID]
  } else {
    fishRecord = spotRecord[fishID].chum
  }

  if (!("min" in fishRecord)) {
    fishRecord.min = fishTime;
    fishRecord.max = fishTime;
    updateRecord(fishID, fishRecord, chum)
  } else {
    if (fishTime < fishRecord.min) {
      fishRecord.min = fishTime;
      updateRecord(fishID, fishRecord, chum)
    } else if (fishTime > fishRecord.max) {
      fishRecord.max = fishTime;
      updateRecord(fishID, fishRecord, chum)
    }
  }
}

function updateRecord(id, record, wasChum) {
  let recordMark;
  if (!wasChum) {
    recordMark = spotFishes.querySelector(`.fish[data-fishid="${id}"] .label .record`);
  } else {
    recordMark = spotFishes.querySelector(`.fish[data-fishid="${id}"] .label .record-chum`);
  }

  function getPerc(time) {
    const output = (100 * time) / 60;
    return parseFloat(output.toFixed(1))
  }

  let minMark = getPerc(record.min)
  let maxMark = (getPerc(record.max)) - minMark;

  // Sanitize values >= 60s
  if (minMark >= 100) {
    minMark = 99;
    if (maxMark >= 100) {
      maxMark = 1;
    }
  } else if (maxMark >= 100) {
    maxMark = 100 - minMark
  }
    
  recordMark.setAttribute("data-min", record.min);
  recordMark.style.left = minMark + "%";
  recordMark.setAttribute("data-max", record.max);
  recordMark.style.width = maxMark + "%"
}

function debug() {
  currentZone = 135;
  lang = "English";
  document.dispatchEvent(new CustomEvent("startCasting", {
    detail: {
      line: "the salt strand"
    }
  }));
  /* window.setTimeout(() => {
    document.dispatchEvent(new CustomEvent("stopCasting"));
  }, 3000) */
}

function debugCatch() {
  document.dispatchEvent(new CustomEvent("stopCasting"));
  const elapsed = timer.innerText;
  document.dispatchEvent(new CustomEvent("fishCaught", {
    detail: {
      name: "sea cucumber",
      time: parseFloat(elapsed),
      size: 21,
      unit: "ilms",
      amount: 1,
      spotID: currentSpot
    }
  }))
}

startOverlayEvents()
