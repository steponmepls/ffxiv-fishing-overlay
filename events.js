let start = 0, newTimer;

const events = {
  start: /^You cast your line/,
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
  const zone = e.zoneID;
  console.log(`Current zone ID: ${zone}`)
})

addOverlayListener("LogLine", (e) => {
  const newLine = e.line;
  if (newLine.length > 4 && newLine[0] == "00") { // Only if chat log line
    const chatLog = newLine[4];
    if (events.start.test(chatLog)) {
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
        const elapsed = document.getElementById("timer").innerText;
        console.log (`Fish: ${fish[1]} - Size: ${fish[2]} - Unit: ${fish[3]} - Time: ${elapsed}s`)
      };
      for (const rule of events.exit) {
        if (rule.test(chatLog)) {
          const timer = document.getElementById("timer");
          timer.innerText = 0.0.toFixed(1);
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

startOverlayEvents()
