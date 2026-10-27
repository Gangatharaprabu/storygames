// The Clockmaker's Shop — a standalone placeholder story.

VAR arrived = false
VAR noticed_clocks = false

=== arrival ===
Tick. Tick. Then nothing. Every clock in the shop has stopped.
ren: That's not normal. Not even here. #thinking
-> DONE

=== oda ===
oda: Don't touch anything. Especially not the strongbox. #grumpy
* [Ask what happened]
    ren: Mr. Oda, why did the clocks stop?
    oda: If I knew, would I be standing here? Look for yourself. #grumpy
* [Offer to help]
    ren: I could help you look. #happy
    oda: ...Fine. Fresh eyes. Start with the clocks. #neutral
- -> DONE

=== clocks ===
Big clocks, small clocks, a cuckoo with its beak open. All of them say a quarter past nine.
ren: Every single one. Nine fifteen. #surprised
~ noticed_clocks = true
-> DONE

=== box_locked ===
A heavy strongbox with four number dials.
-> DONE

=== ending ===
The strongbox opens onto a key, and the key opens the back room. Inside, one great clock is still running.
oda: You found it. The heart of the shop. #surprised
ren: Then let's wind the others. #happy
-> DONE
