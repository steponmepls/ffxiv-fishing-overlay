# fishing-overlay

More of a personal project than an actual overlay.

![image](https://user-images.githubusercontent.com/63500907/159572604-731da8f2-4d65-4fe3-94c8-87045ef3fa77.png)

For now it only supports English because I don't know either of the other languages supported in the game.
I can add support for french, german and japanese as well but you need to feed me log lines in said languages.
Open an issue if you are interested I guess??

The main difference with the overlay offered by GatherBuddy is that it lacks window timing support for timed fishes. 
I am too stupid to figure out how the prediction system works. Use [Carbuncle Plushy](https://ff14fish.carbuncleplushy.com/) tracker instead.

By sending `!fsettings` as message with the `/echo` command you can open the settings menu. Once there you'll be able to
import/export your current overlay settings, export caught fishes in a format readable by Carbuncle Plushy tracker, 
set your language of choice (only supports English for now) and then set QoL preferences such as aligning overlay either
to top or to bottom.

**Remember to reload the overlay to also apply the new changes!**

![image](https://user-images.githubusercontent.com/63500907/159576033-bb18d229-bde2-42da-87fd-421e282413d0.png)

By hovering your cursor on a record you will be able to highlight it for a more clear view and by clicking on it you'll be able 
to see an output message displaying the minimum and maximum values for that specific fish. By clicking on a fish icon you'll be able
to export to your clipboard a copy-pastable link to Garland DB showing detailed info about the fish. This as a workaround for the
lack of a proper built-in window tracking system.

___

It's also worth mentioning that the records for each fish are prone to errors. The slower you are to react to a bite by 
using `Hook`, the bigger the shift in time between actual bite and registered bite will be. There is no way around it 
because this overlay completely relies on chat logs and you'll only receive a chat log output if you use `Hook` or equivalent action.

What I am trying to say is that **you shouldn't take the records registered by this overlay  as absolute truth**. 
The average between two registered values (minimum and maximum biting times) is, on the other hand, 
a safe guess no matter how late the `Hook` event was registered.
