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
  ]
};

addOverlayListener("LogLine", (e) => {
  const newLine = e.line;
  if (newLine.length > 4 && newLine[0] == "00") { // Only if chat log line
    const chatLog = newLine[4];
    if (events.start.test(chatLog)) {
      console.debug(`Start the timer now! - Logline: ${chatLog}`);
      start = Date.now();
      newTimer = window.setInterval(updateTimer, 100);
    } else {
      for (const rule of events.stop) {
        if (rule.test(chatLog) && newTimer) {
          console.debug(`Stop the timer now! - Logline: ${chatLog}`);
          clearTimer();
          break // Exit loop
        }
      }
    }
  }
});

function updateTimer() {
  const timer = document.getElementById("timer");
  const raw = Date.now() - start / 1000;
  const formatted = raw.toFixed(1);
  timer.innerText = formatted;
}

function clearTimer() {
  if (newTimer) {
    const timer = document.getElementById("timer");
    window.clearInterval(newTimer);
    timer.innerText = 0.0;
    newTimer = null;
    start = 0
  }
;}

startOverlayEvents()
