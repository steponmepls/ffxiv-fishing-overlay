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
            console.log("Start the timer now!")
        } else {
            for (const rule of events.stop) {
                if (rule.test(chatLog)) {
                    console.log("Stop the timer now!");
                    break
                }
            }
        }
    }
});

startOverlayEvents()